<template>
  <div class="p-2 bg-gray-50 dark:bg-gray-800 rounded">
    <div class="flex items-center gap-2 mb-2">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-4 w-4 text-yellow-600 dark:text-yellow-400"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          d="M9 2a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V6.414A2 2 0 0016.414 5L14 2.586A2 2 0 0012.586 2H9z"
        />
        <path d="M3 8a2 2 0 012-2v10h8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
      </svg>
      <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
        Notes
      </span>
    </div>

    <div class="text-xs text-gray-600 dark:text-gray-400">
      <div v-if="notes.length === 0">No notes</div>
      <div v-else>
        <div class="mb-1">
          {{ notes.length }} note{{ notes.length !== 1 ? "s" : "" }}
        </div>
        <div v-if="currentNote" class="space-y-1">
          <div class="font-medium text-gray-800 dark:text-gray-200 truncate">
            {{ currentNote.title }}
          </div>
          <div class="text-xs text-gray-500 dark:text-gray-500 line-clamp-2">
            {{ currentNote.content }}
          </div>
        </div>
        <div v-else class="space-y-1 max-h-16 overflow-y-auto">
          <div
            v-for="note in notes.slice(0, 3)"
            :key="note.id"
            class="truncate text-xs"
          >
            • {{ note.title }}
          </div>
          <div v-if="notes.length > 3" class="text-gray-500 italic">
            +{{ notes.length - 3 }} more...
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { ToolResult } from "../types";
import type { NotepadToolData } from "../models/notepad";

const props = defineProps<{
  result: ToolResult<NotepadToolData>;
}>();

const notes = computed(() => props.result.data?.notes || []);
const currentNote = computed(() => props.result.data?.currentNote);
</script>
