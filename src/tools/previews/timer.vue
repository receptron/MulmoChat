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
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
          clip-rule="evenodd"
        />
      </svg>
      <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
        Timers
      </span>
    </div>

    <div class="text-xs text-gray-600 dark:text-gray-400">
      <div v-if="timers.length === 0">No timers</div>
      <div v-else>
        <div class="mb-1">
          {{ runningCount }} running, {{ completedCount }} completed
        </div>
        <div class="space-y-1 max-h-20 overflow-y-auto">
          <div
            v-for="timer in timers.slice(0, 3)"
            :key="timer.id"
            class="flex items-center justify-between text-xs"
          >
            <span class="truncate flex-1 mr-2">{{ timer.name }}</span>
            <span
              v-if="timer.status === 'running'"
              class="font-mono text-blue-600 dark:text-blue-400 whitespace-nowrap"
            >
              {{ formatTimeRemaining(timer.endTime) }}
            </span>
            <span v-else class="text-green-600 dark:text-green-400">✓</span>
          </div>
          <div v-if="timers.length > 3" class="text-gray-500 italic">
            +{{ timers.length - 3 }} more...
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from "vue";
import type { ToolResult } from "../types";
import type { TimerToolData } from "../models/timer";

const props = defineProps<{
  result: ToolResult<TimerToolData>;
}>();

const now = ref(Date.now());
let intervalId: number | null = null;

onMounted(() => {
  intervalId = window.setInterval(() => {
    now.value = Date.now();
  }, 1000);
});

onUnmounted(() => {
  if (intervalId !== null) {
    clearInterval(intervalId);
  }
});

const timers = computed(() => {
  const rawTimers = props.result.data?.timers || [];
  // Update completed status
  return rawTimers.map((timer) => {
    if (timer.status === "running" && now.value >= timer.endTime) {
      return { ...timer, status: "completed" as const };
    }
    return timer;
  });
});

const runningCount = computed(
  () => timers.value.filter((timer) => timer.status === "running").length,
);

const completedCount = computed(
  () => timers.value.filter((timer) => timer.status === "completed").length,
);

function formatTimeRemaining(endTime: number): string {
  const remaining = Math.max(0, Math.floor((endTime - now.value) / 1000));
  const hours = Math.floor(remaining / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const secs = remaining % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  } else if (minutes > 0) {
    return `${minutes}:${String(secs).padStart(2, "0")}`;
  } else {
    return `${secs}s`;
  }
}
</script>
