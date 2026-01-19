<template>
  <div class="text-sm leading-snug" :class="textColorClass">
    <p class="line-clamp-5 whitespace-pre-wrap">{{ previewText }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { ToolResultComplete } from "gui-chat-protocol/vue";
import type { TextResponseData } from "../models/textResponse";

const props = defineProps<{
  result: ToolResultComplete<TextResponseData>;
}>();

const previewText = computed(() => props.result.data?.text ?? "");
const messageRole = computed(() => props.result.data?.role ?? "assistant");

const textColorClass = computed(() => {
  switch (messageRole.value) {
    case "system":
      return "text-blue-700";
    case "user":
      return "text-green-700 font-medium";
    default:
      return "text-gray-700";
  }
});
</script>
