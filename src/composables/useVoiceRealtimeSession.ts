import {
  useRealtimeSession,
  type RealtimeSessionOptions,
  type UseRealtimeSessionReturn,
} from "./useRealtimeSession";

export function useVoiceRealtimeSession(
  options: RealtimeSessionOptions,
): UseRealtimeSessionReturn {
  return useRealtimeSession(options);
}
