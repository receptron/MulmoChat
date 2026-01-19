<template>
  <div class="p-2 bg-gray-50 dark:bg-gray-800 rounded">
    <div class="flex items-center gap-2 mb-2">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-4 w-4 text-purple-600 dark:text-purple-400"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fill-rule="evenodd"
          d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
          clip-rule="evenodd"
        />
      </svg>
      <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
        Role Switch
      </span>
    </div>

    <div class="text-xs text-gray-600 dark:text-gray-400">
      <div v-if="success" class="space-y-1">
        <div class="flex items-center gap-1">
          <span class="text-green-500">✓</span>
          <span class="font-medium">{{ roleName }}</span>
        </div>
        <div class="text-xs text-gray-500">Switched to {{ roleName }} role</div>
      </div>
      <div v-else class="flex items-center gap-1 text-red-500">
        <span>✗</span>
        <span>{{ errorMessage || "Failed to switch role" }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { ToolResult } from "gui-chat-protocol/vue";
import type { SwitchRoleJsonData } from "../models/switchRole";

const props = defineProps<{
  result: ToolResult<unknown, SwitchRoleJsonData>;
}>();

const success = computed(() => props.result.jsonData?.success || false);
const roleName = computed(() => props.result.jsonData?.roleName || "Unknown");
const errorMessage = computed(() => props.result.jsonData?.error);
</script>
