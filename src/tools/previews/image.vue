<template>
  <img
    v-if="result.imageData"
    :src="`data:image/png;base64,${result.imageData}`"
    class="max-w-full h-auto rounded"
    alt="Generated image"
  />
</template>

<script setup lang="ts">
import type { ToolResult } from "../type";

defineProps<{
  result: ToolResult;
}>();
</script>
