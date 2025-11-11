<template>
  <div class="p-4 space-y-4">
    <div role="toolbar" class="flex justify-between items-center">
      <h1 class="text-2xl font-bold">
        MulmoChat
        <span class="text-sm text-gray-500 font-normal">{{ statusLine }}</span>
      </h1>
      <div class="flex gap-2">
        <button
          @click="toggleSidebar"
          class="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded border border-gray-300 flex items-center justify-center transition-colors"
          :title="sidebarVisible ? 'Hide sidebar' : 'Show sidebar'"
        >
          <span class="material-icons text-base">{{
            sidebarVisible ? "menu_open" : "menu"
          }}</span>
        </button>
        <button
          @click="toggleRightSidebar"
          :class="
            rightSidebarVisible
              ? 'px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded border border-blue-300 flex items-center justify-center transition-colors'
              : 'px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded border border-gray-300 flex items-center justify-center transition-colors'
          "
          :title="rightSidebarVisible ? 'Hide debug panel' : 'Show debug panel'"
        >
          <span class="material-icons text-base">build</span>
        </button>
      </div>
    </div>

    <!-- Main content area with sidebar -->
    <div class="flex space-x-4" style="height: calc(100vh - 80px)">
      <Sidebar
        v-if="sidebarVisible"
        ref="sidebarRef"
        :chat-active="chatActive"
        :connecting="connecting"
        :plugin-results="toolResults"
        :is-generating-image="isGeneratingImage"
        :generating-message="generatingMessage"
        :selected-result="selectedResult"
        :user-input="userInput"
        :is-muted="isMuted"
        :user-language="userPreferences.userLanguage"
        :suppress-instructions="userPreferences.suppressInstructions"
        :mode-id="userPreferences.modeId"
        :is-conversation-active="conversationActive"
        :enabled-plugins="userPreferences.enabledPlugins"
        :custom-instructions="userPreferences.customInstructions"
        :model-id="userPreferences.modelId"
        :model-kind="userPreferences.modelKind"
        :text-model-id="userPreferences.textModelId"
        :text-model-options="textModelOptions"
        :supports-audio-input="supportsAudioInput"
        :supports-audio-output="supportsAudioOutput"
        :image-generation-backend="userPreferences.imageGenerationBackend"
        :plugin-configs="userPreferences.pluginConfigs"
        @start-chat="startChat"
        @stop-chat="stopChat"
        @set-mute="setMute"
        @select-result="handleSelectResult"
        @send-text-message="sendTextMessage"
        @update:user-input="userInput = $event"
        @update:user-language="userPreferences.userLanguage = $event"
        @update:suppress-instructions="
          userPreferences.suppressInstructions = $event
        "
        @update:mode-id="userPreferences.modeId = $event"
        @update:enabled-plugins="userPreferences.enabledPlugins = $event"
        @update:custom-instructions="
          userPreferences.customInstructions = $event
        "
        @update:model-id="userPreferences.modelId = $event"
        @update:model-kind="userPreferences.modelKind = $event"
        @update:text-model-id="userPreferences.textModelId = $event"
        @update:image-generation-backend="
          userPreferences.imageGenerationBackend = $event
        "
        @update:plugin-configs="userPreferences.pluginConfigs = $event"
        @upload-files="handleUploadFiles"
      />

      <!-- Main content -->
      <div class="flex-1 flex flex-col">
        <div class="flex-1 border rounded bg-gray-50 overflow-hidden">
          <component
            v-if="
              selectedResult &&
              getToolPlugin(selectedResult.toolName)?.viewComponent
            "
            :is="getToolPlugin(selectedResult.toolName).viewComponent"
            :key="selectedResult.uuid"
            :selected-result="selectedResult"
            :send-text-message="sendTextMessage"
            :google-map-key="startResponse?.googleMapKey || null"
            :set-mute="setMute"
            @update-result="handleUpdateResult"
          />
          <div
            v-if="!selectedResult"
            class="w-full h-full flex items-center justify-center"
          >
            <div class="text-gray-400 text-lg">Canvas</div>
          </div>
        </div>
      </div>

      <!-- Right sidebar for debugging -->
      <RightSidebar
        v-if="rightSidebarVisible"
        ref="rightSidebarRef"
        :tool-call-history="toolCallHistory"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { toolExecute, getToolPlugin } from "./tools";
import type { ToolResult } from "./tools";
import Sidebar from "./components/Sidebar.vue";
import RightSidebar from "./components/RightSidebar.vue";
import { useSessionTransport } from "./composables/useSessionTransport";
import { useUserPreferences } from "./composables/useUserPreferences";
import { useToolResults } from "./composables/useToolResults";
import { useScrolling } from "./composables/useScrolling";
import { SESSION_CONFIG } from "./config/session";
import { DEFAULT_TEXT_MODEL } from "./config/textModels";
import {
  DEFAULT_GOOGLE_LIVE_MODEL_ID,
  GOOGLE_LIVE_MODELS,
  REALTIME_MODELS,
} from "./config/models";
import { getMode } from "./config/modes";
import { getLanguageName } from "./config/languages";
import type { TextProvidersResponse } from "../server/types";
import { generateUUID } from "./utils/uuid";

