import { ref } from "vue";
import type { StartApiResponse } from "../../server/types";
import type { RealtimeSessionEventHandlers } from "./useRealtimeSession";

// What every transport starts with. registerEventHandlers replaces the handler
// object rather than mutating it, so read it through currentHandlers() at the
// moment a handler is needed.
export function useSessionBase(handlers?: RealtimeSessionEventHandlers) {
  let current: RealtimeSessionEventHandlers = {
    ...(handlers ?? {}),
  };

  const registerEventHandlers = (
    newHandlers: Partial<RealtimeSessionEventHandlers>,
  ) => {
    current = {
      ...current,
      ...newHandlers,
    };
  };

  return {
    currentHandlers: () => current,
    registerEventHandlers,
    chatActive: ref(false),
    conversationActive: ref(false),
    connecting: ref(false),
    isMuted: ref(false),
    startResponse: ref<StartApiResponse | null>(null),
  };
}
