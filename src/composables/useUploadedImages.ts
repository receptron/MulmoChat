import { watch, type Ref } from "vue";
import type { ToolResult } from "gui-chat-protocol/vue";
import type { SessionTransportKind } from "./useSessionTransport";
import type { UseRealtimeSessionReturn } from "./useRealtimeSession";
import { getImagesForModel } from "../tools";
import { DEFAULT_TEXT_MODEL } from "../config/textModels";

// Images the user uploads (or pastes) are shown as cards; this also shows
// them to the model. A text chat sends them with the user's next message. A
// voice chat sends them once connected and has the model say what it sees.
// Grok's and ElevenLabs' voice APIs take no image input
// (useRealtimeWebSocketSession's sendImagesToModel), so for them a text model
// of the same company describes the image and the voice model gets the
// description.

/** Longest side of an image sent to the model: a photo straight from a
 *  phone is several MB, too much for a voice session's message. */
const MAX_SIDE = 1024;
/** How long a voice chat that just started may take to open its channel. */
const OPEN_WAIT_MS = 15_000;
const OPEN_POLL_MS = 200;

/** The text model that describes an image for a voice model without image
 *  input. */
const DESCRIBER: Partial<
  Record<SessionTransportKind, { provider: string; model: string }>
> = {
  "voice-grok": { provider: "grok", model: "grok-4.7" },
  "voice-elevenlabs": {
    provider: DEFAULT_TEXT_MODEL.provider,
    model: DEFAULT_TEXT_MODEL.model,
  },
};

interface Upload {
  images: string[];
  name: string;
}

interface UseUploadedImagesOptions {
  transportKind: Ref<SessionTransportKind>;
  chatActive: Ref<boolean>;
  isDataChannelOpen: () => boolean;
  sendImagesToModel: (images: string[], caption: string) => boolean;
  sendInstructions: UseRealtimeSessionReturn["sendInstructions"];
}

/** `url` scaled down to MAX_SIDE as a JPEG; unchanged when it is smaller or
 *  can't be decoded. */
const downscale = (url: string): Promise<string> =>
  new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const scale = MAX_SIDE / Math.max(image.width, image.height);
      if (scale >= 1) return resolve(url);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      const context = canvas.getContext("2d");
      if (!context) return resolve(url);
      // JPEG has no transparency: a transparent PNG goes on white, not black.
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    image.onerror = () => resolve(url);
    image.src = url;
  });

const imageOf = (result: ToolResult): string | undefined => {
  const data = result.data as { imageData?: unknown } | undefined;
  const [image] = getImagesForModel({ imagesForModel: [data?.imageData] });
  return image;
};

const describe = async (
  images: string[],
  describer: { provider: string; model: string },
): Promise<string | undefined> => {
  try {
    const response = await fetch("/api/text/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...describer,
        messages: [
          {
            role: "user",
            content:
              "Describe this image for someone who cannot see it, so they can talk about it: what is in it, where, colours, any text in it word for word, and anything unusual. Plain prose, no preamble.",
            images,
          },
        ],
      }),
    });
    if (!response.ok) return undefined;
    const payload = (await response.json()) as { result?: { text?: string } };
    return payload.result?.text?.trim() || undefined;
  } catch (error) {
    console.error("Describing an uploaded image failed", error);
    return undefined;
  }
};

export function useUploadedImages(options: UseUploadedImagesOptions) {
  // Uploaded in a voice chat that is not connected yet.
  const waiting: Upload[] = [];
  let opening = false;

  const tellVoiceModel = async ({ images, name }: Upload) => {
    const caption = `[The user uploaded an image: ${name}]`;
    if (options.sendImagesToModel(images, caption)) {
      options.sendInstructions(
        `The user just showed you an image (${name}). Look at it, say in one short sentence what you see, and wait for what they want to do with it.`,
      );
      return;
    }
    const describer = DESCRIBER[options.transportKind.value];
    const description = describer && (await describe(images, describer));
    options.sendInstructions(
      description
        ? `The user just showed you an image (${name}). You can't see images; this is what it shows: ${description}\nTalk about it from this description as if you saw it. Say in one short sentence what you see, and wait for what they want to do with it.`
        : `The user just showed you an image (${name}), but it could not be passed to you. Tell them in one short sentence that you can't see it.`,
    );
  };

  const sendWaiting = () => {
    for (const upload of waiting.splice(0)) void tellVoiceModel(upload);
  };

  /** Sends the waiting uploads once the voice chat's channel is open. */
  const sendWhenOpen = async () => {
    if (opening) return;
    opening = true;
    try {
      for (let waited = 0; waited < OPEN_WAIT_MS; waited += OPEN_POLL_MS) {
        if (!options.chatActive.value) return;
        if (options.isDataChannelOpen()) return sendWaiting();
        await new Promise((resolve) => setTimeout(resolve, OPEN_POLL_MS));
      }
    } finally {
      opening = false;
    }
  };

  watch(options.chatActive, (active) => {
    if (active && waiting.length > 0) void sendWhenOpen();
  });

  /** Shows the uploaded images to the model. */
  const showUploads = async (results: ToolResult[]) => {
    for (const result of results) {
      const image = imageOf(result);
      if (!image) continue;
      const upload = {
        images: [await downscale(image)],
        name: result.title || "image",
      };
      if (options.transportKind.value === "text-rest") {
        // Queued: it goes with the user's next message.
        options.sendImagesToModel(
          upload.images,
          `[The user uploaded an image: ${upload.name}]`,
        );
      } else {
        waiting.push(upload);
      }
    }
    if (waiting.length > 0 && options.chatActive.value) void sendWhenOpen();
  };

  return { showUploads };
}
