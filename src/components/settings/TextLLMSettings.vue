<template>
  <div>
    <label class="block text-sm font-medium text-gray-700 mb-2">
      Text Generation Backend
    </label>
    <select
      :value="modelValue"
      @change="
        $emit(
          'update:modelValue',
          ($event.target as HTMLSelectElement).value as 'claude' | 'gemini',
        )
      "
      class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
    >
      <option value="claude">Claude (Anthropic)</option>
      <option value="gemini">Gemini (Google)</option>
    </select>
    <p class="mt-1 text-xs text-gray-500">Used for HTML generation</p>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  modelValue: "claude" | "gemini";
}>();

defineEmits<{
  "update:modelValue": [value: "claude" | "gemini"];
}>();
</script>
