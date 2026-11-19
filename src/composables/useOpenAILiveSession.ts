// OpenAI's Live API (gpt-live-1) over WebRTC. Not a Realtime model: the
// voice model only talks (full duplex: it starts and ends its own turns, no
// response.create makes it speak), and hands reasoning and tool calls to a
// backend, a Responses model the session runs for us ("Responses
// delegation"). So MulmoChat's instructions and tools go to the backend, tool
// calls arrive as that backend's events (nested in `response.event`), and
// what the host sends (outputs, images, instructions, typed messages) are
// items for the backend followed by a response.create (liveBackendWork.ts).
//
// The server creates the session (`POST /api/start/live/session`) from the
// browser's SDP offer, so OPENAI_API_KEY never reaches the browser.

import { shallowRef } from "vue";
import type {
  LiveSessionRequest,
  LiveSessionResponse,
  StartApiResponse,
} from "../../server/types";
import { DEFAULT_LIVE_VOICE_MODEL_ID } from "../../server/utils/liveModels";
import { resolveVoice } from "../../server/utils/voices";
import type { ToolCallMessage } from "./types";
import { useSessionBase } from "./sessionBase";
import type {
  RealtimeSessionOptions,
  UseRealtimeSessionReturn,
} from "./useRealtimeSession";
import { createLiveBackendWork } from "./liveBackendWork";
import {
  liveBackendInstructions,
  liveFrontendInstructions,
} from "./liveInstructions";

/** The Live API has no speech-started/stopped events; the user counts as
 *  speaking until their transcript has been quiet this long. */
const USER_SPEECH_GAP_MS = 1200;
/** After the backend's answer, how long the voice model may take to start
 *  saying it before the reply counts as over. */
const SPEECH_START_WAIT_MS = 4000;
/** How long `session.close` may take to be confirmed before the connection
 *  is dropped anyway. */
const CLOSE_TIMEOUT_MS = 5000;
const ICE_TIMEOUT_MS = 10_000;
/** What of a typed message the voice model is told (its appends take 500
 *  tokens; the backend gets the whole message). */
const TYPED_MIRROR_CHARS = 300;
/** When the browser doesn't say how large a data channel message may be. */
const DEFAULT_MAX_MESSAGE_BYTES = 65_536;

// Output level (RMS of samples in -1..1) that counts as the model speaking,
// and how long it must stay under it to count as stopped.
const SPEAKING_LEVEL = 0.01;
const SILENCE_MS = 700;
const LEVEL_POLL_MS = 100;

interface LiveConnection {
  pc: RTCPeerConnection;
  dc: RTCDataChannel;
  localStream: MediaStream | null;
  remoteStream: MediaStream;
  audioContext: AudioContext | null;
  levelTimer: ReturnType<typeof setInterval> | null;
  closeTimer: ReturnType<typeof setTimeout> | null;
}

interface LiveServerEvent {
  type: string;
  client_event_id?: string;
  reason?: string;
  error?: { code?: unknown; message?: unknown; client_event_id?: unknown };
  event?: {
    type: string;
    item?: {
      type?: string;
      call_id?: string;
      name?: string;
      arguments?: string;
    };
    response?: { error?: { message?: unknown } | null };
  };
}

const postJson = async <T>(
  url: string,
  body: unknown,
  signal: AbortSignal,
): Promise<T> => {
  // A JSON POST, so another site can't make the server start a session
  // (see requireTrustedOrigin).
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as {
      error?: string;
      details?: string;
    } | null;
    throw new Error(
      [data?.error, data?.details].filter(Boolean).join(": ") ||
        `API error: ${response.statusText}`,
    );
  }
  return (await response.json()) as T;
};

const iceGathered = (pc: RTCPeerConnection): Promise<void> =>
  new Promise((resolve, reject) => {
    if (pc.iceGatheringState === "complete") {
      resolve();
      return;
    }
    const done = (error?: Error) => {
      clearTimeout(timeout);
      pc.removeEventListener("icegatheringstatechange", onState);
      if (error) reject(error);
      else resolve();
    };
    const onState = () => {
      if (pc.iceGatheringState === "complete") done();
    };
    const timeout = setTimeout(
      () => done(new Error("Timed out while gathering ICE candidates")),
      ICE_TIMEOUT_MS,
    );
    pc.addEventListener("icegatheringstatechange", onState);
  });

