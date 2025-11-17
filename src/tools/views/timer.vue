<template>
  <div class="w-full h-full overflow-y-auto bg-white dark:bg-gray-900">
    <div class="max-w-2xl mx-auto p-6">
      <div class="mb-6">
        <h2 class="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
          Timers
        </h2>
        <div class="text-sm text-gray-600 dark:text-gray-400">
          <span
            >{{ runningCount }} running, {{ completedCount }} completed</span
          >
        </div>
      </div>

      <div v-if="timers.length === 0" class="text-center py-12">
        <div class="text-gray-400 dark:text-gray-600 text-lg">
          No timers yet
        </div>
        <div class="text-gray-500 dark:text-gray-500 text-sm mt-2">
          Ask the assistant to create a timer!
        </div>
      </div>

      <div v-else class="space-y-3">
        <div
          v-for="timer in timers"
          :key="timer.id"
          :class="[
            'group p-4 rounded-lg border-2 transition-all',
            timer.status === 'completed'
              ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
              : 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700',
          ]"
        >
          <div class="flex items-start justify-between mb-2">
            <div class="flex-1">
              <h3
                class="font-semibold text-gray-800 dark:text-gray-200 text-lg"
              >
                {{ timer.name }}
              </h3>
              <p class="text-sm text-gray-600 dark:text-gray-400">
                {{ formatDuration(timer.duration) }}
              </p>
            </div>
            <button
              @click="cancelTimer(timer.id)"
              class="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-opacity p-1"
              title="Cancel timer"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5"
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

          <div v-if="timer.status === 'running'">
            <div class="mb-2">
              <div class="flex justify-between text-sm mb-1">
                <span class="text-gray-600 dark:text-gray-400"
                  >Time remaining</span
                >
                <span
                  class="font-mono font-semibold text-blue-600 dark:text-blue-400"
                >
                  {{ formatTimeRemaining(timer.endTime) }}
                </span>
              </div>
              <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  class="bg-blue-600 dark:bg-blue-400 h-2 rounded-full transition-all duration-1000"
                  :style="{ width: `${getProgress(timer)}%` }"
                ></div>
              </div>
            </div>
          </div>

          <div
            v-else-if="timer.status === 'completed'"
            class="flex items-center gap-2 text-green-600 dark:text-green-400 font-semibold"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fill-rule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clip-rule="evenodd"
              />
            </svg>
            <span>Completed</span>
          </div>
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
          Clear completed timers
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from "vue";
import type { ToolResult } from "../types";
import type { TimerToolData, TimerItem } from "../models/timer";

const STORAGE_KEY = "mulmo_timers";

const props = defineProps<{
  selectedResult: ToolResult<TimerToolData>;
}>();

const timers = ref<TimerItem[]>([...(props.selectedResult.data?.timers || [])]);
const now = ref(Date.now());
let intervalId: number | null = null;

// Watch for changes from the plugin execution
watch(
  () => props.selectedResult.data?.timers,
  (newTimers) => {
    if (newTimers) {
      timers.value = [...newTimers];
    }
  },
  { deep: true },
);

onMounted(() => {
  // Update current time every second
  intervalId = window.setInterval(() => {
    now.value = Date.now();
    // Update completed status
    timers.value = timers.value.map((timer) => {
      if (timer.status === "running" && now.value >= timer.endTime) {
        return { ...timer, status: "completed" as const };
      }
      return timer;
    });
    saveTimers(timers.value);
  }, 1000);
});

onUnmounted(() => {
  if (intervalId !== null) {
    clearInterval(intervalId);
  }
});

const runningCount = computed(
  () => timers.value.filter((timer) => timer.status === "running").length,
);

const completedCount = computed(
  () => timers.value.filter((timer) => timer.status === "completed").length,
);

function saveTimers(timerItems: TimerItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(timerItems));
  } catch (error) {
    console.error("Error saving timers:", error);
  }
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

function formatTimeRemaining(endTime: number): string {
  const remaining = Math.max(0, Math.floor((endTime - now.value) / 1000));
  return formatDuration(remaining);
}

function getProgress(timer: TimerItem): number {
  const elapsed = now.value - timer.startTime;
  const total = timer.endTime - timer.startTime;
  const progress = 100 - (elapsed / total) * 100;
  return Math.max(0, Math.min(100, progress));
}

function cancelTimer(id: string): void {
  timers.value = timers.value.filter((timer) => timer.id !== id);
  saveTimers(timers.value);
}

function clearCompleted(): void {
  timers.value = timers.value.filter((timer) => timer.status !== "completed");
  saveTimers(timers.value);
}
</script>
