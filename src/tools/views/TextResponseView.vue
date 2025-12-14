<template>
  <div class="text-response-container">
    <div class="text-response-content-wrapper">
      <div class="p-6">
        <div class="max-w-3xl mx-auto space-y-4">
          <div
            class="rounded-lg border bg-white shadow-sm p-5"
            :class="roleTheme"
          >
            <div
              class="flex justify-between items-start mb-2 text-sm text-gray-500"
            >
              <span class="font-medium text-gray-700">{{ speakerLabel }}</span>
              <span v-if="transportKind" class="italic">{{
                transportKind
              }}</span>
            </div>
            <div
              class="markdown-content prose prose-slate max-w-none leading-relaxed text-gray-900"
              v-html="renderedHtml"
            ></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Collapsible Editor -->
    <details class="text-response-source">
      <summary>Edit Text Content</summary>
      <textarea
        v-model="editedText"
        @input="handleTextEdit"
        class="text-response-editor"
        spellcheck="false"
      ></textarea>
      <button @click="applyChanges" class="apply-btn" :disabled="!hasChanges">
        Apply Changes
      </button>
    </details>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { marked } from "marked";
import type { ToolResult, ToolResultComplete } from "../types";
import type { TextResponseData } from "../models/textResponse";

const props = defineProps<{
  selectedResult: ToolResultComplete<TextResponseData>;
}>();

const emit = defineEmits<{
  updateResult: [result: ToolResult];
}>();

const messageText = computed(() => props.selectedResult.data?.text ?? "");
const editedText = ref(messageText.value);

// Update editedText when selectedResult changes
watch(
  () => props.selectedResult.data?.text,
  (newText) => {
    if (newText !== undefined) {
      editedText.value = newText;
    }
  },
);
const messageRole = computed(
  () => props.selectedResult.data?.role ?? "assistant",
);
const transportKind = computed(
  () => props.selectedResult.data?.transportKind ?? "",
);

const renderedHtml = computed(() => {
  if (!messageText.value) return "";

  let processedText = messageText.value;

  // Detect and wrap JSON content in code fences
  const trimmedText = processedText.trim();
  if (
    (trimmedText.startsWith("{") && trimmedText.endsWith("}")) ||
    (trimmedText.startsWith("[") && trimmedText.endsWith("]"))
  ) {
    try {
      // Validate it's actually JSON
      JSON.parse(trimmedText);
      // Wrap in markdown code fence
      processedText = "```json\n" + trimmedText + "\n```";
    } catch {
      // Not valid JSON, continue with original text
    }
  }

  // Process <think> blocks to make them grey
  processedText = processedText.replace(
    /<think>([\s\S]*?)<\/think>/g,
    (_, content) => {
      // Render the think block content as markdown and wrap in a styled div
      const thinkContent = marked(content.trim());
      return `<div class="think-block">${thinkContent}</div>`;
    },
  );

  // Configure marked to handle line breaks
  const markedOptions = {
    breaks: true, // Convert \n to <br>
    gfm: true, // GitHub Flavored Markdown
  };

  return marked(processedText, markedOptions);
});

const speakerLabel = computed(() => {
  switch (messageRole.value) {
    case "system":
      return "System";
    case "user":
      return "You";
    default:
      return "Assistant";
  }
});

const roleTheme = computed(() => {
  switch (messageRole.value) {
    case "system":
      return "bg-blue-50 border-blue-200";
    case "user":
      return "bg-green-50 border-green-200";
    default:
      return "bg-purple-50 border-purple-200";
  }
});

// Check if text has been modified
const hasChanges = computed(() => {
  return editedText.value !== messageText.value;
});

// Handle text editing
function handleTextEdit() {
  // Just allow the v-model to update editedText
}

// Apply edited text
function applyChanges() {
  if (!hasChanges.value) return;

  const updatedResult: ToolResult = {
    ...props.selectedResult,
    data: {
      ...props.selectedResult.data,
      text: editedText.value,
    },
  };

  emit("updateResult", updatedResult);
}
</script>

<style scoped>
.markdown-content :deep(h1) {
  font-size: 2rem;
  font-weight: bold;
  margin-top: 1em;
  margin-bottom: 0.5em;
}

.markdown-content :deep(h2) {
  font-size: 1.75rem;
  font-weight: bold;
  margin-top: 1em;
  margin-bottom: 0.5em;
}

