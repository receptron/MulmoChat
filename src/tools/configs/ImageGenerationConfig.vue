<template>
  <div class="space-y-4">
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-2">
        Image Generation Backend
      </label>
      <select
        :value="currentValue.backend"
        @change="handleBackendChange"
        class="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="gemini">Google Gemini</option>
        <option value="openai">OpenAI</option>
        <option value="comfyui">ComfyUI (Local)</option>
      </select>
      <p class="text-xs text-gray-500 mt-1">
        Choose between cloud-based Gemini or OpenAI, or a local ComfyUI workflow
        for image generation.
      </p>
    </div>

    <div v-if="currentValue.backend === 'gemini'">
      <label class="block text-sm font-medium text-gray-700 mb-2">
        Gemini Model
      </label>
      <select
        :value="currentValue.geminiModel || 'gemini-2.5-flash-image'"
        @change="handleGeminiModelChange"
        class="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="gemini-2.5-flash-image">Gemini 2.5 Flash Image</option>
        <option value="gemini-3-pro-image-preview">
          Gemini 3 Pro Image (Preview)
        </option>
      </select>
      <p class="text-xs text-gray-500 mt-1">
        Select which Gemini model to use for image generation.
      </p>
    </div>

    <div v-if="currentValue.backend === 'openai'">
      <label class="block text-sm font-medium text-gray-700 mb-2">
        OpenAI Model
      </label>
      <select
        :value="currentValue.openaiModel || 'gpt-image-1'"
        @change="handleOpenAIModelChange"
        class="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="gpt-image-1">GPT Image 1</option>
        <option value="gpt-image-1.5">GPT Image 1.5</option>
        <option value="gpt-image-1-mini">GPT Image 1 Mini</option>
      </select>
      <p class="text-xs text-gray-500 mt-1">
        Select which OpenAI image model to use.
      </p>
    </div>

    <div>
      <label class="block text-sm font-medium text-gray-700 mb-2">
        Additional Style Modifier
      </label>
      <input
        type="text"
        :value="currentValue.styleModifier || ''"
        @input="handleStyleModifierChange"
        placeholder="e.g., ghibli-style anime, oil painting, cyberpunk"
        class="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <p class="text-xs text-gray-500 mt-1">
        This style will be automatically appended to all image generation
        prompts. Leave empty for no additional styling.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

export interface ImageGenerationConfigValue {
  backend: "gemini" | "openai" | "comfyui";
  styleModifier?: string;
  geminiModel?: "gemini-2.5-flash-image" | "gemini-3-pro-image-preview";
  openaiModel?: "gpt-image-1" | "gpt-image-1.5" | "gpt-image-1-mini";
}

const props = defineProps<{
  value: "gemini" | "openai" | "comfyui" | ImageGenerationConfigValue;
}>();

const emit = defineEmits<{
  "update:value": [value: ImageGenerationConfigValue];
}>();

// Handle legacy string values and new object values
const currentValue = computed<ImageGenerationConfigValue>(() => {
  if (typeof props.value === "string") {
    return {
      backend: props.value,
      styleModifier: "",
      geminiModel: "gemini-2.5-flash-image",
      openaiModel: "gpt-image-1",
    };
  }
  return {
    ...props.value,
    geminiModel: props.value.geminiModel || "gemini-2.5-flash-image",
    openaiModel: props.value.openaiModel || "gpt-image-1",
  };
});

const handleBackendChange = (event: Event) => {
  const backend = (event.target as HTMLSelectElement).value as
    | "gemini"
    | "openai"
    | "comfyui";
  emit("update:value", {
    ...currentValue.value,
    backend,
  });
};

const handleStyleModifierChange = (event: Event) => {
  const styleModifier = (event.target as HTMLInputElement).value;
  emit("update:value", {
    ...currentValue.value,
    styleModifier,
  });
};

const handleGeminiModelChange = (event: Event) => {
  const geminiModel = (event.target as HTMLSelectElement).value as
    | "gemini-2.5-flash-image"
    | "gemini-3-pro-image-preview";
  emit("update:value", {
    ...currentValue.value,
    geminiModel,
  });
};

const handleOpenAIModelChange = (event: Event) => {
  const openaiModel = (event.target as HTMLSelectElement).value as
    | "gpt-image-1"
    | "gpt-image-1.5"
    | "gpt-image-1-mini";
  emit("update:value", {
    ...currentValue.value,
    openaiModel,
  });
};
</script>
