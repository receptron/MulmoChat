<template>
  <div
    class="w-80 flex-shrink-0 bg-gray-50 border border-gray-300 rounded p-4 flex flex-col space-y-4"
  >
    <div class="flex-shrink-0 flex items-center justify-between gap-2">
      <h2 class="text-lg font-semibold text-gray-700">Tool Call History</h2>
      <button
        type="button"
        class="h-8 w-8 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        :class="{ '!text-green-600': copied }"
        data-testid="copy-tool-call-history"
        :disabled="filteredToolCallHistory.length === 0"
        :title="copied ? 'Copied!' : 'Copy tool call history'"
        :aria-label="copied ? 'Copied!' : 'Copy tool call history'"
        @click="onCopyHistory"
      >
        <span class="material-icons text-lg" aria-hidden="true">{{
          copied ? "check" : "content_copy"
        }}</span>
      </button>
    </div>

    <div
      ref="historyContainer"
      class="flex-1 overflow-y-auto space-y-2 min-h-0"
    >
      <div
        v-if="filteredToolCallHistory.length === 0"
        class="text-gray-500 text-sm text-center py-4"
      >
        No tool calls yet
      </div>
      <div
        v-for="(call, index) in filteredToolCallHistory"
        :key="index"
        class="border border-gray-300 rounded p-3 bg-white text-xs space-y-1"
      >
        <div class="flex justify-between items-start">
          <span class="font-semibold text-blue-600">{{ call.toolName }}</span>
          <span class="text-gray-400 text-xs">{{
            formatTime(call.timestamp)
          }}</span>
        </div>
        <div class="text-gray-600">
          <div class="font-medium text-gray-700 mb-1">Arguments:</div>
          <pre class="bg-gray-50 p-2 rounded text-xs overflow-x-auto">{{
            formatJson(call.args)
          }}</pre>
        </div>
        <div v-if="call.error" class="text-gray-600">
          <div class="font-medium text-gray-700 mb-1">Error:</div>
          <div class="bg-red-50 p-2 rounded space-y-1">
            <div class="text-red-700 text-xs">
              {{ call.error }}
            </div>
          </div>
        </div>
        <div v-if="call.result" class="text-gray-600">
          <div class="font-medium text-gray-700 mb-1">Result:</div>
          <div class="bg-green-50 p-2 rounded space-y-1">
            <div
              v-if="call.result.title"
              class="text-gray-700 font-medium text-xs"
            >
              {{ call.result.title }}
            </div>
            <div v-if="call.result.message" class="text-gray-700 text-xs">
              {{ call.result.message }}
            </div>
            <div v-if="call.result.data" class="text-gray-500">
              <div class="text-xs font-medium text-gray-700">Data:</div>
              <pre class="text-xs overflow-x-auto bg-white p-1 rounded">{{
                formatJson(call.result.data)
              }}</pre>
            </div>
            <div class="text-xs text-gray-500">
              UUID: {{ call.result.uuid }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, computed } from "vue";
import type { ToolResult } from "gui-chat-protocol/vue";
import { useClipboardCopy } from "@mulmoclaude/core/plugin-vue";

interface ToolCallHistoryItem {
  toolName: string;
  args: any;
  timestamp: number;
  result?: ToolResult;
  error?: string;
}

const props = defineProps<{
  toolCallHistory: ToolCallHistoryItem[];
}>();

const historyContainer = ref<HTMLDivElement | null>(null);

// Filter out text-response pseudo tool calls from the display
const filteredToolCallHistory = computed(() => {
  return props.toolCallHistory.filter(
    (call) => call.toolName !== "text-response",
  );
});

const { copied, copy } = useClipboardCopy();

// Images are kept as base64 data URLs, so one generated image would put
// megabytes on the clipboard. The copy keeps their type and size instead.
const MAX_DATA_URL_LENGTH = 200;

function shortenDataUrls(key: string, value: unknown): unknown {
  if (
    typeof value === "string" &&
    value.startsWith("data:") &&
    value.length > MAX_DATA_URL_LENGTH
  ) {
    return `${value.slice(0, value.indexOf(",") + 1)}… (${value.length} characters)`;
  }
  return value;
}

// Same as MulmoClaude's copy button: the history as JSON
async function onCopyHistory(): Promise<void> {
  await copy(JSON.stringify(filteredToolCallHistory.value, shortenDataUrls, 2));
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString();
}

function formatJson(obj: any): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

function scrollToBottom(): void {
  nextTick(() => {
    if (historyContainer.value) {
      historyContainer.value.scrollTop = historyContainer.value.scrollHeight;
    }
  });
}

defineExpose({
  scrollToBottom,
});
</script>
