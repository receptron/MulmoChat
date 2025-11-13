<template>
  <div class="text-center p-4 bg-blue-50 dark:bg-blue-900 rounded">
    <div class="text-blue-600 dark:text-blue-300 font-medium">
      <span class="material-icons" style="font-size: 2rem">view_in_ar</span>
    </div>
    <div
      class="text-sm text-gray-800 dark:text-gray-200 mt-1 font-medium truncate"
    >
      {{ displayTitle }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { ToolResult } from "../types";
import type { Present3DToolData } from "../models/present3D";

const props = defineProps<{
  result: ToolResult<Present3DToolData>;
}>();

const displayTitle = computed(() => {
  return props.result.title || "3D Visualization";
});
</script>
