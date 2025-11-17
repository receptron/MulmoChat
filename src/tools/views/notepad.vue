<template>
  <div class="w-full h-full overflow-y-auto bg-white dark:bg-gray-900">
    <div class="max-w-4xl mx-auto p-6">
      <div class="mb-6">
        <h2 class="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
          Notes
        </h2>
        <div class="text-sm text-gray-600 dark:text-gray-400">
          <span
            >{{ notes.length }} note{{ notes.length !== 1 ? "s" : "" }}</span
          >
        </div>
      </div>

      <!-- Current Note View -->
      <div
        v-if="currentNote"
        class="mb-6 bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-300 dark:border-yellow-700 rounded-lg p-6"
      >
        <div class="flex items-start justify-between mb-4">
          <div>
            <h3
              class="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-2"
            >
              {{ currentNote.title }}
            </h3>
            <div class="text-xs text-gray-600 dark:text-gray-400">
              <span>Created: {{ formatDate(currentNote.createdAt) }}</span>
              <span
                v-if="currentNote.updatedAt !== currentNote.createdAt"
                class="ml-3"
              >
                Updated: {{ formatDate(currentNote.updatedAt) }}
              </span>
            </div>
          </div>
          <button
            @click="deleteNote(currentNote.id)"
            class="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-2"
            title="Delete note"
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
        <div class="prose dark:prose-invert max-w-none">
          <div
            class="whitespace-pre-wrap text-gray-800 dark:text-gray-200 leading-relaxed"
          >
            {{ currentNote.content }}
          </div>
        </div>
      </div>

      <!-- Notes List -->
      <div v-if="notes.length === 0" class="text-center py-12">
        <div class="text-gray-400 dark:text-gray-600 text-lg">No notes yet</div>
        <div class="text-gray-500 dark:text-gray-500 text-sm mt-2">
          Ask the assistant to create a note!
        </div>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          v-for="note in sortedNotes"
          :key="note.id"
          @click="selectNote(note)"
          :class="[
            'group cursor-pointer p-4 rounded-lg border-2 transition-all hover:shadow-md',
            currentNote?.id === note.id
              ? 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-400 dark:border-yellow-600'
              : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600',
          ]"
        >
          <div class="flex items-start justify-between mb-2">
            <h3
              class="font-semibold text-gray-800 dark:text-gray-200 text-lg truncate flex-1"
            >
              {{ note.title }}
            </h3>
            <button
              @click.stop="deleteNote(note.id)"
              class="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-opacity p-1"
              title="Delete note"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fill-rule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clip-rule="evenodd"
                />
              </svg>
            </button>
          </div>
          <p class="text-sm text-gray-600 dark:text-gray-400 line-clamp-3">
            {{ note.content }}
          </p>
          <p class="text-xs text-gray-500 dark:text-gray-500 mt-2">
            {{ formatDate(note.updatedAt) }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { ToolResult } from "../types";
import type { NotepadToolData, NoteItem } from "../models/notepad";

const STORAGE_KEY = "mulmo_notes";

const props = defineProps<{
  selectedResult: ToolResult<NotepadToolData>;
}>();

const notes = ref<NoteItem[]>([...(props.selectedResult.data?.notes || [])]);
const currentNote = ref<NoteItem | undefined>(
  props.selectedResult.data?.currentNote,
);

// Watch for changes from the plugin execution
watch(
  () => props.selectedResult.data,
  (newData) => {
    if (newData) {
      notes.value = [...(newData.notes || [])];
      if (newData.currentNote) {
        currentNote.value = newData.currentNote;
      }
    }
  },
  { deep: true },
);

const sortedNotes = computed(() => {
  return [...notes.value].sort((a, b) => b.updatedAt - a.updatedAt);
});

function saveNotes(noteItems: NoteItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(noteItems));
  } catch (error) {
    console.error("Error saving notes:", error);
  }
}

function selectNote(note: NoteItem): void {
  currentNote.value = note;
}

function deleteNote(id: string): void {
  notes.value = notes.value.filter((note) => note.id !== id);
  if (currentNote.value?.id === id) {
    currentNote.value = undefined;
  }
  saveNotes(notes.value);
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
