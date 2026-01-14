<template>
  <div class="w-full h-full p-4">
    <GoogleMap
      v-if="selectedResult?.data?.location"
      :location="selectedResult.data.location"
      :api-key="googleMapKey"
      :zoom="15"
      @error="handleMapError"
    />
  </div>
</template>

<script setup lang="ts">
import type { ToolResult } from "../types";
import type { MapToolData } from "../models/map";
import GoogleMap from "../../components/GoogleMap.vue";

const props = defineProps<{
  selectedResult: ToolResult<MapToolData> | null;
  googleMapKey: string | null;
  sendTextMessage?: (text: string) => void;
}>();

const handleMapError = (errorMessage: string) => {
  if (props.sendTextMessage) {
    props.sendTextMessage(
      `Error loading map for location "${props.selectedResult?.data?.location}": ${errorMessage}`,
    );
  }
};
</script>
