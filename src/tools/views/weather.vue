<template>
  <div class="w-full h-full overflow-y-auto bg-white dark:bg-gray-900">
    <div class="max-w-2xl mx-auto p-6">
      <div class="mb-6">
        <h2 class="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-1">
          {{ location }}
        </h2>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          {{ latitude.toFixed(4) }}°N, {{ longitude.toFixed(4) }}°E
        </p>
      </div>

      <div
        v-if="hasError"
        class="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
      >
        <p class="text-red-700 dark:text-red-300">
          <span class="font-semibold">Error:</span> {{ errorMessage }}
        </p>
      </div>

      <div v-else>
        <!-- Current Weather -->
        <div
          class="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 rounded-lg p-6 mb-6"
        >
          <div class="text-center">
            <div
              class="text-5xl font-bold text-blue-600 dark:text-blue-400 mb-2"
            >
              {{ current.temperature }}°C
            </div>
            <div class="text-xl text-gray-700 dark:text-gray-300 mb-4">
              {{ current.weatherDescription }}
            </div>
            <div class="grid grid-cols-2 gap-4 mt-6">
              <div class="bg-white/50 dark:bg-gray-800/50 rounded p-3">
                <div class="text-sm text-gray-600 dark:text-gray-400">
                  Wind Speed
                </div>
                <div
                  class="text-lg font-semibold text-gray-800 dark:text-gray-200"
                >
                  {{ current.windSpeed }} km/h
                </div>
              </div>
              <div class="bg-white/50 dark:bg-gray-800/50 rounded p-3">
                <div class="text-sm text-gray-600 dark:text-gray-400">
                  Humidity
                </div>
                <div
                  class="text-lg font-semibold text-gray-800 dark:text-gray-200"
                >
                  {{ current.humidity }}%
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 7-Day Forecast -->
        <div v-if="hasForecast" class="space-y-2">
          <h3
            class="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3"
          >
            7-Day Forecast
          </h3>
          <div
            v-for="(date, index) in daily!.dates"
            :key="date"
            class="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-lg p-4"
          >
            <div class="flex-1">
              <div class="font-medium text-gray-800 dark:text-gray-200">
                {{ formatDate(date) }}
              </div>
              <div class="text-sm text-gray-600 dark:text-gray-400">
                {{ getWeatherDescription(daily!.weatherCodes[index]) }}
              </div>
            </div>
            <div class="flex items-center gap-4">
              <div class="text-right">
                <div class="text-sm text-gray-600 dark:text-gray-400">High</div>
                <div class="font-semibold text-red-600 dark:text-red-400">
                  {{ daily!.temperatureMax[index] }}°
                </div>
              </div>
              <div class="text-right">
                <div class="text-sm text-gray-600 dark:text-gray-400">Low</div>
                <div class="font-semibold text-blue-600 dark:text-blue-400">
                  {{ daily!.temperatureMin[index] }}°
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { ToolResult } from "../types";
import type { WeatherToolData } from "../models/weather";

const props = defineProps<{
  selectedResult: ToolResult<WeatherToolData>;
}>();

const location = computed(() => props.selectedResult.data?.location || "");
const latitude = computed(() => props.selectedResult.data?.latitude || 0);
const longitude = computed(() => props.selectedResult.data?.longitude || 0);
const current = computed(
  () =>
    props.selectedResult.data?.current || {
      temperature: 0,
      weatherCode: 0,
      weatherDescription: "",
      windSpeed: 0,
      humidity: 0,
    },
);
const daily = computed(() => props.selectedResult.data?.daily);
const errorMessage = computed(() => props.selectedResult.data?.error || "");
const hasError = computed(() => !!errorMessage.value);
const hasForecast = computed(() => !!daily.value);

const weatherCodeDescriptions: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Foggy",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  71: "Slight snow",
  73: "Moderate snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  85: "Slight snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail",
};

function getWeatherDescription(code: number): string {
  return weatherCodeDescriptions[code] || "Unknown";
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === today.toDateString()) {
    return "Today";
  } else if (date.toDateString() === tomorrow.toDateString()) {
    return "Tomorrow";
  } else {
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }
}
</script>
