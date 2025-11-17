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
          d="M5.5 16a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.977A4.5 4.5 0 1113.5 16h-8z"
        />
      </svg>
      <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
        Weather
      </span>
    </div>

    <div class="text-xs text-gray-600 dark:text-gray-400">
      <div class="font-medium mb-1 truncate">{{ location }}</div>
      <div v-if="!hasError" class="flex items-center justify-between">
        <div class="text-2xl font-bold text-blue-600 dark:text-blue-400">
          {{ current.temperature }}°C
        </div>
        <div class="text-right">
          <div class="truncate text-xs">{{ current.weatherDescription }}</div>
          <div class="text-gray-500 dark:text-gray-500">
            {{ current.humidity }}% • {{ current.windSpeed }} km/h
          </div>
        </div>
      </div>
      <div v-else class="text-red-600 dark:text-red-400">
        Error loading weather
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { ToolResult } from "../types";
import type { WeatherToolData } from "../models/weather";

const props = defineProps<{
  result: ToolResult<WeatherToolData>;
}>();

const location = computed(() => props.result.data?.location || "");
const current = computed(
  () =>
    props.result.data?.current || {
      temperature: 0,
      weatherCode: 0,
      weatherDescription: "",
      windSpeed: 0,
      humidity: 0,
    },
);
const errorMessage = computed(() => props.result.data?.error || "");
const hasError = computed(() => !!errorMessage.value);
</script>
