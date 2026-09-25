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

type MaybeRef<T> = T | Ref<T>;

export type SessionTransportKind =
  "voice-realtime" | "text-rest" | "voice-google-live" | "voice-grok";

export interface SessionTransportCapabilities {
  supportsAudioInput: boolean;
  supportsAudioOutput: boolean;
  supportsText: boolean;
}

export interface UseSessionTransportOptions extends RealtimeSessionOptions {
  transportKind?: MaybeRef<SessionTransportKind>;
}

export interface UseSessionTransportReturn extends UseRealtimeSessionReturn {
  transportKind: ComputedRef<SessionTransportKind>;
  capabilities: ComputedRef<SessionTransportCapabilities>;
}

export function useSessionTransport(
  options: UseSessionTransportOptions,
): UseSessionTransportReturn {
  const { transportKind: providedKind, ...realtimeOptions } = options;

  const transportKind = computed<SessionTransportKind>(() => {
    const kind = providedKind ? unref(providedKind) : "voice-realtime";
    return kind;
  });

  const voiceSession = useVoiceRealtimeSession(realtimeOptions);
  const textSession = useTextSession(realtimeOptions);
  const googleLiveSession = useGoogleLiveSession(realtimeOptions);
  const grokVoiceSession = useGrokVoiceSession(realtimeOptions);

  const activeSession = computed(() => {
    if (transportKind.value === "text-rest") return textSession;
    if (transportKind.value === "voice-google-live") return googleLiveSession;
    if (transportKind.value === "voice-grok") return grokVoiceSession;
    return voiceSession;
  });

  const capabilities = computed<SessionTransportCapabilities>(() => {
    if (
      transportKind.value === "voice-realtime" ||
      transportKind.value === "voice-grok"
    ) {
      return {
        supportsAudioInput: true,
        supportsAudioOutput: true,
        supportsText: true,
      };
    }

    if (transportKind.value === "voice-google-live") {
      return {
        supportsAudioInput: true,
        supportsAudioOutput: true,
        supportsText: true,
      };
    }

    return {
      supportsAudioInput: false,
      supportsAudioOutput: false,
      supportsText: true,
    };
  });

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
    sendUserMessage: (text: string) =>
      activeSession.value.sendUserMessage(text),
    sendFunctionCallOutput: (callId: string, output: string) =>
      activeSession.value.sendFunctionCallOutput(callId, output),
    sendInstructions: (instructions: string) =>
      activeSession.value.sendInstructions(instructions),
    sendImagesToModel: (images: string[], caption: string) =>
      activeSession.value.sendImagesToModel(images, caption),
    setMute: (muted: boolean) => activeSession.value.setMute(muted),
    setLocalAudioEnabled: (enabled: boolean) =>
      activeSession.value.setLocalAudioEnabled(enabled),
    attachRemoteAudioElement: (
      ...args: Parameters<UseRealtimeSessionReturn["attachRemoteAudioElement"]>
    ) => activeSession.value.attachRemoteAudioElement(...args),
    registerEventHandlers: (
      handlers: Partial<RealtimeSessionEventHandlers>,
    ) => {
      voiceSession.registerEventHandlers(handlers);
      textSession.registerEventHandlers(handlers);
      googleLiveSession.registerEventHandlers(handlers);
      grokVoiceSession.registerEventHandlers(handlers);
    },
    transportKind,
    capabilities,
  };
}
