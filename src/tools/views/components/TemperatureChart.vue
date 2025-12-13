<template>
  <div class="w-full">
    <svg :viewBox="`0 0 ${width} ${height}`" class="w-full h-auto">
      <!-- Grid lines -->
      <g class="grid-lines">
        <line
          v-for="i in 5"
          :key="`grid-${i}`"
          :x1="padding.left"
          :y1="padding.top + ((chartHeight / 4) * (i - 1))"
          :x2="width - padding.right"
          :y2="padding.top + ((chartHeight / 4) * (i - 1))"
          stroke="#e5e7eb"
          stroke-width="1"
        />
      </g>

      <!-- Temperature labels (Y-axis) -->
      <g class="y-axis-labels">
        <text
          v-for="(temp, i) in yAxisLabels"
          :key="`y-label-${i}`"
          :x="padding.left - 10"
          :y="padding.top + ((chartHeight / 4) * i) + 5"
          text-anchor="end"
          class="text-xs fill-gray-600"
        >
          {{ temp }}°
        </text>
      </g>

      <!-- Max temperature line -->
      <polyline
        v-if="maxPoints.length > 0"
        :points="maxPoints"
        fill="none"
        stroke="#ef4444"
        stroke-width="3"
        stroke-linecap="round"
        stroke-linejoin="round"
      />

      <!-- Max temperature points and labels -->
      <g v-if="maxPoints.length > 0">
        <g v-for="(point, i) in maxPointsArray" :key="`max-point-${i}`">
          <circle :cx="point.x" :cy="point.y" r="5" fill="#ef4444" />
          <text
            :x="point.x"
            :y="point.y - 12"
            text-anchor="middle"
            class="text-sm font-bold fill-red-600"
          >
            {{ point.value }}°
          </text>
        </g>
      </g>

      <!-- Min temperature line -->
      <polyline
        v-if="minPoints.length > 0"
        :points="minPoints"
        fill="none"
        stroke="#3b82f6"
        stroke-width="3"
        stroke-linecap="round"
        stroke-linejoin="round"
      />

      <!-- Min temperature points and labels -->
      <g v-if="minPoints.length > 0">
        <g v-for="(point, i) in minPointsArray" :key="`min-point-${i}`">
          <circle :cx="point.x" :cy="point.y" r="5" fill="#3b82f6" />
          <text
            :x="point.x"
            :y="point.y + 20"
            text-anchor="middle"
            class="text-sm font-bold fill-blue-600"
          >
            {{ point.value }}°
          </text>
        </g>
      </g>

      <!-- Current temperature line (if available) -->
      <polyline
        v-if="currentPoints.length > 0"
        :points="currentPoints"
        fill="none"
        stroke="#f97316"
        stroke-width="3"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-dasharray="5,5"
      />

      <!-- Current temperature points -->
      <g v-if="currentPoints.length > 0">
        <g v-for="(point, i) in currentPointsArray" :key="`current-point-${i}`">
          <circle :cx="point.x" :cy="point.y" r="5" fill="#f97316" />
        </g>
      </g>

      <!-- Date/Time labels (X-axis) -->
      <g class="x-axis-labels">
        <text
          v-for="(label, i) in dateLabels"
          :key="`x-label-${i}`"
          :x="padding.left + (chartWidth / (dateLabels.length - 1)) * i"
          :y="height - padding.bottom + 20"
          text-anchor="middle"
          class="text-xs fill-gray-700 font-medium"
        >
          {{ label }}
        </text>
      </g>
    </svg>

    <!-- Legend -->
    <div class="flex justify-center gap-6 mt-4">
      <div v-if="maxPointsArray.length > 0" class="flex items-center gap-2">
        <div class="w-4 h-4 rounded-full bg-red-500"></div>
        <span class="text-sm text-gray-700 font-medium">最高気温</span>
      </div>
      <div v-if="minPointsArray.length > 0" class="flex items-center gap-2">
        <div class="w-4 h-4 rounded-full bg-blue-500"></div>
        <span class="text-sm text-gray-700 font-medium">最低気温</span>
      </div>
      <div v-if="currentPointsArray.length > 0" class="flex items-center gap-2">
        <div class="w-4 h-4 rounded-full bg-orange-500"></div>
        <span class="text-sm text-gray-700 font-medium">現在気温</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  times: string[];
  tempsMax?: string[];
  tempsMin?: string[];
  temps?: string[];
}>();