const sidebarRef = ref<InstanceType<typeof Sidebar> | null>(null);
const rightSidebarRef = ref<InstanceType<typeof RightSidebar> | null>(null);
const preferences = useUserPreferences();
const {
  state: userPreferences,
  buildInstructions: buildPreferenceInstructions,
  buildTools: buildPreferenceTools,
} = preferences;

async function sleep(milliseconds: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

const messages = ref<string[]>([]);
const currentText = ref("");
const userInput = ref("");

// Sidebar visibility state (persisted to localStorage)
const SIDEBAR_VISIBLE_KEY = "sidebar_visible_v1";
const sidebarVisible = ref<boolean>(
  localStorage.getItem(SIDEBAR_VISIBLE_KEY) !== "false",
);

function toggleSidebar(): void {
  sidebarVisible.value = !sidebarVisible.value;
  localStorage.setItem(
    SIDEBAR_VISIBLE_KEY,
    sidebarVisible.value ? "true" : "false",
  );
}

// Right sidebar (debug panel) visibility state (persisted to localStorage)
const RIGHT_SIDEBAR_VISIBLE_KEY = "right_sidebar_visible_v1";
const rightSidebarVisible = ref<boolean>(
  localStorage.getItem(RIGHT_SIDEBAR_VISIBLE_KEY) === "true",
);

function toggleRightSidebar(): void {
  rightSidebarVisible.value = !rightSidebarVisible.value;
  localStorage.setItem(
    RIGHT_SIDEBAR_VISIBLE_KEY,
    rightSidebarVisible.value ? "true" : "false",
  );
}

// Tool call history for debugging
interface ToolCallHistoryItem {
  toolName: string;
  args: any;
  timestamp: number;
  result?: ToolResult;
}

const toolCallHistory = ref<ToolCallHistoryItem[]>([]);

function addToolCallToHistory(toolName: string, args: any): void {
  toolCallHistory.value.push({
    toolName,
    args,
    timestamp: Date.now(),
  });
  // Auto-scroll right sidebar to bottom when new item added
  setTimeout(() => {
    rightSidebarRef.value?.scrollToBottom();
  }, 100);
}

function updateToolCallResult(toolName: string, result: ToolResult): void {
  // Find the most recent call with this tool name that doesn't have a result
  for (let i = toolCallHistory.value.length - 1; i >= 0; i--) {
    if (
      toolCallHistory.value[i].toolName === toolName &&
      !toolCallHistory.value[i].result
    ) {
      toolCallHistory.value[i].result = result;
      break;
    }
  }
}

interface TextModelOption {
  id: string;
  label: string;
  disabled?: boolean;
}

const textModelOptions = ref<TextModelOption[]>([
  {
    id: DEFAULT_TEXT_MODEL.rawId,
    label: "OpenAI — gpt-4o-mini (default)",
  },
]);

const PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google Gemini",
  ollama: "Ollama",
};

const scrolling = useScrolling({
  sidebarRef: () => sidebarRef.value,
});

const transportKind = computed(() => userPreferences.modelKind);

const session = useSessionTransport({
  transportKind,
  buildInstructions: (context) => buildPreferenceInstructions(context),
  buildTools: (context) => buildPreferenceTools(context),
  getModelId: () => {
    if (userPreferences.modelKind === "voice-realtime") {
      return userPreferences.modelId;
    }
    if (userPreferences.modelKind === "voice-google-live") {
      // Check if current modelId is a valid Google model
      const isValidGoogleModel = GOOGLE_LIVE_MODELS.some(
        (m) => m.id === userPreferences.modelId,
      );
      return isValidGoogleModel
        ? userPreferences.modelId
        : DEFAULT_GOOGLE_LIVE_MODEL_ID;
    }
    return userPreferences.textModelId;
  },
});

const {
  chatActive,
  conversationActive,
  connecting,
  isMuted,
  startResponse,
  isDataChannelOpen,
  startChat: startTransportChat,
  stopChat: stopTransportChat,
  sendUserMessage: sendUserMessageInternal,
  sendFunctionCallOutput,
  sendInstructions,
  setMute: sessionSetMute,
  setLocalAudioEnabled,
  attachRemoteAudioElement,
  registerEventHandlers,
  capabilities,
} = session;

const supportsAudioInput = computed(
  () => capabilities.value.supportsAudioInput,
);
const supportsAudioOutput = computed(
  () => capabilities.value.supportsAudioOutput,
);

