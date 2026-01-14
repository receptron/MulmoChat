<template>
  <TextSelectionMenu :send-text-message="sendTextMessage">
    <template #default="{ onMouseUp }">
      <div class="w-full h-full overflow-auto p-6 bg-white">
        <div class="max-w-4xl mx-auto" @mouseup="onMouseUp">
          <h2 class="text-2xl font-bold text-gray-800 mb-6">
            Search Results
            <span
              v-if="selectedResult.jsonData && selectedResult.jsonData.query"
              class="text-lg font-normal text-gray-600"
            >
              for "{{ selectedResult.jsonData.query }}"
            </span>
          </h2>
          <div v-if="selectedResult.jsonData" class="space-y-6">
            <div
              v-for="(result, index) in selectedResult.jsonData.results || []"
              :key="index"
              class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div class="flex items-start justify-between">
                <div class="flex-1">
                  <h3
                    class="text-lg font-semibold text-blue-600 hover:text-blue-800"
                  >
                    <a
                      :href="result.url"
                      class="hover:underline"
                      @click="(e) => handleLinkClick(e, result.url)"
                    >
                      {{ result.title }}
                    </a>
                  </h3>
                  <p class="text-sm text-gray-500 mt-1">{{ result.url }}</p>
                  <p v-if="result.text" class="text-gray-700 mt-2 line-clamp-3">
                    {{ result.text }}
                  </p>
                  <div
                    v-if="result.highlights && result.highlights.length"
                    class="mt-3"
                  >
                    <p class="text-sm font-medium text-gray-600 mb-1">
                      Key highlights:
                    </p>
                    <div class="space-y-1">
                      <p
                        v-for="(highlight, hIndex) in result.highlights.slice(
                          0,
                          3,
                        )"
                        :key="hIndex"
                        class="text-sm text-gray-600 italic"
                      >
                        "{{ highlight }}"
                      </p>
                    </div>
                  </div>
                  <p
                    v-if="result.publishedDate"
                    class="text-xs text-gray-400 mt-2"
                  >
                    Published:
                    {{ new Date(result.publishedDate).toLocaleDateString() }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </TextSelectionMenu>
</template>

<script setup lang="ts">
import type { ToolResult } from "../types";
import type { ExaJsonData } from "../models/exa";
import TextSelectionMenu from "../../components/TextSelectionMenu.vue";

defineOptions({
  inheritAttrs: false,
});

const props = defineProps<{
  selectedResult: ToolResult<unknown, ExaJsonData>;
  sendTextMessage: (text?: string) => void;
}>();

defineEmits<{
  updateResult: [];
}>();

const handleLinkClick = (e: MouseEvent, url: string) => {
  if (e.metaKey || e.ctrlKey) {
    // Command/Ctrl key pressed - allow default behavior (open in new tab)
    return;
  }

  // Otherwise, prevent default and tell LLM to browse
  e.preventDefault();
  props.sendTextMessage(`Browse to ${url}`);
};
</script>
