<template>
  <div
    ref="sidebarEl"
    :style="{ width: sidebarWidth + 'px' }"
    class="flex-shrink-0 bg-gray-50 border rounded p-4 flex flex-col space-y-4 relative"
  >
    <!-- Resize handle -->
    <div
      @mousedown="startResize"
      class="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-500 transition-colors z-10"
      title="Drag to resize"
    ></div>
    <!-- Voice chat controls -->
    <div class="space-y-2 flex-shrink-0">
      <div class="flex gap-2">
        <button
          v-if="!chatActive"
          @click="$emit('startChat')"
          :disabled="connecting"
          class="flex-1 px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50"
        >
          {{ connecting ? "Connecting..." : connectButtonLabel }}
        </button>
        <div v-else class="flex gap-2 w-full">
          <div class="flex items-center justify-center px-2">
            <span
              class="material-icons text-2xl text-blue-600 transition-transform"
              :class="{ 'animate-spin': isConversationActive }"
              >{{ getRoleIcon() }}</span
            >
          </div>
          <button
            @click="$emit('stopChat')"
            class="flex-1 px-4 py-2 bg-red-600 text-white rounded"
          >
            Stop
          </button>
          <button
            v-if="supportsAudioInput"
            @click="$emit('setMute', !isMuted)"
            class="px-3 py-2 rounded border flex items-center justify-center"
            :class="
              isMuted
                ? 'bg-red-100 text-red-600 border-red-300'
                : 'bg-gray-100 text-gray-600 border-gray-300'
            "
            :title="isMuted ? 'Unmute microphone' : 'Mute microphone'"
          >
            <span class="material-icons text-lg">{{
              isMuted ? "mic_off" : "mic"
            }}</span>
          </button>
        </div>
        <button
          v-if="!chatActive"
          @click="showConfigPopup = true"
          class="px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 flex items-center justify-center"
          title="Configuration"
        >
          <span class="material-icons text-lg">settings</span>
        </button>
      </div>
      <audio v-if="supportsAudioOutput" ref="audioEl" autoplay></audio>
    </div>

    <!-- Generated images container -->
    <div class="flex-1 flex flex-col min-h-0">
      <div
        ref="imageContainer"
        class="border rounded p-2 overflow-y-auto space-y-2 flex-1"
      >
        <div
          v-if="!pluginResults.length && !isGeneratingImage"
          class="text-gray-500 text-sm"
        >
          Feel free to ask me any questions...
        </div>
        <div
          v-for="(result, index) in pluginResults"
          :key="index"
          class="cursor-pointer hover:opacity-75 transition-opacity border rounded p-2"
          :class="{ 'ring-2 ring-blue-500': selectedResult === result }"
          @click="$emit('selectResult', result)"
        >
          <component
            v-if="getToolPlugin(result.toolName)?.previewComponent"
            :is="getToolPlugin(result.toolName).previewComponent"
            :result="result"
          />
        </div>
        <div
          v-if="isGeneratingImage"
          class="flex items-center justify-center py-4"
        >
          <div
            class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"
          ></div>
          <span class="ml-2 text-sm text-gray-600">{{
            generatingMessage
          }}</span>
        </div>
      </div>
    </div>

    <div class="space-y-2 flex-shrink-0">
      <div class="flex gap-2 w-full">
        <button
          @click="triggerFileUpload"
          class="px-3 py-2 bg-gray-100 text-gray-600 border border-gray-300 rounded hover:bg-gray-200 flex items-center justify-center flex-shrink-0"
          title="Upload image or PDF"
        >
          <span class="text-lg">+</span>
        </button>
        <input
          :value="userInput"
          @input="
            $emit('update:userInput', ($event.target as HTMLInputElement).value)
          "
          @keydown.enter="handleEnterKey"
          :disabled="!chatActive && modelKind === 'voice-realtime'"
          type="text"
          placeholder="Type a message"
          class="flex-1 min-w-0 border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        />
      </div>
      <input
        ref="fileInput"
        type="file"
        :accept="acceptedFileTypes"
        multiple
        class="hidden"
        @change="handleFileUpload"
      />
      <button
        @click="$emit('sendTextMessage')"
        :disabled="
          (modelKind === 'voice-realtime' && !chatActive) || !userInput.trim()
        "
        class="w-full px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
      >
        Send Message
      </button>
    </div>

    <!-- Config Popup -->
    <div
      v-if="showConfigPopup"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      @click.self="showConfigPopup = false"
    >
      <div
        class="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] flex flex-col"
      >
        <div class="flex justify-between items-center mb-4 flex-shrink-0">
          <h2 class="text-xl font-semibold">Configuration</h2>
          <button
            @click="showConfigPopup = false"
            class="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <div class="space-y-4 overflow-y-auto flex-1">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Mode
            </label>
            <select
              :value="modelKind"
              @change="
                $emit(
                  'update:modelKind',
                  ($event.target as HTMLSelectElement).value,
                )
              "
              class="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="voice-realtime">Voice (OpenAI Realtime)</option>
              <option value="voice-google-live">Voice (Google Live)</option>
              <option value="text-rest">Text (REST)</option>
            </select>
            <p class="text-xs text-gray-500 mt-1">
              Choose between OpenAI WebRTC, Google WebSocket, or REST text
              interface.
            </p>
          </div>

          <div v-if="isOpenAIRealtime">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Realtime Model
            </label>
            <select
              :value="modelId"
              @change="
                $emit(
                  'update:modelId',
                  ($event.target as HTMLSelectElement).value,
                )
              "
              class="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option
                v-for="model in REALTIME_MODELS"
                :key="model.id"
                :value="model.id"
              >
                {{ model.label }}
              </option>
            </select>
            <p class="text-xs text-gray-500 mt-1">
              Chooses the OpenAI realtime model used when connecting.
            </p>
          </div>

          <div v-if="isGoogleLive">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Google Live Model
            </label>
            <select
              :value="modelId"
              @change="
                $emit(
                  'update:modelId',
                  ($event.target as HTMLSelectElement).value,
                )
              "
              class="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option
                v-for="model in GOOGLE_LIVE_MODELS"
                :key="model.id"
                :value="model.id"
              >
                {{ model.label }}
              </option>
            </select>
            <p class="text-xs text-gray-500 mt-1">
              Chooses the Google Gemini model used for real-time conversations.
            </p>
          </div>

          <div v-if="modelKind === 'text-rest'">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Text Model
            </label>
            <select
              :value="textModelId"
              @change="
                $emit(
                  'update:textModelId',
                  ($event.target as HTMLSelectElement).value,
                )
              "
              class="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option
                v-for="option in textModelOptions"
                :key="option.id"
                :value="option.id"
                :disabled="option.disabled"
              >
                {{ option.label }}
              </option>
            </select>
            <p class="text-xs text-gray-500 mt-1">
              Select the REST text model. Providers marked "credentials
              required" need an API key set on the server.
            </p>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Role
            </label>
            <div class="relative">
              <span
                class="material-icons absolute left-3 top-1/2 transform -translate-y-1/2 text-blue-600 pointer-events-none"
              >
                {{ getRoleIcon() }}
              </span>
              <select
                :value="roleId"
                @change="
                  $emit(
                    'update:roleId',
                    ($event.target as HTMLSelectElement).value,
                  )
                "
                class="w-full border rounded pl-10 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option v-for="role in ROLES" :key="role.id" :value="role.id">
                  {{ role.name }}
                </option>
              </select>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Native Language
            </label>
            <select
              :value="userLanguage"
              @change="
                $emit(
                  'update:userLanguage',
                  ($event.target as HTMLSelectElement).value,
                )
              "
              class="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option
                v-for="language in LANGUAGES"
                :key="language.code"
                :value="language.code"
              >
                {{ language.name }}
              </option>
            </select>
          </div>

          <div>
            <label class="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                :checked="suppressInstructions"
                @change="
                  $emit(
                    'update:suppressInstructions',
                    ($event.target as HTMLInputElement).checked,
                  )
                "
                class="rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
              />
              <span class="text-sm font-medium text-gray-700">
                Suppress Instructions
              </span>
            </label>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Custom Instructions
            </label>
            <textarea
              :value="customInstructions"
              @input="
                $emit(
                  'update:customInstructions',
                  ($event.target as HTMLTextAreaElement).value,
                )
              "
              placeholder="Add additional instructions for the AI..."
              class="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y min-h-20"
            ></textarea>
            <p class="text-xs text-gray-500 mt-1">
              These instructions will be added to the system prompt.
            </p>
          </div>

          <div v-if="isCurrentRoleCustomizable">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Enabled Plugins
            </label>
            <div class="max-h-60 overflow-y-auto border rounded p-2 space-y-1">
              <label
                v-for="pluginModule in getPluginList()"
                :key="pluginModule.plugin.toolDefinition.name"
                class="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded"
              >
                <input
                  type="checkbox"
                  :checked="
                    enabledPlugins[pluginModule.plugin.toolDefinition.name] ??
                    true
                  "
                  @change="
                    handlePluginToggle(
                      pluginModule.plugin.toolDefinition.name,
                      ($event.target as HTMLInputElement).checked,
                    )
                  "
                  class="rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                />
                <span class="text-sm text-gray-700">
                  {{ pluginModule.plugin.toolDefinition.name }}
                </span>
              </label>
            </div>
          </div>

          <div v-else class="plugins-info">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Available Plugins
            </label>
            <p class="text-xs text-gray-500 mb-2">
              This role uses a curated set of plugins optimized for its purpose.
              Switch to General role to customize plugins.
            </p>
            <div
              class="flex flex-wrap gap-2 max-h-60 overflow-y-auto border rounded p-2 bg-gray-50"
            >
              <span
                v-for="pluginName in availablePluginsForCurrentRole"
                :key="pluginName"
                class="inline-block px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium"
              >
                {{ pluginName }}
              </span>
            </div>
          </div>

          <div v-if="hasAnyPluginConfig()">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Plugin Settings
            </label>
            <div class="space-y-4">
              <component
                v-for="pluginModule in getPluginsWithConfig(roleId)"
                :key="pluginModule.plugin.config!.key"
                :is="pluginModule.plugin.config!.component"
                :value="
                  pluginConfigs[pluginModule.plugin.config!.key] ??
                  pluginModule.plugin.config!.defaultValue
                "
                @update:value="
                  handlePluginConfigUpdate(
                    pluginModule.plugin.config!.key,
                    $event,
                  )
                "
              />
            </div>
          </div>
        </div>

        <div class="flex justify-end mt-4 pt-4 border-t flex-shrink-0">
          <button
            @click="showConfigPopup = false"
            class="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  ref,
  nextTick,
  defineProps,
  defineEmits,
  computed,
  onMounted,
  onUnmounted,
} from "vue";
import type { ToolResult } from "../tools";
import {
  getToolPlugin,
  getAcceptedFileTypes,
  getFileUploadPlugins,
  getPluginList,
  getPluginsWithConfig,
  hasAnyPluginConfig,
  isRoleCustomizable,
  getAvailablePluginsForRole,
} from "../tools";
import { LANGUAGES } from "../config/languages";
import { ROLES } from "../config/roles";
import { REALTIME_MODELS, GOOGLE_LIVE_MODELS } from "../config/models";
import type { SessionTransportKind } from "../composables/useSessionTransport";

