<template>
  <div class="w-full h-full overflow-hidden bg-white flex flex-col">
    <div
      v-if="!selectedResult.data?.html"
      class="flex-1 flex items-center justify-center"
    >
      <div class="text-gray-500">No HTML content available</div>
    </div>
    <template v-else>
      <!-- Header with title and download button -->
      <div
        class="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50"
      >
        <h1 class="text-xl font-semibold text-gray-800">
          {{ selectedResult.title || "HTML Page" }}
        </h1>
        <button
          @click="downloadHtml"
          class="flex items-center gap-2 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm transition-colors"
        >
          <span class="material-icons text-base">download</span>
          HTML
        </button>
      </div>

      <!-- iframe for rendering HTML -->
      <iframe
        ref="iframeRef"
        :srcdoc="selectedResult.data.html"
        class="flex-1 w-full border-0"
        sandbox="allow-scripts allow-same-origin"
        @load="onIframeLoad"
      ></iframe>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import type { ToolResult } from "../types";
import type { HtmlToolData } from "../utils";

const props = defineProps<{
  selectedResult: ToolResult<HtmlToolData>;
}>();

const iframeRef = ref<HTMLIFrameElement | null>(null);

const onIframeLoad = () => {
  console.log("HTML iframe loaded successfully");
};

const downloadHtml = () => {
  const html = props.selectedResult.data?.html;
  if (!html) return;

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const filename = props.selectedResult.title
    ? `${props.selectedResult.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.html`
    : "page.html";
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
</script>
