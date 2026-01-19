<template>
  <div class="text-center p-4 bg-purple-50 rounded">
    <div class="text-purple-600 font-medium">🎵 Sheet Music</div>
    <div v-if="result.title" class="text-xs text-gray-600 mt-1 truncate">
      {{ result.title }}
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ToolResult } from "gui-chat-protocol/vue";
import type { MusicToolData } from "../models/music";

defineProps<{
  result: ToolResult<MusicToolData>;
}>();
</script>
