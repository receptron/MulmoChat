<template>
  <div class="w-full h-full overflow-y-auto bg-white dark:bg-gray-900">
    <div class="max-w-2xl mx-auto p-6">
      <div class="mb-6">
        <h2 class="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
          Todo List
        </h2>
        <div class="text-sm text-gray-600 dark:text-gray-400">
          <span>{{ completedCount }} of {{ totalCount }} completed</span>
        </div>
      </div>

      <div v-if="items.length === 0" class="text-center py-12">
        <div class="text-gray-400 dark:text-gray-600 text-lg">
          No todo items yet
        </div>
        <div class="text-gray-500 dark:text-gray-500 text-sm mt-2">
          Ask the assistant to add some tasks!
        </div>
      </div>

      <div v-else class="space-y-2">
        <div
          v-for="item in items"
          :key="item.id"
          class="group flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          <input
            type="checkbox"
            :checked="item.completed"
            @change="toggleItem(item.id)"
            class="mt-1 h-5 w-5 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
          />
          <div class="flex-1 min-w-0">
            <p
              :class="[
                'text-white break-words',
                item.completed
                  ? 'line-through text-gray-500 dark:text-gray-500'
                  : '',
              ]"
            >
              {{ item.text }}
            </p>
            <p class="text-xs text-gray-500 dark:text-gray-500 mt-1">
              {{ formatDate(item.createdAt) }}
            </p>
          </div>
          <button
            @click="deleteItem(item.id)"
            class="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-opacity p-1"
            title="Delete item"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fill-rule="evenodd"
                d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                clip-rule="evenodd"
              />
            </svg>
          </button>
        </div>
      </div>

      <div
        v-if="completedCount > 0"
        class="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700"
      >
        <button
          @click="clearCompleted"
          class="text-sm text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
        >
          Clear completed items
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { ToolResult } from "gui-chat-protocol/vue";
import type { TodoToolData, TodoItem } from "../models/todo";

const STORAGE_KEY = "mulmo_todo_list";

const props = defineProps<{
  selectedResult: ToolResult<TodoToolData>;
}>();

// Local state for items (synced with localStorage)
const items = ref<TodoItem[]>([...(props.selectedResult.data?.items || [])]);

// Watch for changes from the plugin execution
watch(
  () => props.selectedResult.data?.items,
  (newItems) => {
    if (newItems) {
      items.value = [...newItems];
    }
  },
  { deep: true },
);

const totalCount = computed(() => items.value.length);
const completedCount = computed(
  () => items.value.filter((item) => item.completed).length,
);

function loadTodos(): TodoItem[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error("Error loading todos:", error);
  }
  return [];
}

function saveTodos(todoItems: TodoItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todoItems));
  } catch (error) {
    console.error("Error saving todos:", error);
  }
}

function toggleItem(id: string): void {
  const item = items.value.find((i) => i.id === id);
  if (item) {
    item.completed = !item.completed;
    saveTodos(items.value);
  }
}

function deleteItem(id: string): void {
  items.value = items.value.filter((item) => item.id !== id);
  saveTodos(items.value);
}

function clearCompleted(): void {
  items.value = items.value.filter((item) => !item.completed);
  saveTodos(items.value);
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins} min${diffMins !== 1 ? "s" : ""} ago`;
  if (diffHours < 24)
    return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;

  return date.toLocaleDateString();
}
</script>
