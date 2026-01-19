<template>
  <div class="min-h-[100px] flex items-center justify-center">
    <img
      v-if="result.data?.imageData"
      :src="result.data.imageData"
      class="max-w-full h-auto rounded"
      alt="Generated image"
    />
    <div v-else class="text-gray-400 text-sm">No image yet</div>
  </div>
</template>

<script setup lang="ts">
import type { ToolResult } from "gui-chat-protocol/vue";
import type { ImageToolData } from "../utils";

defineProps<{
  result: ToolResult<ImageToolData>;
}>();
</script>