.markdown-content :deep(h3) {
  font-size: 1.5rem;
  font-weight: bold;
  margin-top: 1em;
  margin-bottom: 0.5em;
}

.markdown-content :deep(h4) {
  font-size: 1.25rem;
  font-weight: bold;
  margin-top: 1em;
  margin-bottom: 0.5em;
}

.markdown-content :deep(h5) {
  font-size: 1.125rem;
  font-weight: bold;
  margin-top: 1em;
  margin-bottom: 0.5em;
}

.markdown-content :deep(h6) {
  font-size: 1rem;
  font-weight: bold;
  margin-top: 1em;
  margin-bottom: 0.5em;
}

.markdown-content :deep(p) {
  margin-bottom: 1em;
}

.markdown-content :deep(ul),
.markdown-content :deep(ol) {
  margin-left: 1.5em;
  margin-bottom: 1em;
}

.markdown-content :deep(li) {
  margin-bottom: 0.5em;
}

.markdown-content :deep(code) {
  background-color: #f5f5f5;
  padding: 0.2em 0.4em;
  border-radius: 3px;
  font-family: monospace;
  font-size: 0.9em;
}

.markdown-content :deep(pre) {
  background-color: #f5f5f5;
  padding: 1em;
  border-radius: 4px;
  overflow-x: auto;
  margin-bottom: 1em;
}

.markdown-content :deep(pre code) {
  background-color: transparent;
  padding: 0;
}

.markdown-content :deep(blockquote) {
  border-left: 4px solid #ddd;
  padding-left: 1em;
  color: #666;
  margin: 1em 0;
}

.markdown-content :deep(a) {
  color: #2563eb;
  text-decoration: underline;
}

.markdown-content :deep(a:hover) {
  color: #1d4ed8;
}

.markdown-content :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin-bottom: 1em;
}

.markdown-content :deep(th),
.markdown-content :deep(td) {
  border: 1px solid #ddd;
  padding: 0.5em;
  text-align: left;
}

.markdown-content :deep(th) {
  background-color: #f5f5f5;
  font-weight: bold;
}

.markdown-content :deep(hr) {
  border: none;
  border-top: 1px solid #ddd;
  margin: 1.5em 0;
}

.markdown-content :deep(.think-block) {
  color: #6b7280;
  background-color: #f9fafb;
  border-left: 3px solid #d1d5db;
  padding: 0.75em 1em;
  margin: 1em 0;
  border-radius: 4px;
  font-style: italic;
}

.markdown-content :deep(.think-block p) {
  color: #6b7280;
}

.markdown-content :deep(.think-block code) {
  background-color: #e5e7eb;
  color: #4b5563;
}

/* Container styles */
.text-response-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.text-response-content-wrapper {
  flex: 1;
  overflow-y: auto;
}

/* Editor panel styles */
.text-response-source {
  padding: 0.5rem;
  background: #f5f5f5;
  border-top: 1px solid #e0e0e0;
  font-family: monospace;
  font-size: 0.85rem;
  flex-shrink: 0;
}

.text-response-source summary {
  cursor: pointer;
  user-select: none;
  padding: 0.5rem;
  background: #e8e8e8;
  border-radius: 4px;
  font-weight: 500;
  color: #333;
}

.text-response-source[open] summary {
  margin-bottom: 0.5rem;
}

.text-response-source summary:hover {
  background: #d8d8d8;
}

.text-response-editor {
  width: 100%;
  height: 40vh;
  padding: 1rem;
  background: #ffffff;
  border: 1px solid #ccc;
  border-radius: 4px;
  color: #333;
  font-family: "Courier New", monospace;
  font-size: 0.9rem;
  resize: vertical;
  margin-bottom: 0.5rem;
  line-height: 1.5;
}

.text-response-editor:focus {
  outline: none;
  border-color: #4caf50;
  box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.1);
}

.apply-btn {
  padding: 0.5rem 1rem;
  background: #4caf50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background 0.2s;
  font-weight: 500;
}

.apply-btn:hover {
  background: #45a049;
}

.apply-btn:active {
  background: #3d8b40;
}

.apply-btn:disabled {
  background: #cccccc;
  color: #666666;
  cursor: not-allowed;
  opacity: 0.6;
}

.apply-btn:disabled:hover {
  background: #cccccc;
}
</style>