const width = 800;
const height = 300;
const padding = { top: 40, right: 40, bottom: 60, left: 50 };

const chartWidth = computed(() => width - padding.left - padding.right);
const chartHeight = computed(() => height - padding.top - padding.bottom);

// Get all temperature values
const allTemps = computed(() => {
  const temps: number[] = [];
  if (props.tempsMax) temps.push(...props.tempsMax.map(Number).filter((n) => !isNaN(n)));
  if (props.tempsMin) temps.push(...props.tempsMin.map(Number).filter((n) => !isNaN(n)));
  if (props.temps) temps.push(...props.temps.map(Number).filter((n) => !isNaN(n)));
  return temps;
});

// Calculate temperature range
const tempRange = computed(() => {
  if (allTemps.value.length === 0) return { min: 0, max: 30 };
  const min = Math.floor(Math.min(...allTemps.value) / 5) * 5;
  const max = Math.ceil(Math.max(...allTemps.value) / 5) * 5;
  return { min, max };
});

// Y-axis labels
const yAxisLabels = computed(() => {
  const { min, max } = tempRange.value;
  const step = (max - min) / 4;
  return [max, max - step, max - step * 2, max - step * 3, min];
});

// Convert temperature to Y coordinate
function tempToY(temp: string | number): number {
  const t = typeof temp === "string" ? parseFloat(temp) : temp;
  if (isNaN(t)) return 0;
  const { min, max } = tempRange.value;
  const ratio = (t - min) / (max - min);
  return padding.top + chartHeight.value * (1 - ratio);
}

// Convert index to X coordinate
function indexToX(index: number, total: number): number {
  if (total <= 1) return padding.left + chartWidth.value / 2;
  return padding.left + (chartWidth.value / (total - 1)) * index;
}

// Max temperature points
const maxPointsArray = computed(() => {
  if (!props.tempsMax) return [];
  return props.tempsMax
    .map((temp, i) => {
      if (!temp) return null;
      return {
        x: indexToX(i, props.times.length),
        y: tempToY(temp),
        value: temp,
      };
    })
    .filter((p) => p !== null) as Array<{ x: number; y: number; value: string }>;
});

const maxPoints = computed(() => {
  return maxPointsArray.value.map((p) => `${p.x},${p.y}`).join(" ");
});

// Min temperature points
const minPointsArray = computed(() => {
  if (!props.tempsMin) return [];
  return props.tempsMin
    .map((temp, i) => {
      if (!temp) return null;
      return {
        x: indexToX(i, props.times.length),
        y: tempToY(temp),
        value: temp,
      };
    })
    .filter((p) => p !== null) as Array<{ x: number; y: number; value: string }>;
});

const minPoints = computed(() => {
  return minPointsArray.value.map((p) => `${p.x},${p.y}`).join(" ");
});

// Current temperature points
const currentPointsArray = computed(() => {
  if (!props.temps) return [];
  return props.temps
    .map((temp, i) => {
      if (!temp) return null;
      return {
        x: indexToX(i, props.times.length),
        y: tempToY(temp),
        value: temp,
      };
    })
    .filter((p) => p !== null) as Array<{ x: number; y: number; value: string }>;
});

const currentPoints = computed(() => {
  return currentPointsArray.value.map((p) => `${p.x},${p.y}`).join(" ");
});

// Date labels
const dateLabels = computed(() => {
  return props.times.map((time) => {
    const date = new Date(time);
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
  });
});
</script>
