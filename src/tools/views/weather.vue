<template>
  <div
    class="w-full h-full overflow-auto bg-gradient-to-br from-sky-100 via-blue-50 to-indigo-100"
  >
    <div class="max-w-6xl mx-auto p-6">
      <!-- Header -->
      <div
        class="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl shadow-xl p-8 mb-8 text-white"
      >
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-4xl font-bold mb-2">
              {{ areaName }}
            </h1>
            <div class="text-sm opacity-90">
              <div v-if="publishingOffice">{{ publishingOffice }}</div>
              <div v-if="reportDatetime">{{ formattedReportDate }}</div>
            </div>
          </div>
          <div class="text-8xl drop-shadow-lg">⛅</div>
        </div>
      </div>

      <!-- No data message -->
      <div
        v-if="!weatherData"
        class="bg-white rounded-2xl shadow-lg p-8 text-center text-gray-600"
      >
        No weather data available
      </div>

      <!-- Weather forecast sections -->
      <div v-else class="space-y-8">
        <!-- Time series forecast -->
        <div
          v-for="(series, index) in weatherData.timeSeries"
          :key="index"
          :class="[
            'rounded-2xl shadow-xl p-6',
            index === 1 ? 'bg-gradient-to-br from-orange-50 via-pink-50 to-purple-50' : 'bg-white'
          ]"
        >
          <h2
            :class="[
              'text-2xl font-bold mb-6 flex items-center gap-2',
              index === 1 ? 'text-purple-800' : 'text-gray-800'
            ]"
          >
            <span v-if="index === 1" class="text-3xl">📅</span>
            <span v-else-if="index === 0" class="text-3xl">🌤️</span>
            <span v-else class="text-3xl">📊</span>
            {{ getSeriesTitle(index) }}
          </h2>

          <!-- Forecast for each area in this time series -->
          <div
            v-for="(area, areaIndex) in series.areas"
            :key="areaIndex"
            class="mb-6 last:mb-0"
          >
            <h3
              v-if="series.areas.length > 1"
              class="text-lg font-semibold text-gray-700 mb-4"
            >
              {{ area.area.name }}
            </h3>

            <!-- Extended Forecast (index === 1) - Special TV-style design -->
            <div v-if="index === 1">
              <!-- Daily forecast cards -->
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4 mb-8">
                <!-- Time periods -->
                <div
                  v-for="(time, timeIndex) in series.timeDefines"
                  :key="timeIndex"
                  class="relative bg-white rounded-xl p-5 shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105 border-2 border-transparent hover:border-purple-300"
                >
                  <!-- Day of week badge -->
                  <div
                    class="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-1 rounded-full text-xs font-bold shadow-md"
                  >
                    {{ getDayOfWeek(time) }}
                  </div>

                  <!-- Date and Time -->
                  <div class="text-center mt-3 mb-3">
                    <div class="text-sm font-medium text-gray-600">
                      {{ formatDateTime(time) }}
                    </div>
                  </div>

                  <!-- Weather icon (large) -->
                  <div
                    v-if="area.weathers && area.weathers[timeIndex]"
                    class="text-center mb-3"
                  >
                    <div class="text-6xl mb-2 drop-shadow-lg">
                      {{ getWeatherEmoji(area.weathers[timeIndex]) }}
                    </div>
                    <div class="text-xs text-gray-700 font-medium">
                      {{ area.weathers[timeIndex] }}
                    </div>
                  </div>

                  <!-- Precipitation probability icon (sunny/rainy) -->
                  <div
                    v-if="area.pops && area.pops[timeIndex]"
                    class="text-center mb-3"
                  >
                    <div class="flex items-center justify-center gap-2 mb-1">
                      <span class="text-3xl">{{ getPrecipitationIcon(area.pops[timeIndex]) }}</span>
                      <span class="text-2xl font-bold text-blue-600">{{ area.pops[timeIndex] }}%</span>
                    </div>
                  </div>

                  <!-- Temperature (large and colorful) -->
                  <div class="text-center mb-3">
                    <div
                      v-if="area.tempsMax && area.tempsMax[timeIndex]"
                      class="text-3xl font-bold text-red-500 mb-1"
                    >
                      {{ area.tempsMax[timeIndex] }}°
                    </div>
                    <div
                      v-if="area.tempsMin && area.tempsMin[timeIndex]"
                      class="text-xl font-semibold text-blue-500"
                    >
                      {{ area.tempsMin[timeIndex] }}°
                    </div>
                    <div
                      v-if="area.temps && area.temps[timeIndex]"
                      class="text-2xl font-bold text-orange-500"
                    >
                      {{ area.temps[timeIndex] }}°
                    </div>
                  </div>

                  <!-- Wind -->
                  <div
                    v-if="area.winds && area.winds[timeIndex]"
                    class="text-xs text-gray-600 mb-1 text-center"
                  >
                    <span class="mr-1">🌬️</span>
                    {{ area.winds[timeIndex] }}
                  </div>

                  <!-- Waves -->
                  <div
                    v-if="area.waves && area.waves[timeIndex]"
                    class="text-xs text-gray-600 text-center"
                  >
                    <span class="mr-1">🌊</span>
                    {{ area.waves[timeIndex] }}
                  </div>
                </div>
              </div>

              <!-- Temperature chart -->
              <div
                v-if="hasTemperatureData(area)"
                class="bg-white rounded-xl p-6 shadow-lg"
              >
                <h3 class="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <span class="text-2xl">📈</span>
                  気温の推移
                </h3>
                <TemperatureChart
                  :times="series.timeDefines"
                  :tempsMax="area.tempsMax"
                  :tempsMin="area.tempsMin"
                  :temps="area.temps"
                />
              </div>
            </div>

            <!-- Current/Other Forecasts - Improved design -->
            <div
              v-else
              class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
            >
              <!-- Time periods -->
              <div
                v-for="(time, timeIndex) in series.timeDefines"
                :key="timeIndex"
                class="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-5 shadow-md hover:shadow-xl transition-all duration-300 border border-blue-100"
              >
                <div class="text-sm font-bold text-blue-700 mb-3">
                  {{ formatDateTime(time) }}
                </div>

                <!-- Weather -->
                <div
                  v-if="area.weathers && area.weathers[timeIndex]"
                  class="mb-3 flex items-center gap-2"
                >
                  <span class="text-4xl drop-shadow">{{
                    getWeatherEmoji(area.weathers[timeIndex])
                  }}</span>
                  <span class="text-gray-800 font-medium text-sm">{{
                    area.weathers[timeIndex]
                  }}</span>
                </div>

                <!-- Temperature -->
                <div
                  v-if="area.temps && area.temps[timeIndex]"
                  class="text-gray-700 mb-2"
                >
                  <span class="font-semibold text-orange-600">気温:</span>
                  <span class="text-2xl font-bold ml-2">{{ area.temps[timeIndex] }}°C</span>
                </div>

                <!-- Min/Max Temperature -->
                <div class="flex gap-3 mb-2">
                  <div
                    v-if="area.tempsMax && area.tempsMax[timeIndex]"
                    class="flex items-center gap-1"
                  >
                    <span class="text-red-500 font-bold text-sm">最高:</span>
                    <span class="text-xl font-bold text-red-600">{{ area.tempsMax[timeIndex] }}°</span>
                  </div>
                  <div
                    v-if="area.tempsMin && area.tempsMin[timeIndex]"
                    class="flex items-center gap-1"
                  >
                    <span class="text-blue-500 font-bold text-sm">最低:</span>
                    <span class="text-xl font-bold text-blue-600">{{ area.tempsMin[timeIndex] }}°</span>
                  </div>
                </div>

                <!-- Precipitation Probability -->
                <div
                  v-if="area.pops && area.pops[timeIndex]"
                  class="mb-2"
                >
                  <div class="flex items-center justify-between text-sm mb-1">
                    <span class="font-semibold text-blue-600">💧 降水確率</span>
                    <span class="font-bold">{{ area.pops[timeIndex] }}%</span>
                  </div>
                  <div class="w-full bg-gray-200 rounded-full h-2">
                    <div
                      class="h-full rounded-full transition-all"
                      :class="getPrecipitationColor(area.pops[timeIndex])"
                      :style="{ width: area.pops[timeIndex] + '%' }"
                    ></div>
                  </div>
                </div>

                <!-- Wind -->
                <div
                  v-if="area.winds && area.winds[timeIndex]"
                  class="text-gray-700 text-sm mb-1"
                >
                  <span class="font-semibold">🌬️ 風:</span>
                  {{ area.winds[timeIndex] }}
                </div>

                <!-- Waves -->
                <div
                  v-if="area.waves && area.waves[timeIndex]"
                  class="text-gray-700 text-sm"
                >
                  <span class="font-semibold">🌊 波:</span>
                  {{ area.waves[timeIndex] }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Temperature/Precipitation Averages -->
        <div
          v-if="weatherData.tempAverage || weatherData.precipAverage"
          class="bg-white rounded-2xl shadow-xl p-6"
        >
          <h2 class="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
            <span class="text-3xl">📊</span>
            Historical Averages
          </h2>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Temperature Average -->
            <div
              v-if="weatherData.tempAverage"
              class="bg-gradient-to-br from-orange-50 to-red-50 rounded-xl p-5 shadow-md border border-orange-200"
            >
              <h3 class="font-bold text-orange-700 mb-3 text-lg flex items-center gap-2">
                <span class="text-2xl">🌡️</span>
                Temperature
              </h3>
              <div
                v-for="(area, index) in weatherData.tempAverage.areas"
                :key="index"
                class="text-gray-700 mb-3 last:mb-0"
              >
                <div class="font-semibold text-gray-800 mb-1">{{ area.area.name }}</div>
                <div class="flex gap-3">
                  <div v-if="area.min" class="flex items-center gap-1">
                    <span class="text-blue-600 font-semibold">最低:</span>
                    <span class="text-xl font-bold text-blue-700">{{ area.min }}°C</span>
                  </div>
                  <div v-if="area.max" class="flex items-center gap-1">
                    <span class="text-red-600 font-semibold">最高:</span>
                    <span class="text-xl font-bold text-red-700">{{ area.max }}°C</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Precipitation Average -->
            <div
              v-if="weatherData.precipAverage"
              class="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-5 shadow-md border border-blue-200"
            >
              <h3 class="font-bold text-blue-700 mb-3 text-lg flex items-center gap-2">
                <span class="text-2xl">💧</span>
                Precipitation
              </h3>
              <div
                v-for="(area, index) in weatherData.precipAverage.areas"
                :key="index"
                class="text-gray-700 mb-3 last:mb-0"
              >
                <div class="font-semibold text-gray-800 mb-1">{{ area.area.name }}</div>
                <div class="flex gap-3">
                  <div v-if="area.min" class="flex items-center gap-1">
                    <span class="text-cyan-600 font-semibold">最低:</span>
                    <span class="text-xl font-bold text-cyan-700">{{ area.min }}mm</span>
                  </div>
                  <div v-if="area.max" class="flex items-center gap-1">
                    <span class="text-blue-600 font-semibold">最高:</span>
                    <span class="text-xl font-bold text-blue-700">{{ area.max }}mm</span>
                  </div>
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
import type { WeatherToolData, WeatherJsonData } from "../models/weather";
import TemperatureChart from "./components/TemperatureChart.vue";

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

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString("ja-JP", {
    month: "short",
    day: "numeric",
  });
}

