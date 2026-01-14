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
          d="M4 2a2 2 0 00-2 2v11a3 3 0 106 0V4a2 2 0 00-2-2H4zm1 14a1 1 0 100-2 1 1 0 000 2zm5-1.757l4.9-4.9a2 2 0 000-2.828L13.485 5.1a2 2 0 00-2.828 0L10 5.757v8.486zM16 18H9.071l6-6H16a2 2 0 012 2v2a2 2 0 01-2 2z"
          clip-rule="evenodd"
        />
      </svg>
      <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
        Image Style
      </span>
    </div>

    <div class="text-xs text-gray-600 dark:text-gray-400">
      <div v-if="success" class="space-y-1">
        <div class="flex items-center gap-1">
          <span class="text-green-500">✓</span>
          <span v-if="isClearing" class="font-medium">Style Cleared</span>
          <span v-else class="font-medium">Style Updated</span>
        </div>
        <div v-if="!isClearing" class="mt-1">
          <div class="text-xs text-gray-500 mb-0.5">New style:</div>
          <div
            class="text-xs font-mono bg-white dark:bg-gray-900 p-1 rounded border border-gray-200 dark:border-gray-700"
          >
            {{ styleModifier }}
          </div>
        </div>
        <div v-if="previousStyleModifier && !isClearing" class="mt-1">
          <div class="text-xs text-gray-500 mb-0.5">Previous:</div>
          <div class="text-xs font-mono text-gray-400 line-through">
            {{ previousStyleModifier }}
          </div>
        </div>
      </div>
      <div v-else class="flex items-center gap-1 text-red-500">
        <span>✗</span>
        <span>{{ errorMessage || "Failed to set image style" }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { ToolResult } from "../types";
import type { SetImageStyleJsonData } from "../models/setImageStyle";

const props = defineProps<{
  result: ToolResult<unknown, SetImageStyleJsonData>;
}>();

const success = computed(() => props.result.jsonData?.success || false);
const styleModifier = computed(
  () => props.result.jsonData?.styleModifier || "",
);
const previousStyleModifier = computed(
  () => props.result.jsonData?.previousStyleModifier || "",
);
const isClearing = computed(() => styleModifier.value === "");
const errorMessage = computed(() => props.result.jsonData?.error);
</script>
