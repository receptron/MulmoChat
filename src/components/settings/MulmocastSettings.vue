<template>
  <div>
    <label class="block text-sm font-medium text-gray-700 mb-2">
      Mulmocast Settings
    </label>
    <label class="flex items-center space-x-2 cursor-pointer">
      <input
        type="checkbox"
        :checked="modelValue"
        @change="handleChange"
        class="rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
      />
      <span class="text-sm text-gray-700">
        Auto-generate movies for presentations
      </span>
    </label>
    <p class="text-xs text-gray-500 mt-1 ml-6">
      When enabled, movies will be automatically generated when you create a
      presentation.
    </p>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
}>();

const handleChange = (event: Event) => {
  const checked = (event.target as HTMLInputElement).checked;
  emit("update:modelValue", checked);
};
</script>
