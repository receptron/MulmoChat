<template>
  <div class="w-full h-full">
    <!-- Twitter embed -->
    <div
      v-if="selectedResult?.data?.url && isTwitterUrl(selectedResult.data.url)"
      class="overflow-auto p-4 bg-white h-full"
    >
      <div
        v-if="selectedResult.data.twitterEmbedHtml"
        v-html="selectedResult.data.twitterEmbedHtml"
      />
      <div
        v-else-if="selectedResult.data.twitterEmbedHtml === null"
        class="h-full flex items-center justify-center"
      >
        <div class="text-center">
          <div class="text-gray-600 mb-4">Unable to load Twitter embed</div>
          <a
            :href="selectedResult.data.url"
            target="_blank"
            class="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Open on Twitter/X
          </a>
        </div>
      </div>
      <div v-else class="h-full flex items-center justify-center">
        <div class="text-center">
          <div
            class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"
          ></div>
          <div class="text-gray-600">Loading Twitter embed...</div>
        </div>
      </div>
    </div>

    <!-- Generic URL extracted content -->
    <TextSelectionMenu
      v-if="selectedResult?.data?.url && !isTwitterUrl(selectedResult.data.url)"
      :send-text-message="sendTextMessage"
    >
      <template #default="{ onMouseUp }">
        <div class="w-full h-full overflow-auto p-6 bg-white">
          <div class="max-w-4xl mx-auto">
            <div class="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
              <div class="text-sm text-blue-800">
                <a
                  :href="selectedResult.data.url"
                  target="_blank"
                  class="text-blue-600 hover:underline"
                >
                  Open original page →
                </a>
              </div>
            </div>

            <!-- Article header -->
            <article @mouseup="onMouseUp">
              <h1 class="text-3xl font-bold mb-3 text-gray-900">
                {{ extractedTitle }}
              </h1>

              <div v-if="extractedByline" class="text-sm text-gray-600 mb-2">
                By {{ extractedByline }}
              </div>

              <div
                v-if="extractedExcerpt"
                class="text-lg text-gray-700 mb-4 italic border-l-4 border-blue-500 pl-4"
              >
                {{ extractedExcerpt }}
              </div>

              <!-- Main content -->
              <div class="text-gray-800 leading-relaxed">
                <div
                  v-for="(paragraph, index) in formattedContent"
                  :key="index"
                  class="mb-4"
                >
                  {{ paragraph }}
                </div>
              </div>
            </article>
          </div>
        </div>
      </template>
    </TextSelectionMenu>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { ToolResult } from "../types";
import type { BrowseToolData, BrowseJsonData } from "../models/browse";
import TextSelectionMenu from "../../components/TextSelectionMenu.vue";

const props = defineProps<{
  selectedResult: ToolResult<BrowseToolData, BrowseJsonData> | null;
  sendTextMessage: (text?: string) => void;
}>();

const extractedTitle = computed(() => {
  const jsonData = props.selectedResult?.jsonData;
  return jsonData?.data?.title || props.selectedResult?.title || "Untitled";
});

const extractedByline = computed(() => {
  const jsonData = props.selectedResult?.jsonData;
  return jsonData?.data?.byline || "";
});

const extractedExcerpt = computed(() => {
  const jsonData = props.selectedResult?.jsonData;
  return jsonData?.data?.excerpt || "";
});

const extractedContent = computed(() => {
  const jsonData = props.selectedResult?.jsonData;
  const content = jsonData?.data?.textContent || jsonData?.data?.text;
  if (!content) {
    return "No content available.";
  }
  return content;
});

const formattedContent = computed(() => {
  const content = extractedContent.value;
  if (content === "No content available.") {
    return [content];
  }

  // Split by double newlines for paragraphs, or single newlines if no double newlines exist
  const paragraphs = content.includes("\n\n")
    ? content.split("\n\n")
    : content.split("\n");

  // Filter out empty paragraphs and trim whitespace
  return paragraphs
    .map((p: string) => p.trim())
    .filter((p: string) => p.length > 0);
});

function isTwitterUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return (
      urlObj.hostname === "twitter.com" ||
      urlObj.hostname === "www.twitter.com" ||
      urlObj.hostname === "x.com" ||
      urlObj.hostname === "www.x.com"
    );
  } catch {
    return false;
  }
}
</script>
