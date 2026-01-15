<template>
  <div class="text-center p-4 bg-blue-50 dark:bg-blue-900 rounded">
    <div class="text-blue-600 dark:text-blue-300 font-medium">
      {{ libraryIcon }} HTML
    </div>
    <div
      class="text-sm text-gray-800 dark:text-gray-200 mt-1 font-medium truncate"
    >
      {{ displayTitle }}
    </div>
    <div class="text-xs text-gray-600 dark:text-gray-400 mt-1">
      {{ libraryLabel }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { ToolResult } from "../types";
import type { HtmlToolData, HtmlLibraryType } from "../utils";

const props = defineProps<{
  result: ToolResult<HtmlToolData>;
}>();

const displayTitle = computed(() => {
  return props.result.title || "HTML Page";
});

const libraryLabel = computed(() => {
  const type = props.result.data?.type;
  if (!type) return "";
  const labels: Record<HtmlLibraryType, string> = {
    tailwind: "Tailwind CSS",
    "d3.js": "D3.js",
    "three.js": "Three.js",
    mermaid: "Mermaid",
    "p5.js": "p5.js",
  };
  return labels[type];
});

const libraryIcon = computed(() => {
  const type = props.result.data?.type;
  if (!type) return "🌐";
  const icons: Record<HtmlLibraryType, string> = {
    tailwind: "🎨",
    "d3.js": "📊",
    "three.js": "🎮",
    mermaid: "📋",
    "p5.js": "🎨",
  };
  return icons[type];
});
</script>
