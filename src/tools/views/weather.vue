<template>
  <div class="w-full h-full overflow-auto bg-gradient-to-br from-blue-50 to-indigo-50">
    <div class="max-w-4xl mx-auto p-6">
      <!-- Header -->
      <div class="bg-white rounded-lg shadow-md p-6 mb-6">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-3xl font-bold text-gray-800 mb-2">
              {{ areaName }}
            </h1>
            <div class="text-sm text-gray-600">
              <div v-if="publishingOffice">{{ publishingOffice }}</div>
              <div v-if="reportDatetime">{{ formattedReportDate }}</div>
            </div>
          </div>
          <div class="text-6xl">⛅</div>
        </div>
      </div>

      <!-- No data message -->
      <div
        v-if="!weatherData"
        class="bg-white rounded-lg shadow-md p-6 text-center text-gray-600"
      >
        No weather data available
      </div>

      <!-- Weather forecast sections -->
      <div v-else class="space-y-6">
        <!-- Time series forecast -->
        <div
          v-for="(series, index) in weatherData.timeSeries"
          :key="index"
          class="bg-white rounded-lg shadow-md p-6"
        >
          <h2 class="text-xl font-semibold text-gray-800 mb-4">
            {{ getSeriesTitle(index) }}
          </h2>

          <!-- Forecast for each area in this time series -->
          <div
            v-for="(area, areaIndex) in series.areas"
            :key="areaIndex"
            class="mb-6 last:mb-0"
          >
            <h3 class="text-lg font-medium text-gray-700 mb-3">
              {{ area.area.name }}
            </h3>

            <!-- Weather details grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <!-- Time periods -->
              <div
                v-for="(time, timeIndex) in series.timeDefines"
                :key="timeIndex"
                class="bg-gray-50 rounded-lg p-4"
              >
                <div class="text-sm font-medium text-gray-600 mb-2">
                  {{ formatDateTime(time) }}
                </div>

                <!-- Weather -->
                <div v-if="area.weathers && area.weathers[timeIndex]" class="mb-2">
                  <span class="text-2xl mr-2">{{
                    getWeatherEmoji(area.weathers[timeIndex])
                  }}</span>
                  <span class="text-gray-800">{{ area.weathers[timeIndex] }}</span>
                </div>

                <!-- Temperature -->
                <div v-if="area.temps && area.temps[timeIndex]" class="text-gray-700">
                  <span class="font-semibold">Temperature:</span>
                  {{ area.temps[timeIndex] }}°C
                </div>

                <!-- Min/Max Temperature -->
                <div
                  v-if="area.tempsMin && area.tempsMin[timeIndex]"
                  class="text-gray-700"
                >
                  <span class="font-semibold">Min:</span>
                  {{ area.tempsMin[timeIndex] }}°C
                </div>
                <div
                  v-if="area.tempsMax && area.tempsMax[timeIndex]"
                  class="text-gray-700"
                >
                  <span class="font-semibold">Max:</span>
                  {{ area.tempsMax[timeIndex] }}°C
                </div>

                <!-- Precipitation Probability -->
                <div v-if="area.pops && area.pops[timeIndex]" class="text-gray-700">
                  <span class="font-semibold">Rain:</span>
                  {{ area.pops[timeIndex] }}%
                </div>

                <!-- Wind -->
                <div v-if="area.winds && area.winds[timeIndex]" class="text-gray-700">
                  <span class="font-semibold">Wind:</span>
                  {{ area.winds[timeIndex] }}
                </div>

                <!-- Waves -->
                <div v-if="area.waves && area.waves[timeIndex]" class="text-gray-700">
                  <span class="font-semibold">Waves:</span>
                  {{ area.waves[timeIndex] }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Temperature/Precipitation Averages -->
        <div
          v-if="weatherData.tempAverage || weatherData.precipAverage"
          class="bg-white rounded-lg shadow-md p-6"
        >
          <h2 class="text-xl font-semibold text-gray-800 mb-4">
            Historical Averages
          </h2>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Temperature Average -->
            <div v-if="weatherData.tempAverage" class="bg-gray-50 rounded-lg p-4">
              <h3 class="font-medium text-gray-700 mb-2">Temperature</h3>
              <div
                v-for="(area, index) in weatherData.tempAverage.areas"
                :key="index"
                class="text-gray-600 text-sm"
              >
                <div class="font-medium">{{ area.area.name }}</div>
                <div v-if="area.min">Min: {{ area.min }}°C</div>
                <div v-if="area.max">Max: {{ area.max }}°C</div>
              </div>
            </div>

            <!-- Precipitation Average -->
            <div
              v-if="weatherData.precipAverage"
              class="bg-gray-50 rounded-lg p-4"
            >
              <h3 class="font-medium text-gray-700 mb-2">Precipitation</h3>
              <div
                v-for="(area, index) in weatherData.precipAverage.areas"
                :key="index"
                class="text-gray-600 text-sm"
              >
                <div class="font-medium">{{ area.area.name }}</div>
                <div v-if="area.min">Min: {{ area.min }}mm</div>
                <div v-if="area.max">Max: {{ area.max }}mm</div>
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
import type { WeatherToolData, WeatherJsonData } from "../models/weather";

const props = defineProps<{
  selectedResult: ToolResult<WeatherToolData, WeatherJsonData> | null;
  sendTextMessage: (text?: string) => void;
}>();

const areaName = computed(() => {
  return props.selectedResult?.data?.areaName || "Unknown Area";
});

const publishingOffice = computed(() => {
  return props.selectedResult?.data?.publishingOffice || "";
});

const reportDatetime = computed(() => {
  return props.selectedResult?.data?.reportDatetime || "";
});

const weatherData = computed(() => {
  return props.selectedResult?.jsonData || null;
});

const formattedReportDate = computed(() => {
  if (!reportDatetime.value) return "";
  const date = new Date(reportDatetime.value);
  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
});

function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const dateStr = date.toLocaleDateString("ja-JP", {
    month: "short",
    day: "numeric",
  });

  const timeStr = date.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  });

  // Check if it's today or tomorrow
  if (date.toDateString() === now.toDateString()) {
    return `Today ${timeStr}`;
  } else if (date.toDateString() === tomorrow.toDateString()) {
    return `Tomorrow ${timeStr}`;
  }

  return `${dateStr} ${timeStr}`;
}

function getSeriesTitle(index: number): string {
  const titles = ["Current Forecast", "Extended Forecast", "Weekly Forecast"];
  return titles[index] || `Forecast ${index + 1}`;
}

function getWeatherEmoji(weather: string): string {
  if (!weather) return "🌤️";

  const w = weather.toLowerCase();
  if (w.includes("晴") || w.includes("sunny") || w.includes("clear")) return "☀️";
  if (w.includes("曇") || w.includes("cloudy")) return "☁️";
  if (w.includes("雨") || w.includes("rain")) return "🌧️";
  if (w.includes("雪") || w.includes("snow")) return "❄️";
  if (w.includes("雷") || w.includes("thunder")) return "⛈️";
  if (w.includes("霧") || w.includes("fog")) return "🌫️";

  return "🌤️";
}
</script>
