<template>
  <div>
    <label class="flex items-center space-x-2 cursor-pointer">
      <input
        type="checkbox"
        :checked="value"
        @change="handleChange"
        class="rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
      />
      <span class="text-sm font-medium text-gray-700">
        Auto-generate movies for presentations
      </span>
    </label>
    <p class="text-xs text-gray-500 mt-1 ml-6">
      When enabled, movies will be automatically generated when you create a
      presentation. Disable this if you only want to generate the script without
      creating videos.
    </p>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  value: boolean;
}>();

const emit = defineEmits<{
  "update:value": [value: boolean];
}>();

const handleChange = (event: Event) => {
  const checked = (event.target as HTMLInputElement).checked;
  emit("update:value", checked);
};
</script>