function getDayOfWeek(isoString: string): string {
  const date = new Date(isoString);
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  return days[date.getDay()];
}

function getPrecipitationColor(percentage: string | number): string {
  const value = typeof percentage === "string" ? parseInt(percentage) : percentage;

  if (value >= 70) return "bg-gradient-to-r from-blue-500 to-blue-600";
  if (value >= 50) return "bg-gradient-to-r from-blue-400 to-blue-500";
  if (value >= 30) return "bg-gradient-to-r from-cyan-400 to-blue-400";
  if (value >= 10) return "bg-gradient-to-r from-cyan-300 to-cyan-400";
  return "bg-gradient-to-r from-gray-300 to-gray-400";
}

function getSeriesTitle(index: number): string {
  const titles = ["Current Forecast", "Extended Forecast", "Weekly Forecast"];
  return titles[index] || `Forecast ${index + 1}`;
}

function getWeatherEmoji(weather: string): string {
  if (!weather) return "🌤️";

  const w = weather.toLowerCase();
  if (w.includes("晴") || w.includes("sunny") || w.includes("clear"))
    return "☀️";
  if (w.includes("曇") || w.includes("cloudy")) return "☁️";
  if (w.includes("雨") || w.includes("rain")) return "🌧️";
  if (w.includes("雪") || w.includes("snow")) return "❄️";
  if (w.includes("雷") || w.includes("thunder")) return "⛈️";
  if (w.includes("霧") || w.includes("fog")) return "🌫️";

  return "🌤️";
}

function getPrecipitationIcon(percentage: string | number): string {
  const value = typeof percentage === "string" ? parseInt(percentage) : percentage;

  if (value >= 50) return "☔"; // 雨傘
  if (value >= 30) return "🌂"; // 傘
  if (value >= 10) return "☁️"; // 曇り
  return "☀️"; // 晴れ
}

function hasTemperatureData(area: any): boolean {
  return !!(area.tempsMax || area.tempsMin || area.temps);
}
</script>
