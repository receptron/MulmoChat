<template>
  <div>
    <label class="block text-sm font-medium text-gray-700 mb-2">
      HTML Generation Backend
    </label>
    <select
      :value="value"
      @change="handleChange"
      class="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <option value="claude">Claude (Anthropic)</option>
      <option value="gemini">Google Gemini</option>
    </select>
    <p class="text-xs text-gray-500 mt-1">
      Choose which AI model to use for HTML generation and editing.
    </p>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  value: "claude" | "gemini";
}>();

const emit = defineEmits<{
  "update:value": [value: "claude" | "gemini"];
}>();

const handleChange = (event: Event) => {
  const backend = (event.target as HTMLSelectElement).value as
    | "claude"
    | "gemini";
  emit("update:value", backend);
};
</script>