interface TextModelOption {
  id: string;
  label: string;
  disabled?: boolean;
}

const props = defineProps<{
  chatActive: boolean;
  connecting: boolean;
  pluginResults: ToolResult[];
  isGeneratingImage: boolean;
  generatingMessage: string;
  selectedResult: ToolResult | null;
  userInput: string;
  isMuted: boolean;
  userLanguage: string;
  suppressInstructions: boolean;
  roleId: string;
  isConversationActive: boolean;
  enabledPlugins: Record<string, boolean>;
  customInstructions: string;
  modelId: string;
  modelKind: SessionTransportKind;
  textModelId: string;
  textModelOptions: TextModelOption[];
  supportsAudioInput: boolean;
  supportsAudioOutput: boolean;
  pluginConfigs: Record<string, any>;
}>();

const emit = defineEmits<{
  startChat: [];
  stopChat: [];
  setMute: [muted: boolean];
  selectResult: [result: ToolResult];
  sendTextMessage: [];
  "update:userInput": [value: string];
  "update:userLanguage": [value: string];
  "update:suppressInstructions": [value: boolean];
  "update:roleId": [value: string];
  "update:enabledPlugins": [value: Record<string, boolean>];
  "update:customInstructions": [value: string];
  "update:modelId": [value: string];
  "update:modelKind": [value: SessionTransportKind];
  "update:textModelId": [value: string];
  "update:pluginConfigs": [value: Record<string, any>];
  uploadFiles: [results: ToolResult[]];
}>();

