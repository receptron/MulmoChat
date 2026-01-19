<template>
  <div class="w-full h-full overflow-y-auto">
    <div class="min-h-full flex flex-col items-center justify-center p-4">
      <div class="flex-1 flex items-center justify-center min-h-0">
        <img
          :src="selectedResult.data?.imageData"
          class="max-w-full max-h-full object-contain rounded"
          alt="Current generated image"
        />
      </div>
      <div
        v-if="selectedResult.data?.prompt"
        class="mt-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg max-w-full flex-shrink-0"
      >
        <p class="text-sm text-gray-700 dark:text-gray-300">
          <span class="font-medium">Prompt:</span>
          {{ selectedResult.data.prompt }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ToolResult } from "gui-chat-protocol/vue";
import type { ImageToolData } from "../utils";

defineProps<{
  selectedResult: ToolResult<ImageToolData>;
}>();
</script>
