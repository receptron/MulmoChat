<template>
  <div
    class="text-center p-4 bg-gradient-to-br from-sky-100 via-blue-100 to-indigo-100 rounded-xl shadow-md hover:shadow-xl transition-all duration-300 hover:scale-105 border-2 border-blue-200"
  >
    <div class="text-5xl mb-2 drop-shadow-lg">⛅</div>
    <div class="text-blue-800 font-bold text-sm mb-1">天気予報</div>
    <div class="text-xs text-gray-700 font-medium">
      {{ result.data?.areaName || result.title }}
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ToolResult } from "gui-chat-protocol/vue";
import type { WeatherToolData } from "../models/weather";

defineProps<{
  result: ToolResult<WeatherToolData>;
}>();
</script>
