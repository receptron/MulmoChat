<template>
  <div class="space-y-4">
    <!-- Image Generation Backend -->
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-2">
        Image Generation Backend
      </label>
      <select
        :value="normalizedConfig.backend"
        @change="handleBackendChange"
        class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        <option value="gemini">Google Gemini</option>
        <option value="openai">OpenAI</option>
        <option value="comfyui">ComfyUI (Local)</option>
      </select>
      <p class="mt-1 text-xs text-gray-500">
        Choose between cloud-based Gemini or OpenAI, or a local ComfyUI workflow
      </p>
    </div>

    <!-- Gemini Model Selection -->
    <div v-if="normalizedConfig.backend === 'gemini'">
      <label class="block text-sm font-medium text-gray-700 mb-2">
        Gemini Model
      </label>
      <select
        :value="normalizedConfig.geminiModel"
        @change="handleGeminiModelChange"
        class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        <option
          v-for="model in GEMINI_IMAGE_MODELS"
          :key="model.id"
          :value="model.id"
        >
          {{ model.label }}
        </option>
      </select>
    </div>

    <!-- OpenAI Model Selection -->
    <div v-if="normalizedConfig.backend === 'openai'">
      <label class="block text-sm font-medium text-gray-700 mb-2">
        OpenAI Model
      </label>
      <select
        :value="normalizedConfig.openaiModel"
        @change="handleOpenAIModelChange"
        class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        <option
          v-for="model in OPENAI_IMAGE_MODELS"
          :key="model.id"
          :value="model.id"
        >
          {{ model.label }}
        </option>
      </select>
    </div>

    <!-- Style Modifier -->
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-2">
        Image Style Modifier
      </label>
      <input
        type="text"
        :value="normalizedConfig.styleModifier"
        @input="handleStyleModifierChange"
        placeholder="e.g., ghibli-style anime, oil painting, cyberpunk"
        class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />
      <p class="mt-1 text-xs text-gray-500">
        This style will be automatically appended to all image generation
        prompts
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { ImageGenerationConfigValue } from "../../tools/backend/types";
import { normalizeImageConfig } from "../../tools/backend/imageGeneration";
import {
  GEMINI_IMAGE_MODELS,
  OPENAI_IMAGE_MODELS,
  resolveGeminiImageModel,
  resolveOpenAIImageModel,
} from "../../config/imageModels";

export type { ImageGenerationConfigValue };

const props = defineProps<{
  modelValue: string | ImageGenerationConfigValue;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: ImageGenerationConfigValue];
}>();

// Normalize legacy string values and retired model IDs
const normalizedConfig = computed(() => normalizeImageConfig(props.modelValue));

const handleBackendChange = (event: Event) => {
  const backend = (event.target as HTMLSelectElement).value as
    "gemini" | "openai" | "comfyui";
  emit("update:modelValue", {
    ...normalizedConfig.value,
    backend,
  });
};

const handleGeminiModelChange = (event: Event) => {
  const geminiModel = resolveGeminiImageModel(
    (event.target as HTMLSelectElement).value,
  );
  emit("update:modelValue", {
    ...normalizedConfig.value,
    geminiModel,
  });
};

const handleOpenAIModelChange = (event: Event) => {
  const openaiModel = resolveOpenAIImageModel(
    (event.target as HTMLSelectElement).value,
  );
  emit("update:modelValue", {
    ...normalizedConfig.value,
    openaiModel,
  });
};

const handleStyleModifierChange = (event: Event) => {
  const styleModifier = (event.target as HTMLInputElement).value;
  emit("update:modelValue", {
    ...normalizedConfig.value,
    styleModifier,
  });
};
</script>
