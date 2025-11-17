<template>
  <div class="p-2 bg-gray-50 dark:bg-gray-800 rounded">
    <div class="flex items-center gap-2 mb-2">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-4 w-4 text-blue-600 dark:text-blue-400"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fill-rule="evenodd"
          d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4a2 2 0 00-2-2H6zm1 2a1 1 0 000 2h6a1 1 0 100-2H7zm6 7a1 1 0 011 1v3a1 1 0 11-2 0v-3a1 1 0 011-1zm-3 3a1 1 0 100 2h.01a1 1 0 100-2H10zm-4 1a1 1 0 011-1h.01a1 1 0 110 2H7a1 1 0 01-1-1zm1-4a1 1 0 100 2h.01a1 1 0 100-2H7zm2 1a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1zm4-4a1 1 0 100 2h.01a1 1 0 100-2H13zM9 9a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1zM7 8a1 1 0 000 2h.01a1 1 0 000-2H7z"
          clip-rule="evenodd"
        />
      </svg>
      <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
        Calculator
      </span>
    </div>

    <div class="text-xs text-gray-600 dark:text-gray-400">
      <div class="font-mono mb-1 truncate">{{ expression }}</div>
      <div
        :class="[
          'font-mono font-semibold',
          hasError
            ? 'text-red-600 dark:text-red-400'
            : 'text-blue-600 dark:text-blue-400',
        ]"
      >
        = {{ displayResult }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { ToolResult } from "../types";
import type { CalculatorToolData } from "../models/calculator";

const props = defineProps<{
  result: ToolResult<CalculatorToolData>;
}>();

const expression = computed(() => props.result.data?.expression || "");
const result = computed(() => props.result.data?.result || "");
const errorMessage = computed(() => props.result.data?.error || "");
const hasError = computed(() => !!errorMessage.value);

const displayResult = computed(() => {
  if (hasError.value) {
    return "Error";
  }
  if (typeof result.value === "number") {
    return result.value.toLocaleString();
  }
  return result.value;
});
</script>