export function useOpenAILiveSession(
  options: RealtimeSessionOptions,
): UseRealtimeSessionReturn {
  const {
    currentHandlers,
    registerEventHandlers,
    chatActive,
    conversationActive,
    connecting,
    isMuted,
    startResponse,
  } = useSessionBase(options.handlers);
  const remoteAudioElement = shallowRef<HTMLAudioElement | null>(null);

  /** The session in use. A stopped one keeps its own object until OpenAI
   *  confirms the close, so its late events are told apart by identity. */
  let connection: LiveConnection | null = null;
  /** Counts starts and stops: a start that finds it changed after an await
   *  was cancelled. */
  let generation = 0;
  /** Releases what a start that is still connecting holds: its requests,
   *  microphone and peer connection. */
  let cancelStart: (() => void) | null = null;

  const sendEvent = (event: Record<string, unknown>): boolean => {
    const dc = connection?.dc;
    if (!dc || dc.readyState !== "open") {
      console.warn(
        "Cannot send message because the data channel is not ready.",
      );
      return false;
    }
    dc.send(JSON.stringify(event));
    return true;
  };

  const backend = createLiveBackendWork(sendEvent);

  // "The model is replying": the backend is working, or the voice model is
  // speaking, or the backend just answered and the voice model is about to
  // say it. The host waits for this to end before it sends a typed message
  // or asks a slideshow to go on.
  let audioPlaying = false;
  let userSpeaking = false;
  let userSpeechTimer: ReturnType<typeof setTimeout> | null = null;
  let speechStartTimer: ReturnType<typeof setTimeout> | null = null;
  let appendCount = 0;
  /** Function calls in the backend response that is running. */
  let callsInResponse = 0;

  const updateConversationActive = () => {
    const active =
      backend.isRunning() || audioPlaying || speechStartTimer !== null;
    if (active === conversationActive.value) return;
    conversationActive.value = active;
    if (active) currentHandlers().onConversationStarted?.();
    else currentHandlers().onConversationFinished?.();
  };

  const clearSpeechStartTimer = () => {
    if (speechStartTimer) clearTimeout(speechStartTimer);
    speechStartTimer = null;
  };

  const setAudioPlaying = (playing: boolean) => {
    if (playing === audioPlaying) return;
    audioPlaying = playing;
    if (playing) {
      clearSpeechStartTimer();
      currentHandlers().onAudioPlaybackStarted?.();
    } else {
      currentHandlers().onAudioPlaybackStopped?.();
    }
    updateConversationActive();
  };

  const setUserSpeaking = (speaking: boolean) => {
    if (userSpeechTimer) clearTimeout(userSpeechTimer);
    userSpeechTimer = speaking
      ? setTimeout(() => setUserSpeaking(false), USER_SPEECH_GAP_MS)
      : null;
    if (speaking === userSpeaking) return;
    userSpeaking = speaking;
    if (speaking) currentHandlers().onSpeechStarted?.();
    else currentHandlers().onSpeechStopped?.();
  };

  // WebRTC plays the model's audio itself and the Live API sends no
  // playback events, so the output track's level says when it is speaking.
  const watchOutputLevel = (conn: LiveConnection) => {
    if (conn.audioContext) return;
    try {
      const context = new AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      context.createMediaStreamSource(conn.remoteStream).connect(analyser);
      void context.resume();
      const samples = new Float32Array(analyser.fftSize);
      let quietSince = 0;
      conn.audioContext = context;
      conn.levelTimer = setInterval(() => {
        if (conn !== connection) return;
        analyser.getFloatTimeDomainData(samples);
        const sum = samples.reduce((acc, sample) => acc + sample * sample, 0);
        const level = Math.sqrt(sum / samples.length);
        if (level >= SPEAKING_LEVEL) {
          quietSince = 0;
          setAudioPlaying(true);
        } else if (audioPlaying) {
          quietSince ||= Date.now();
          if (Date.now() - quietSince >= SILENCE_MS) setAudioPlaying(false);
        }
      }, LEVEL_POLL_MS);
    } catch (error) {
      // Without it the host only loses "the model is speaking".
      console.warn("Cannot watch the output level", error);
    }
  };

  const releaseConnection = (conn: LiveConnection) => {
    if (conn.closeTimer) clearTimeout(conn.closeTimer);
    if (conn.levelTimer) clearInterval(conn.levelTimer);
    void conn.audioContext?.close().catch(() => undefined);
    conn.localStream?.getTracks().forEach((track) => track.stop());
    conn.remoteStream.getTracks().forEach((track) => track.stop());
    conn.dc.close();
    conn.pc.close();
  };

  /** Back to "no session": the state the next start begins from. */
  const resetSessionState = () => {
    backend.reset();
    clearSpeechStartTimer();
    if (userSpeechTimer) clearTimeout(userSpeechTimer);
    userSpeechTimer = null;
    userSpeaking = false;
    // Audio stops with the connection, and nothing will say so.
    if (audioPlaying) {
      audioPlaying = false;
      currentHandlers().onAudioPlaybackStopped?.();
    }
    chatActive.value = false;
    conversationActive.value = false;
    connecting.value = false;
  };

  const handleBackendEvent = async (event: LiveServerEvent["event"]) => {
    if (!event) return;
    switch (event.type) {
      case "response.created":
        backend.responseStarted();
        callsInResponse = 0;
        clearSpeechStartTimer();
        updateConversationActive();
        break;
      case "response.output_item.done": {
        const item = event.item;
        // The finished item has the call's id, name and arguments; the
        // arguments-done event alone doesn't identify the call.
        if (item?.type !== "function_call" || !item.call_id) break;
        if (!backend.toolCalled(item.call_id)) break;
        callsInResponse += 1;
        const argStr = item.arguments ?? "";
        console.log(`MSG: toolcall\n${argStr}`);
        const msg: ToolCallMessage = {
          type: "response.function_call_arguments.done",
          call_id: item.call_id,
          name: item.name,
          arguments: argStr,
        };
        await currentHandlers().onToolCall?.(msg, item.call_id, argStr);
        break;
      }
      case "response.completed":
      case "response.incomplete":
      case "response.failed":
      case "response.cancelled": {
        if (event.type === "response.failed") {
          const reason = event.response?.error?.message;
          const detail = typeof reason === "string" ? `: ${reason}` : ".";
          currentHandlers().onError?.(
            new Error(`The backend model failed${detail}`),
          );
        }
        // The voice model says an answer next, and until it starts the
        // reply isn't over. A response that called tools has no answer yet.
        clearSpeechStartTimer();
        if (!audioPlaying && callsInResponse === 0) {
          speechStartTimer = setTimeout(() => {
            speechStartTimer = null;
            updateConversationActive();
          }, SPEECH_START_WAIT_MS);
        }
        backend.responseEnded();
        updateConversationActive();
        break;
      }
    }
  };

  const handleMessage = async (conn: LiveConnection, data: unknown) => {
    let event: LiveServerEvent;
    try {
      event = JSON.parse(String(data)) as LiveServerEvent;
    } catch (error) {
      console.error("Failed to parse message:", error);
      return;
    }
    if (typeof event?.type !== "string") return;

    // A session that was stopped still sends its last events; only its
    // close matters.
    if (conn !== connection) {
      if (event.type === "session.closed") releaseConnection(conn);
      return;
    }

    switch (event.type) {
      case "session.started":
        // Only now does the session take commands, so only now is the chat
        // on: a message typed before this would be dropped.
        chatActive.value = true;
        connecting.value = false;
        watchOutputLevel(conn);
        break;
      case "session.closed":
        // Not asked for by us (stopChat forgets the connection first): the
        // session expired, was ended by a filter, or lost its connection.
        connection = null;
        releaseConnection(conn);
        resetSessionState();
        currentHandlers().onError?.(
          new Error(
            `The voice session ended (${event.reason ?? "unknown reason"}).`,
          ),
        );
        break;
      case "session.input_transcript.delta":
        setUserSpeaking(true);
        break;
      case "response.event":
        await handleBackendEvent(event.event);
        break;
      case "error": {
        const error = event.error;
        const outcome = backend.rejected(error?.client_event_id, error?.code);
        // Asked to go on while an output was still missing: asked again
        // when that output goes.
        if (outcome === "early") break;
        console.error("Live session error", error);
        currentHandlers().onError?.(error);
        break;
      }
    }
  };

  const stopChat = () => {
    generation += 1;
    // A start still waiting for the server: its microphone goes now, not
    // when the request settles.
    cancelStart?.();
    cancelStart = null;
    const conn = connection;
    connection = null;
    if (conn) {
      // The microphone goes now; the connection stays until OpenAI confirms
      // the close (it finalizes the session's usage then), or a timeout.
      conn.localStream?.getTracks().forEach((track) => track.stop());
      if (conn.dc.readyState === "open") {
        conn.dc.send(JSON.stringify({ type: "session.close" }));
        conn.closeTimer = setTimeout(
          () => releaseConnection(conn),
          CLOSE_TIMEOUT_MS,
        );
      } else {
        releaseConnection(conn);
      }
    }
    if (remoteAudioElement.value) {
      remoteAudioElement.value.srcObject = null;
    }
    resetSessionState();
    setMute(false);
  };

  const startChat = async () => {
    if (chatActive.value || connecting.value) return;
    connecting.value = true;
    backend.reset();
    generation += 1;
    const mine = generation;
    const cancelled = () => mine !== generation;

    const modelId =
      options.getModelId?.({ startResponse: startResponse.value }) ??
      DEFAULT_LIVE_VOICE_MODEL_ID;
    const voice = resolveVoice(
      "openai-live",
      options.getVoiceId?.("openai-live"),
    );

    let pc: RTCPeerConnection | null = null;
    let localStream: MediaStream | null = null;
    const abort = new AbortController();
    // What this start made and hasn't handed over to `connection`.
    const release = () => {
      abort.abort();
      localStream?.getTracks().forEach((track) => track.stop());
      pc?.close();
    };
    cancelStart = release;
    try {
      // The flags the instructions and tools are built from.
      const flags = await postJson<StartApiResponse>(
        "/api/start/live",
        {},
        abort.signal,
      );
      if (cancelled()) return;
      startResponse.value = flags;

      pc = new RTCPeerConnection();
      const conn: LiveConnection = {
        pc,
        // Created before the offer, as the API asks.
        dc: pc.createDataChannel("oai-events"),
        localStream: null,
        remoteStream: new MediaStream(),
        audioContext: null,
        levelTimer: null,
        closeTimer: null,
      };
      // Bound to this connection: a late event or close of a replaced one
      // must not touch the new chat.
      conn.dc.addEventListener("message", (event) => {
        void handleMessage(conn, event.data);
      });
      conn.dc.addEventListener("close", () => {
        if (conn !== connection) return;
        // The channel closed without a session.closed.
        connection = null;
        releaseConnection(conn);
        resetSessionState();
        currentHandlers().onError?.(
          new Error("The voice session's connection was lost."),
        );
      });
      pc.addEventListener("track", (event) => {
        conn.remoteStream.addTrack(event.track);
        if (conn === connection && remoteAudioElement.value) {
          remoteAudioElement.value.srcObject = conn.remoteStream;
        }
      });

      localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (cancelled()) return;
      conn.localStream = localStream;
      localStream
        .getTracks()
        .forEach((track) => pc?.addTrack(track, localStream as MediaStream));

      await pc.setLocalDescription(await pc.createOffer());
      await iceGathered(pc);
      if (cancelled()) return;
      const sdp = pc.localDescription?.sdp;
      if (!sdp) throw new Error("Missing local SDP offer");

      const context = { startResponse: startResponse.value };
      const instructions = options.buildInstructions(context);
      const tools = options.buildTools(context);
      console.log(`INSTRUCTIONS:\n${instructions}`);
      const request: LiveSessionRequest = {
        sdp,
        model: modelId,
        voice,
        instructions: liveFrontendInstructions(instructions, tools),
        backendInstructions: liveBackendInstructions(instructions),
        tools,
      };
      const session = await postJson<LiveSessionResponse>(
        "/api/start/live/session",
        request,
        abort.signal,
      );
      // Cancelled while the session was being created: closing the peer
      // connection (below) ends it.
      if (cancelled()) return;
      // From here stopChat and the handlers know the session by `connection`.
      connection = conn;
      pc = null;
      localStream = null;
      await conn.pc.setRemoteDescription({ type: "answer", sdp: session.sdp });
      if (cancelled()) return;
      if (remoteAudioElement.value) {
        remoteAudioElement.value.srcObject = conn.remoteStream;
      }
      setMute(isMuted.value);
      // chatActive turns on at session.started, on the data channel.
    } catch (err) {
      if (cancelled()) return;
      console.error(err);
      stopChat();
      currentHandlers().onError?.(
        new Error(
          `Failed to start the voice chat: ${err instanceof Error ? err.message : String(err)}`,
        ),
      );
    } finally {
      // A cancelled or failed start; after the handover it holds nothing.
      release();
      if (cancelStart === release) cancelStart = null;
    }
  };

  const setLocalAudioEnabled = (enabled: boolean) => {
    connection?.localStream?.getAudioTracks().forEach((track) => {
      track.enabled = enabled;
    });
  };

  const setMute = (muted: boolean) => {
    isMuted.value = muted;
    setLocalAudioEnabled(!muted);
  };

  const attachRemoteAudioElement = (audio: HTMLAudioElement | null) => {
    remoteAudioElement.value = audio;
    if (audio && connection) audio.srcObject = connection.remoteStream;
  };

  const isDataChannelOpen = () =>
    chatActive.value && connection?.dc.readyState === "open";

  const sendUserMessage = async (text: string) => {
    if (!isDataChannelOpen()) {
      console.warn(
        "Cannot send text message because the data channel is not ready.",
      );
      return false;
    }
    console.log(`MSG:\n`, text);
    // The backend answers a typed message; the voice model, which says the
    // answer, is told what was asked.
    appendCount += 1;
    sendEvent({
      type: "session.thinking.append",
      event_id: `mulmochat_typed_${appendCount}`,
      delegation_id: null,
      content: `The user typed a message instead of speaking: "${text.slice(0, TYPED_MIRROR_CHARS)}". The backend is answering it.`,
    });
    backend.userMessage(text);
    return true;
  };

  const sendFunctionCallOutput = (callId: string, output: string) =>
    backend.toolOutput(callId, output);

  const sendInstructions = (instructions: string) => {
    if (!isDataChannelOpen()) return false;
    backend.instruct(instructions);
    return true;
  };

  // The backend sees images (the voice model doesn't). A data channel
  // message has a size limit, which a large image can pass.
  const sendImagesToModel = (images: string[], caption: string) => {
    if (!isDataChannelOpen() || images.length === 0) return false;
    const limit =
      connection?.pc.sctp?.maxMessageSize ?? DEFAULT_MAX_MESSAGE_BYTES;
    if (!backend.showImages(images, caption, limit)) {
      console.warn(
        `Images not sent to the model: over the data channel's ${limit} bytes.`,
      );
      return false;
    }
    return true;
  };

  return {
    chatActive,
    conversationActive,
    connecting,
    isMuted,
    startResponse,
    isDataChannelOpen,
    startChat,
    stopChat,
    sendUserMessage,
    sendFunctionCallOutput,
    sendInstructions,
    sendImagesToModel,
    continueConversation: () => false,
    setMute,
    setLocalAudioEnabled,
    attachRemoteAudioElement,
    registerEventHandlers,
  };
}
