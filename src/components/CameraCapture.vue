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

      <!-- Camera Selector -->
      <div v-if="cameraDevices.length > 1" class="px-4 pt-4 pb-2">
        <label
          for="camera-select"
          class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
        >
          Select Camera
        </label>
        <select
          id="camera-select"
          v-model="selectedDeviceId"
          @change="switchCamera"
          class="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option
            v-for="device in cameraDevices"
            :key="device.deviceId"
            :value="device.deviceId"
          >
            {{ device.label || `Camera ${cameraDevices.indexOf(device) + 1}` }}
          </option>
        </select>
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
const cameraDevices = ref<MediaDeviceInfo[]>([]);
const selectedDeviceId = ref<string>("");

onMounted(async () => {
  try {
    // First, enumerate available camera devices
    await enumerateCameras();

    // Start with the first available camera (or user-facing if available)
    await startCamera();
  } catch (err) {
    console.error("Camera initialization failed:", err);
    error.value =
      err instanceof Error
        ? err.message
        : "Failed to access camera. Please grant camera permissions.";
  }
});

onUnmounted(() => {
  cleanup();
});

const enumerateCameras = async () => {
  try {
    // Request initial permission to get device labels
    const tempStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    });
    tempStream.getTracks().forEach((track) => track.stop());

    // Now enumerate devices with labels
    const devices = await navigator.mediaDevices.enumerateDevices();
    cameraDevices.value = devices.filter(
      (device) => device.kind === "videoinput",
    );

    // Try to select user-facing camera by default
    const userFacingCamera = cameraDevices.value.find((device) =>
      device.label.toLowerCase().includes("front"),
    );
    selectedDeviceId.value =
      userFacingCamera?.deviceId || cameraDevices.value[0]?.deviceId || "";
  } catch (err) {
    console.error("Failed to enumerate cameras:", err);
    // Fallback: try to get at least one camera without enumeration
    cameraDevices.value = [];
  }
};

const startCamera = async (deviceId?: string) => {
  cleanup();
  error.value = "";

  try {
    const constraints: MediaStreamConstraints = {
      video: deviceId
        ? { deviceId: { exact: deviceId } }
        : { facingMode: "user" },
      audio: false,
    };

    stream.value = await navigator.mediaDevices.getUserMedia(constraints);

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
};

const switchCamera = async () => {
  if (selectedDeviceId.value) {
    await startCamera(selectedDeviceId.value);
  }
};

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
