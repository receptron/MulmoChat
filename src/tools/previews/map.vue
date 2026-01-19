<template>
  <div class="text-center p-4 bg-blue-50 rounded">
    <div class="text-blue-600 font-medium">🗺️ Map Location</div>
    <div class="text-xs text-gray-600 mt-1 truncate">
      {{
        typeof result.data?.location === "string"
          ? result.data.location
          : `${result.data?.location?.lat}, ${result.data?.location?.lng}`
      }}
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ToolResult } from "gui-chat-protocol/vue";
import type { MapToolData } from "../models/map";

defineProps<{
  result: ToolResult<MapToolData>;
}>();
</script>
