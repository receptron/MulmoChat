<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75"
  >
    <div
      class="relative bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-2xl w-full mx-4"
    >
      <!-- Header -->
      <div
        class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700"
      >
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
          Take Photo
        </h3>
        <button
          @click="handleCancel"
          class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <span class="material-icons">close</span>
        </button>
      </div>

      <!-- Camera Preview -->
      <div class="p-4">
        <div
          class="relative bg-black rounded-lg overflow-hidden"
          style="aspect-ratio: 4/3"
        >
          <video
            ref="videoRef"
            autoplay
            playsinline
            class="w-full h-full object-contain"
          ></video>
          <div
            v-if="error"
            class="absolute inset-0 flex items-center justify-center text-white text-center p-4"
          >
            <div>
              <span class="material-icons text-5xl mb-2">error_outline</span>
              <p>{{ error }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div
        class="flex items-center justify-center gap-4 p-4 border-t border-gray-200 dark:border-gray-700"
      >
        <button
          @click="handleCancel"
          class="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
        >
          Cancel
        </button>
        <button
          @click="handleCapture"
          :disabled="!!error"
          class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          <span class="material-icons">camera_alt</span>
          <span>Capture</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";

const emit = defineEmits<{
  capture: [imageData: string];
  cancel: [];
}>();

const videoRef = ref<HTMLVideoElement | null>(null);
const stream = ref<MediaStream | null>(null);
const error = ref<string>("");

onMounted(async () => {
  try {
    stream.value = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: false,
    });

    if (videoRef.value) {
      videoRef.value.srcObject = stream.value;
    }
  } catch (err) {
    console.error("Camera access failed:", err);
    error.value =
      err instanceof Error
        ? err.message
        : "Failed to access camera. Please grant camera permissions.";
  }
});

onUnmounted(() => {
  cleanup();
});

const cleanup = () => {
  if (stream.value) {
    stream.value.getTracks().forEach((track) => track.stop());
    stream.value = null;
  }
  if (videoRef.value) {
    videoRef.value.srcObject = null;
  }
};

const handleCapture = () => {
  if (!videoRef.value || error.value) return;

  try {
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.value.videoWidth;
    canvas.height = videoRef.value.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to get canvas context");
    }

    ctx.drawImage(videoRef.value, 0, 0, canvas.width, canvas.height);
    const imageData = canvas.toDataURL("image/png");

    cleanup();
    emit("capture", imageData);
  } catch (err) {
    console.error("Capture failed:", err);
    error.value = "Failed to capture photo";
  }
};

const handleCancel = () => {
  cleanup();
  emit("cancel");
};
</script>
