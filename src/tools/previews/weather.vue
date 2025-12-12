<template>
  <div class="text-center p-4 bg-blue-50 rounded">
    <div class="text-blue-600 font-medium text-2xl mb-1">⛅</div>
    <div class="text-blue-800 font-medium">Weather</div>
    <div class="text-xs text-gray-600 mt-1">
      {{ result.data?.areaName || result.title }}
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ToolResult } from "../types";
import type { WeatherToolData } from "../models/weather";

defineProps<{
  result: ToolResult<WeatherToolData>;
}>();
</script>
