<template>
  <div
    class="w-60 flex-shrink-0 bg-gray-50 border rounded p-4 flex flex-col space-y-4"
  >
    <!-- Voice chat controls -->
    <div class="space-y-2 flex-shrink-0">
      <button
        v-if="!chatActive"
        @click="$emit('startChat')"
        :disabled="connecting"
        class="w-full px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50"
      >
        {{ connecting ? "Connecting..." : "Start Voice Chat" }}
      </button>
      <div v-else class="flex gap-2">
        <button
          @click="$emit('stopChat')"
          class="flex-1 px-4 py-2 bg-red-600 text-white rounded"
        >
          Stop
        </button>
        <button
          @click="$emit('toggleMute')"
          class="px-3 py-2 rounded border flex items-center justify-center"
          :class="
            isMuted
              ? 'bg-red-100 text-red-600 border-red-300'
              : 'bg-gray-100 text-gray-600 border-gray-300'
          "
          :title="isMuted ? 'Unmute microphone' : 'Mute microphone'"
        >
          <span class="material-icons text-lg">{{
            isMuted ? "mic_off" : "mic"
          }}</span>
        </button>
      </div>
      <audio ref="audioEl" autoplay></audio>
    </div>

    <!-- Generated images container -->
    <div class="flex-1 flex flex-col min-h-0">
      <div
        ref="imageContainer"
        class="border rounded p-2 overflow-y-auto space-y-2 flex-1"
      >
        <div
          v-if="!pluginResults.length && !isGeneratingImage"
          class="text-gray-500 text-sm"
        >
          Feel free to ask me any questions...
        </div>
        <div
          v-for="(result, index) in pluginResults"
          :key="index"
          class="cursor-pointer hover:opacity-75 transition-opacity border rounded p-2"
          :class="{ 'ring-2 ring-blue-500': selectedResult === result }"
          @click="$emit('selectResult', result)"
        >
          <component
            v-if="getPlugin(result.toolName)?.previewComponent"
            :is="getPlugin(result.toolName).previewComponent"
            :result="result"
          />
        </div>
        <div
          v-if="isGeneratingImage"
          class="flex items-center justify-center py-4"
        >
          <div
            class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"
          ></div>
          <span class="ml-2 text-sm text-gray-600">{{
            generatingMessage
          }}</span>
        </div>
      </div>
    </div>

    <div class="space-y-2 flex-shrink-0">
      <!-- Message input with plus button -->
      <div class="flex gap-2 items-center">
        <input
          ref="fileInput"
          type="file"
          accept="image/*"
          multiple
          @change="handleFileUpload"
          class="hidden"
        />
        <button
          @click="$refs.fileInput?.click()"
          :disabled="!chatActive"
          class="w-10 h-10 bg-gray-200 hover:bg-gray-300 rounded-full disabled:opacity-50 flex items-center justify-center"
        >
          <svg
            class="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 4v16m8-8H4"
            />
          </svg>
        </button>
        <input
          :value="userInput"
          @input="
            $emit('update:userInput', ($event.target as HTMLInputElement).value)
          "
          @keyup.enter.prevent="$emit('sendTextMessage')"
          :disabled="!chatActive"
          type="text"
          placeholder="Type a message"
          class="flex-1 border rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        />
        <button
          @click="$emit('sendTextMessage')"
          :disabled="!chatActive || !userInput.trim()"
          class="w-10 h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-full disabled:opacity-50 flex items-center justify-center"
        >
          <svg
            class="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
            />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, defineProps, defineEmits } from "vue";
import type { ToolResult } from "../tools/type";
import { getPlugin } from "../tools/type";

defineProps<{
  chatActive: boolean;
  connecting: boolean;
  pluginResults: ToolResult[];
  isGeneratingImage: boolean;
  generatingMessage: string;
  selectedResult: ToolResult | null;
  userInput: string;
  isMuted: boolean;
}>();

const emit = defineEmits<{
  startChat: [];
  stopChat: [];
  toggleMute: [];
  selectResult: [result: ToolResult];
  sendTextMessage: [];
  "update:userInput": [value: string];
  uploadImage: [files: FileList];
}>();

const audioEl = ref<HTMLAudioElement | null>(null);
const imageContainer = ref<HTMLDivElement | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);

function handleFileUpload(event: Event): void {
  const input = event.target as HTMLInputElement;
  if (input.files && input.files.length > 0) {
    emit("uploadImage", input.files);
    input.value = ""; // Reset input
  }
}

function scrollToBottom(): void {
  nextTick(() => {
    if (imageContainer.value) {
      imageContainer.value.scrollTop = imageContainer.value.scrollHeight;
    }
  });
}

defineExpose({
  audioEl,
  scrollToBottom,
});
</script>