// Status line showing Model / Mode / Language
const statusLine = computed(() => {
  // Get model name
  let modelName = "Unknown";
  if (userPreferences.modelKind === "voice-realtime") {
    const model = REALTIME_MODELS.find((m) => m.id === userPreferences.modelId);
    const label = model?.label || "GPT Realtime";
    modelName = `Voice / ${label}`;
  } else if (userPreferences.modelKind === "voice-google-live") {
    const model = GOOGLE_LIVE_MODELS.find(
      (m) => m.id === userPreferences.modelId,
    );
    const label = model?.label || "Gemini Live";
    modelName = `Voice / ${label}`;
  } else if (userPreferences.modelKind === "text-rest") {
    // For text models, extract the model name from textModelId
    const textModelId = userPreferences.textModelId;
    if (textModelId) {
      const parts = textModelId.split(":");
      if (parts.length === 2) {
        const provider = parts[0];
        const model = parts[1];
        const providerLabel = PROVIDER_LABELS[provider] || provider;
        modelName = `Text / ${providerLabel} ${model}`;
      } else {
        // Handle case where textModelId doesn't have the expected format
        modelName = `Text / ${textModelId}`;
      }
    } else {
      modelName = "Text Mode";
    }
  }

  // Get mode name
  const mode = getMode(userPreferences.modeId);
  const modeName = mode.name;

  // Get language name
  const languageName = getLanguageName(userPreferences.userLanguage);

  return `${modelName} / ${modeName} / ${languageName}`;
});

async function loadTextProviders(): Promise<void> {
  try {
    const response = await fetch("/api/text/providers");
    if (!response.ok) {
      throw new Error(`Failed to load text providers: ${response.statusText}`);
    }
    const payload = (await response.json()) as TextProvidersResponse;
    const options: TextModelOption[] = [];

    for (const provider of payload.providers ?? []) {
      const providerLabel =
        PROVIDER_LABELS[provider.provider] ?? provider.provider;
      const models = new Set<string>();
      if (provider.models?.length) {
        provider.models.forEach((model) => models.add(model));
      }
      if (provider.defaultModel) {
        models.add(provider.defaultModel);
      }
      if (models.size === 0) {
        continue;
      }
      for (const model of models) {
        const isDefault = provider.defaultModel === model;
        const credentialNote = provider.hasCredentials
          ? ""
          : " (credentials required)";
        options.push({
          id: `${provider.provider}:${model}`,
          label: `${providerLabel} — ${model}${isDefault ? " (default)" : ""}${credentialNote}`,
          disabled: !provider.hasCredentials,
        });
      }
    }

    if (options.length === 0) {
      options.push({
        id: DEFAULT_TEXT_MODEL.rawId,
        label: "OpenAI — gpt-4o-mini (default)",
      });
    }

    textModelOptions.value = options;
    const preferred = options.find(
      (option) => option.id === userPreferences.textModelId && !option.disabled,
    );
    const fallback =
      preferred || options.find((option) => !option.disabled) || options[0];
    if (fallback && fallback.id !== userPreferences.textModelId) {
      userPreferences.textModelId = fallback.id;
    }
  } catch (error) {
    console.warn("Failed to load text model providers", error);
    textModelOptions.value = [
      {
        id: DEFAULT_TEXT_MODEL.rawId,
        label: "OpenAI — gpt-4o-mini (default)",
      },
    ];
    if (!userPreferences.textModelId) {
      userPreferences.textModelId = DEFAULT_TEXT_MODEL.rawId;
    }
  }
}

onMounted(() => {
  void loadTextProviders();
});

// Helper function to get plugin config values
const getPluginConfig = <T = any,>(key: string): T | undefined => {
  return userPreferences.pluginConfigs[key] as T | undefined;
};

const {
  toolResults,
  selectedResult,
  isGeneratingImage,
  generatingMessage,
  handleToolCall: originalHandleToolCall,
  handleSelectResult,
  handleUpdateResult,
  handleUploadFiles,
} = useToolResults({
  toolExecute,
  getToolPlugin,
  suppressInstructions: computed(() => userPreferences.suppressInstructions),
  userPreferences: computed(() => userPreferences),
  getPluginConfig,
  sleep,
  sendInstructions,
  sendFunctionCallOutput,
  conversationActive,
  isDataChannelOpen,
  scrollToBottomOfSideBar: scrolling.scrollSidebarToBottom,
  scrollCurrentResultToTop: scrolling.scrollCanvasToTop,
});

// Wrapper to track results immediately
async function handleToolCall(params: any): Promise<void> {
  await originalHandleToolCall(params);
  // After tool execution, update the history with the result
  if (toolResults.value.length > 0) {
    const latestResult = toolResults.value[toolResults.value.length - 1];
    if (latestResult && latestResult.toolName) {
      updateToolCallResult(latestResult.toolName, latestResult);
    }
  }
}

