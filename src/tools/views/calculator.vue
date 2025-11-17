<template>
  <div class="w-full h-full overflow-y-auto bg-white dark:bg-gray-900">
    <div class="max-w-2xl mx-auto p-6">
      <div class="mb-6">
        <h2 class="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
          Calculator
        </h2>
      </div>

      <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
        <div class="mb-4">
          <label
            class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            Expression
          </label>
          <div
            class="bg-white dark:bg-gray-900 rounded-lg p-4 font-mono text-lg text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-700"
          >
            {{ expression || "No expression" }}
          </div>
        </div>

        <div
          class="flex items-center justify-center text-3xl text-gray-400 my-4"
        >
          =
        </div>

        <div>
          <label
            class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            Result
          </label>
          <div
            :class="[
              'rounded-lg p-4 font-mono text-2xl border',
              hasError
                ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-300 dark:border-red-700'
                : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-700',
            ]"
          >
            {{ displayResult }}
          </div>
        </div>

        <div
          v-if="hasError"
          class="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
        >
          <p class="text-sm text-red-700 dark:text-red-300">
            <span class="font-semibold">Error:</span> {{ errorMessage }}
          </p>
        </div>

        <div class="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <p class="text-xs text-gray-500 dark:text-gray-500">
            Supports basic arithmetic (+, -, *, /), exponents (^), and advanced
            functions like sqrt(), sin(), cos(), log(), etc.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { ToolResult } from "../types";
import type { CalculatorToolData } from "../models/calculator";

const props = defineProps<{
  selectedResult: ToolResult<CalculatorToolData>;
}>();

const expression = computed(() => props.selectedResult.data?.expression || "");
const result = computed(() => props.selectedResult.data?.result || "");
const errorMessage = computed(() => props.selectedResult.data?.error || "");
const hasError = computed(() => !!errorMessage.value);

const displayResult = computed(() => {
  if (hasError.value) {
    return "Error";
  }
  return result.value;
});
</script>