const audioEl = ref<HTMLAudioElement | null>(null);
const imageContainer = ref<HTMLDivElement | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const showConfigPopup = ref(false);
const sidebarEl = ref<HTMLDivElement | null>(null);

// Sidebar width management
const SIDEBAR_WIDTH_KEY = "sidebar_width_v1";
const DEFAULT_SIDEBAR_WIDTH = 240; // 60 * 4 (w-60 in tailwind)
const MIN_SIDEBAR_WIDTH = 200;
const MAX_SIDEBAR_WIDTH = 600;

const sidebarWidth = ref<number>(
  parseInt(
    localStorage.getItem(SIDEBAR_WIDTH_KEY) || String(DEFAULT_SIDEBAR_WIDTH),
  ),
);

// Resize state
const isResizing = ref(false);
const startX = ref(0);
const startWidth = ref(0);

function startResize(event: MouseEvent): void {
  isResizing.value = true;
  startX.value = event.clientX;
  startWidth.value = sidebarWidth.value;

  // Prevent text selection during resize
  event.preventDefault();

  // Add global event listeners
  document.addEventListener("mousemove", handleResize);
  document.addEventListener("mouseup", stopResize);
}

function handleResize(event: MouseEvent): void {
  if (!isResizing.value) return;

  const deltaX = event.clientX - startX.value;
  const newWidth = startWidth.value + deltaX;

  // Constrain width to min/max bounds
  if (newWidth >= MIN_SIDEBAR_WIDTH && newWidth <= MAX_SIDEBAR_WIDTH) {
    sidebarWidth.value = newWidth;
  }
}