const isListenerMode = computed(() => userPreferences.modeId === "listener");
const lastSpeechStartedTime = ref<number | null>(null);

registerEventHandlers({
  onToolCall: (msg, id, argStr) => {
    // Track tool call in history for debugging
    const toolName = typeof msg === "string" ? msg : msg.name || msg;
    try {
      const args = JSON.parse(argStr);
      addToolCallToHistory(toolName, args);
    } catch {
      addToolCallToHistory(toolName, argStr);
    }
    void handleToolCall({ msg, rawArgs: argStr });
  },
  onTextDelta: (delta) => {
    currentText.value += delta;
  },
  onTextCompleted: () => {
    if (currentText.value.trim()) {
      messages.value.push(currentText.value);
    }
    currentText.value = "";
  },
  onSpeechStarted: () => {
    if (isListenerMode.value) {
      console.log("MSG: Speech started");
    }
  },
  onSpeechStopped: () => {
    if (!isListenerMode.value) {
      return;
    }
    console.log("MSG: Speech stopped");
    const timeSinceLastStart = lastSpeechStartedTime.value
      ? Date.now() - lastSpeechStartedTime.value
      : 0;

    if (timeSinceLastStart > SESSION_CONFIG.LISTENER_MODE_SPEECH_THRESHOLD_MS) {
      console.log("MSG: Speech stopped for a long time");
      setLocalAudioEnabled(false);
      setTimeout(() => {
        setMute(isMuted.value);
        lastSpeechStartedTime.value = Date.now();
      }, SESSION_CONFIG.LISTENER_MODE_AUDIO_GAP_MS);
    }
  },
  onError: (error) => {
    console.error("Session error", error);
  },
});

watch(
  () =>
    supportsAudioOutput.value ? (sidebarRef.value?.audioEl ?? null) : null,
  (audioEl) => {
    attachRemoteAudioElement(audioEl);
  },
  { immediate: true },
);

async function startChat(): Promise<void> {
  // Gard against double start
  if (chatActive.value || connecting.value) return;

  if (supportsAudioInput.value) {
    lastSpeechStartedTime.value = Date.now();
  }
  await startTransportChat();
}

async function sendTextMessage(providedText?: string): Promise<void> {
  const text = (providedText || userInput.value).trim();
  if (!text) return;

  // In text-rest mode, auto-start the session if not active
  if (
    transportKind.value === "text-rest" &&
    !chatActive.value &&
    !connecting.value
  ) {
    await startChat();
  }

  // Add user message as a tool result for conversation history
  // Only add if it's from the user input box (not providedText from other sources)
  if (!providedText) {
    const userMessageResult: ToolResult = {
      uuid: generateUUID(),
      toolName: "text-response",
      message: text,
      title: "You",
      data: {
        text: text,
        role: "user",
        transportKind: transportKind.value,
      },
    };
    toolResults.value.push(userMessageResult);
    scrolling.scrollSidebarToBottom();
  }

  // Wait for conversation to be inactive
  for (
    let i = 0;
    i < SESSION_CONFIG.MESSAGE_SEND_RETRY_ATTEMPTS && conversationActive.value;
    i++
  ) {
    console.log(`WAIT:${i} \n`, text);
    await sleep(SESSION_CONFIG.MESSAGE_SEND_RETRY_DELAY_MS);
  }

  const sent = await sendUserMessageInternal(text);
  if (!sent) {
    return;
  }

  messages.value.push(`You: ${text}`);
  if (!providedText) {
    userInput.value = "";
  }
}

function stopChat(): void {
  stopTransportChat();
}

function setMute(muted: boolean): void {
  if (!supportsAudioInput.value) {
    return;
  }
  sessionSetMute(muted);
}

async function switchMode(newModeId: string): Promise<void> {
  // Step 1: Disconnect if connected
  if (chatActive.value) {
    stopChat();
  }

  // Step 2: Switch to the specified mode
  userPreferences.modeId = newModeId;

  // Wait a brief moment to ensure cleanup is complete
  await sleep(500);

  // Step 3: Connect to the remote LLM
  await startChat();
}

// Expose the API globally for external access
if (typeof window !== "undefined") {
  (window as any).switchMode = switchMode;
}

watch(
  () => userPreferences.modelKind,
  (newKind, previousKind) => {
    if (newKind !== previousKind && chatActive.value) {
      stopChat();
    }
  },
);

// Watch tool results and update history with results
watch(
  () => toolResults.value.length,
  () => {
    // When a new result is added, update the corresponding history entry
    if (toolResults.value.length > 0) {
      const latestResult = toolResults.value[toolResults.value.length - 1];
      if (latestResult && latestResult.toolName) {
        updateToolCallResult(latestResult.toolName, latestResult);
      }
    }
  },
);
</script>

<style scoped></style>
