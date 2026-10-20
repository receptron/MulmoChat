import { computed, type ComputedRef, type Ref, unref } from "vue";
import {
  type RealtimeSessionEventHandlers,
  type RealtimeSessionOptions,
  type UseRealtimeSessionReturn,
} from "./useRealtimeSession";
import { useVoiceRealtimeSession } from "./useVoiceRealtimeSession";
import { useTextSession } from "./useTextSession";
import { useGoogleLiveSession } from "./useGoogleLiveSession";
import { useGrokVoiceSession } from "./useGrokVoiceSession";
import { useElevenLabsVoiceSession } from "./useElevenLabsVoiceSession";

type MaybeRef<T> = T | Ref<T>;

export type SessionTransportKind =
  | "voice-realtime"
  | "text-rest"
  | "voice-google-live"
  | "voice-grok"
  | "voice-elevenlabs";

export interface SessionTransportCapabilities {
  supportsAudioInput: boolean;
  supportsAudioOutput: boolean;
  supportsText: boolean;
}

const VOICE: SessionTransportCapabilities = {
  supportsAudioInput: true,
  supportsAudioOutput: true,
  supportsText: true,
};

const TRANSPORT_CAPABILITIES: Record<
  SessionTransportKind,
  SessionTransportCapabilities
> = {
  "voice-realtime": VOICE,
  "voice-google-live": VOICE,
  "voice-grok": VOICE,
  "voice-elevenlabs": VOICE,
  "text-rest": {
    supportsAudioInput: false,
    supportsAudioOutput: false,
    supportsText: true,
  },
};

export interface UseSessionTransportOptions extends RealtimeSessionOptions {
  transportKind?: MaybeRef<SessionTransportKind>;
}

export interface UseSessionTransportReturn extends UseRealtimeSessionReturn {
  transportKind: ComputedRef<SessionTransportKind>;
  capabilities: ComputedRef<SessionTransportCapabilities>;
  /** Stop one transport's session, active or not (after a transport switch,
   *  the previous one is no longer the active session). */
  stopChatFor: (kind: SessionTransportKind) => void;
}

export function useSessionTransport(
  options: UseSessionTransportOptions,
): UseSessionTransportReturn {
  const { transportKind: providedKind, ...realtimeOptions } = options;

  const transportKind = computed<SessionTransportKind>(() => {
    const kind = providedKind ? unref(providedKind) : "voice-realtime";
    return kind;
  });

  const sessions: Record<SessionTransportKind, UseRealtimeSessionReturn> = {
    "voice-realtime": useVoiceRealtimeSession(realtimeOptions),
    "text-rest": useTextSession(realtimeOptions),
    "voice-google-live": useGoogleLiveSession(realtimeOptions),
    "voice-grok": useGrokVoiceSession(realtimeOptions),
    "voice-elevenlabs": useElevenLabsVoiceSession(realtimeOptions),
  };

  const sessionFor = (kind: SessionTransportKind) => sessions[kind];

  const activeSession = computed(() => sessionFor(transportKind.value));

  const capabilities = computed(
    () => TRANSPORT_CAPABILITIES[transportKind.value],
  );

  return {
    chatActive: computed(() => activeSession.value.chatActive.value),
    conversationActive: computed(
      () => activeSession.value.conversationActive.value,
    ),
    connecting: computed(() => activeSession.value.connecting.value),
    isMuted: computed(() => activeSession.value.isMuted.value),
    startResponse: computed(() => activeSession.value.startResponse.value),
    isDataChannelOpen: () => activeSession.value.isDataChannelOpen(),
    startChat: () => activeSession.value.startChat(),
    stopChat: () => activeSession.value.stopChat(),
    stopChatFor: (kind: SessionTransportKind) => sessionFor(kind).stopChat(),
    sendUserMessage: (text: string) =>
      activeSession.value.sendUserMessage(text),
    sendFunctionCallOutput: (callId: string, output: string) =>
      activeSession.value.sendFunctionCallOutput(callId, output),
    sendInstructions: (instructions: string, required?: boolean) =>
      activeSession.value.sendInstructions(instructions, required),
    sendImagesToModel: (images: string[], caption: string) =>
      activeSession.value.sendImagesToModel(images, caption),
    continueConversation: () => activeSession.value.continueConversation(),
    setMute: (muted: boolean) => activeSession.value.setMute(muted),
    setLocalAudioEnabled: (enabled: boolean) =>
      activeSession.value.setLocalAudioEnabled(enabled),
    attachRemoteAudioElement: (
      ...args: Parameters<UseRealtimeSessionReturn["attachRemoteAudioElement"]>
    ) => activeSession.value.attachRemoteAudioElement(...args),
    registerEventHandlers: (
      handlers: Partial<RealtimeSessionEventHandlers>,
    ) => {
      Object.values(sessions).forEach((session) =>
        session.registerEventHandlers(handlers),
      );
    },
    transportKind,
    capabilities,
  };
}