function stopResize(): void {
  if (isResizing.value) {
    isResizing.value = false;

    // Save to localStorage
    localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth.value));

    // Remove global event listeners
    document.removeEventListener("mousemove", handleResize);
    document.removeEventListener("mouseup", stopResize);
  }
}

// Cleanup on unmount
onUnmounted(() => {
  document.removeEventListener("mousemove", handleResize);
  document.removeEventListener("mouseup", stopResize);
});

const acceptedFileTypes = computed(() => getAcceptedFileTypes().join(","));
const fileUploadPlugins = computed(() => getFileUploadPlugins());
const isVoiceMode = computed(
  () =>
    props.modelKind === "voice-realtime" ||
    props.modelKind === "voice-google-live",
);
const isOpenAIRealtime = computed(() => props.modelKind === "voice-realtime");
const isGoogleLive = computed(() => props.modelKind === "voice-google-live");
const connectButtonLabel = computed(() =>
  isVoiceMode.value ? "Connect" : "Start Session",
);
const isCurrentRoleCustomizable = computed(() => {
  return isRoleCustomizable(props.roleId);
});

const availablePluginsForCurrentRole = computed(() => {
  const pluginNames = getAvailablePluginsForRole(props.roleId);
  if (!pluginNames) return []; // Customizable role, shouldn't happen here

  return pluginNames
    .map((name) => {
      const pluginModule = getPluginList().find(
        (p) => p.plugin.toolDefinition.name === name,
      );
      return pluginModule ? pluginModule.plugin.toolDefinition.name : null;
    })
    .filter((name): name is string => name !== null);
});

function scrollToBottom(): void {
  nextTick(() => {
    if (imageContainer.value) {
      imageContainer.value.scrollTop = imageContainer.value.scrollHeight;
    }
  });
}

function triggerFileUpload(): void {
  fileInput.value?.click();
}

function handleFileUpload(event: Event): void {
  const target = event.target as HTMLInputElement;
  const files = target.files;
  if (!files || files.length === 0) return;

  const results: ToolResult[] = [];
  let loadedCount = 0;
  const totalFiles = files.length;

  Array.from(files).forEach((file) => {
    // Find the plugin that handles this file type
    const plugin = fileUploadPlugins.value.find((p) =>
      p.fileUpload.acceptedTypes.includes(file.type),
    );

    if (!plugin) {
      console.warn(`No plugin found for file type: ${file.type}`);
      loadedCount++;
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const fileData = e.target?.result as string;
      const result = plugin.fileUpload.handleUpload(fileData, file.name);
      results.push(result);
      loadedCount++;

      if (loadedCount === totalFiles) {
        emit("uploadFiles", results);
      }
    };
    reader.readAsDataURL(file);
  });

  // Reset the input so the same files can be uploaded again
  target.value = "";
}

function handlePluginToggle(pluginName: string, enabled: boolean): void {
  const updated = { ...props.enabledPlugins, [pluginName]: enabled };
  emit("update:enabledPlugins", updated);
}

function handlePluginConfigUpdate(key: string, value: any): void {
  const updated = { ...props.pluginConfigs, [key]: value };
  emit("update:pluginConfigs", updated);
}

function getRoleIcon(): string {
  if (props.modelKind === "text-rest") {
    return "edit_note";
  }
  const role = ROLES.find((r) => r.id === props.roleId);
  return role?.icon || "graphic_eq";
}

function handleEnterKey(event: KeyboardEvent): void {
  // Don't submit if IME is composing (e.g., converting kana to kanji in Japanese)
  if (event.isComposing) {
    return;
  }

  // Don't submit if text is empty
  if (!props.userInput.trim()) {
    event.preventDefault();
    return;
  }

  // In voice mode, don't submit if chat is not active
  if (props.modelKind === "voice-realtime" && !props.chatActive) {
    event.preventDefault();
    return;
  }

  // Submit the message
  event.preventDefault();
  emit("sendTextMessage");
  // Note: Input is cleared by App.vue after successfully sending
}

defineExpose({
  audioEl,
  scrollToBottom,
});
</script>
