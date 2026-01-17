<template>
  <div class="space-y-6">
    <TextLLMSettings
      :model-value="textLLMBackend"
      @update:model-value="$emit('update:textLLMBackend', $event)"
    />
    <ImageGenSettings
      :model-value="imageGenBackend"
      @update:model-value="$emit('update:imageGenBackend', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import TextLLMSettings from "./TextLLMSettings.vue";
import ImageGenSettings, {
  type ImageGenerationConfigValue,
} from "./ImageGenSettings.vue";

defineProps<{
  textLLMBackend: "claude" | "gemini";
  imageGenBackend: string | ImageGenerationConfigValue;
}>();

defineEmits<{
  "update:textLLMBackend": [value: "claude" | "gemini"];
  "update:imageGenBackend": [value: ImageGenerationConfigValue];
}>();
</script>
