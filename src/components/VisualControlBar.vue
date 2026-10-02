<template>
  <!-- The visual mode's controls, after MulmoGlass's ControlBar: large
       targets, since this mode is for headsets as much as for desktops.
       Smaller below `sm`, and wrapping, so exit stays reachable on a phone. -->
  <footer
    class="shrink-0 border-t border-slate-800 bg-slate-900 px-3 py-3 sm:px-6 sm:py-4 flex flex-wrap items-center gap-2 sm:gap-5 text-slate-100"
  >
    <button
      class="h-14 w-14 sm:h-20 sm:w-20 rounded-full flex items-center justify-center shrink-0 transition-colors"
      :class="
        chatActive
          ? 'bg-red-600 hover:bg-red-500'
          : 'bg-sky-600 hover:bg-sky-500 disabled:opacity-60'
      "
      :aria-label="chatActive ? 'Stop' : 'Connect'"
      :title="chatActive ? 'Stop' : 'Connect'"
      :disabled="!chatActive && (connecting || !canConnect)"
      @click="$emit('toggleChat')"
    >
      <span class="material-icons text-[32px]! sm:text-[44px]!">{{
        chatActive ? "call_end" : connecting ? "hourglass_top" : "mic"
      }}</span>
    </button>

    <button
      v-if="chatActive && supportsAudioInput"
      class="h-12 w-12 sm:h-16 sm:w-16 rounded-full flex items-center justify-center shrink-0"
      :class="
        isMuted
          ? 'bg-red-900 hover:bg-red-800'
          : 'bg-slate-700 hover:bg-slate-600'
      "
      :aria-label="isMuted ? 'Unmute' : 'Mute'"
      :title="isMuted ? 'Unmute microphone' : 'Mute microphone'"
      @click="$emit('toggleMute')"
    >
      <span class="material-icons text-[28px]! sm:text-[36px]!">{{
        isMuted ? "mic_off" : "mic_none"
      }}</span>
    </button>

    <!-- With the microphone muted, the user types to the model instead: the
         box takes the state and status lines' place, in the same row. -->
    <form
      v-if="chatActive && isMuted"
      class="flex-1 min-w-40 flex items-center gap-2 sm:gap-3"
      @submit.prevent="send"
    >
      <input
        ref="textInput"
        v-model="text"
        type="text"
        aria-label="Message"
        placeholder="Muted: type a message"
        class="flex-1 min-w-0 h-12 sm:h-14 rounded-full bg-slate-800 px-5 text-lg sm:text-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
      />
      <button
        type="submit"
        class="h-12 w-12 sm:h-14 sm:w-14 rounded-full flex items-center justify-center shrink-0 bg-sky-600 hover:bg-sky-500 disabled:opacity-40"
        aria-label="Send"
        title="Send"
        :disabled="!text.trim()"
      >
        <span class="material-icons text-[26px]! sm:text-[30px]!">send</span>
      </button>
    </form>
    <div v-else class="flex-1 min-w-40">
      <div
        class="text-xl sm:text-2xl leading-snug truncate"
        data-testid="visual-state"
      >
        {{ state }}
      </div>
      <div
        class="text-base sm:text-lg text-slate-400 truncate"
        data-testid="status"
      >
        {{ status }}
      </div>
    </div>

    <div v-if="resultCount > 0" class="flex items-center gap-2 shrink-0">
      <button
        class="h-12 w-12 sm:h-16 sm:w-16 rounded-full flex items-center justify-center bg-slate-800 hover:bg-slate-700 disabled:opacity-40"
        aria-label="Previous result"
        :disabled="selectedIndex <= 0"
        @click="$emit('select', selectedIndex - 1)"
      >
        <span class="material-icons text-[28px]! sm:text-[36px]!"
          >chevron_left</span
        >
      </button>
      <span class="text-lg sm:text-xl tabular-nums w-14 sm:w-20 text-center"
        >{{ selectedIndex + 1 }} / {{ resultCount }}</span
      >
      <button
        class="h-12 w-12 sm:h-16 sm:w-16 rounded-full flex items-center justify-center bg-slate-800 hover:bg-slate-700 disabled:opacity-40"
        aria-label="Next result"
        :disabled="selectedIndex >= resultCount - 1"
        @click="$emit('select', selectedIndex + 1)"
      >
        <span class="material-icons text-[28px]! sm:text-[36px]!"
          >chevron_right</span
        >
      </button>
    </div>

    <button
      v-if="audioDebug"
      class="h-12 w-12 sm:h-16 sm:w-16 rounded-full flex items-center justify-center shrink-0 bg-amber-900 hover:bg-amber-800 text-amber-200"
      aria-label="Save the last minute of audio (debug)"
      title="Save the last minute of audio (debug)"
      @click="$emit('saveAudio')"
    >
      <span class="material-icons text-[28px]! sm:text-[36px]!"
        >graphic_eq</span
      >
    </button>

    <!-- Configuration can't change while connected (as in the sidebar). -->
    <button
      v-if="!chatActive"
      class="h-12 w-12 sm:h-16 sm:w-16 rounded-full flex items-center justify-center shrink-0 bg-slate-800 hover:bg-slate-700"
      aria-label="Configuration"
      title="Configuration"
      @click="$emit('openSettings')"
    >
      <span class="material-icons text-[28px]! sm:text-[36px]!">settings</span>
    </button>

    <button
      class="h-12 w-12 sm:h-16 sm:w-16 rounded-full flex items-center justify-center shrink-0 bg-slate-800 hover:bg-slate-700"
      aria-label="Exit visual mode"
      title="Exit visual mode"
      @click="$emit('exit')"
    >
      <span class="material-icons text-[28px]! sm:text-[36px]!"
        >close_fullscreen</span
      >
    </button>
  </footer>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from "vue";

const props = defineProps<{
  chatActive: boolean;
  connecting: boolean;
  /** False for a text model: this mode has no text entry. */
  canConnect: boolean;
  isMuted: boolean;
  supportsAudioInput: boolean;
  /** What is happening now: connecting, listening, responding. */
  state: string;
  /** The model, image model, role and language. */
  status: string;
  resultCount: number;
  selectedIndex: number;
  audioDebug: boolean;
}>();

const emit = defineEmits<{
  toggleChat: [];
  toggleMute: [];
  select: [index: number];
  saveAudio: [];
  openSettings: [];
  exit: [];
  sendText: [text: string];
}>();

const text = ref("");
const textInput = ref<HTMLInputElement | null>(null);

// The box takes the focus when it appears (the user just muted).
watch(
  () => props.chatActive && props.isMuted,
  async (shown) => {
    if (!shown) return;
    await nextTick();
    textInput.value?.focus();
  },
);

function send(): void {
  const message = text.value.trim();
  if (!message) return;
  emit("sendText", message);
  text.value = "";
}
</script>
