<template>
  <div class="space-y-6">
    <TextLLMSettings
      v-if="showTextLLM"
      :model-value="textLLMBackend"
      @update:model-value="$emit('update:textLLMBackend', $event)"
    />
    <ImageGenSettings
      v-if="showImageGen"
      :model-value="imageGenBackend"
      @update:model-value="$emit('update:imageGenBackend', $event)"
    />
    <MulmocastSettings
      v-if="showMulmocast"
      :model-value="mulmocastAutoGenerate"
      @update:model-value="$emit('update:mulmocastAutoGenerate', $event)"
    />
    <div
      v-if="!showTextLLM && !showImageGen && !showMulmocast"
      class="text-sm text-gray-500"
    >
      No backend settings required for currently enabled plugins.
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import TextLLMSettings from "./TextLLMSettings.vue";
import ImageGenSettings, {
  type ImageGenerationConfigValue,
} from "./ImageGenSettings.vue";
import MulmocastSettings from "./MulmocastSettings.vue";
import type { BackendType } from "../../tools/backendTypes";

const props = defineProps<{
  textLLMBackend: "claude" | "gemini";
  imageGenBackend: string | ImageGenerationConfigValue;
  mulmocastAutoGenerate: boolean;
  enabledBackends?: Set<BackendType>;
}>();

defineEmits<{
  "update:textLLMBackend": [value: "claude" | "gemini"];
  "update:imageGenBackend": [value: ImageGenerationConfigValue];
  "update:mulmocastAutoGenerate": [value: boolean];
}>();

// Show settings based on enabled backends (show all if not specified)
const showTextLLM = computed(
  () => !props.enabledBackends || props.enabledBackends.has("textLLM"),
);
const showImageGen = computed(
  () => !props.enabledBackends || props.enabledBackends.has("imageGen"),
);
const showMulmocast = computed(
  () => !props.enabledBackends || props.enabledBackends.has("mulmocast"),
);
</script>
