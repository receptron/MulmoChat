<template>
  <div class="p-2 bg-gray-50 dark:bg-gray-800 rounded">
    <div class="flex items-center gap-2 mb-2">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-4 w-4 text-blue-600 dark:text-blue-400"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
        <path
          fill-rule="evenodd"
          d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z"
          clip-rule="evenodd"
        />
      </svg>
      <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
        Todo List
      </span>
    </div>

    <div class="text-xs text-gray-600 dark:text-gray-400">
      <div v-if="items.length === 0">No items</div>
      <div v-else>
        <div class="mb-1">{{ completedCount }}/{{ totalCount }} completed</div>
        <div class="space-y-1 max-h-20 overflow-y-auto">
          <div
            v-for="item in items.slice(0, 3)"
            :key="item.id"
            class="flex items-start gap-1 text-xs"
          >
            <span v-if="item.completed" class="text-green-500">✓</span>
            <span v-else class="text-gray-400">○</span>
            <span
              :class="[
                'flex-1 truncate',
                item.completed ? 'line-through text-gray-500' : '',
              ]"
            >
              {{ item.text }}
            </span>
          </div>
          <div v-if="items.length > 3" class="text-gray-500 italic">
            +{{ items.length - 3 }} more...
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { ToolResult } from "gui-chat-protocol/vue";
import type { TodoToolData } from "../models/todo";

const props = defineProps<{
  result: ToolResult<TodoToolData>;
}>();

const items = computed(() => props.result.data?.items || []);
const totalCount = computed(() => items.value.length);
const completedCount = computed(
  () => items.value.filter((item) => item.completed).length,
);
</script>
