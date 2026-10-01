<template>
  <!-- The visual mode (after MulmoGlass): the canvas fills a dark screen,
       with the controls in a bar below it; no sidebar, no text entry. -->
  <div
    :class="
      visualMode
        ? 'h-screen flex flex-col bg-slate-950 text-slate-100'
        : 'p-4 space-y-4'
    "
  >
    <div
      v-if="!visualMode"
      role="toolbar"
      class="flex justify-between items-center"
    >
      <h1 class="text-2xl font-bold">
        MulmoChat
        <span class="text-sm text-gray-500 font-normal">{{ statusLine }}</span>
      </h1>
      <div class="flex gap-2">
        <button
          @click="setVisualMode(true)"
          class="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded border border-gray-300 flex items-center justify-center transition-colors"
          title="Visual mode"
        >
          <span class="material-icons text-base">view_in_ar</span>
        </button>
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
    <div
      :class="visualMode ? 'flex-1 min-h-0 flex' : 'flex space-x-4'"
      :style="visualMode ? undefined : { height: 'calc(100vh - 80px)' }"
    >
      <!-- Hidden, not removed: it holds OpenAI's <audio> element and the
           configuration popup. -->
      <Sidebar
        v-show="sidebarVisible && !visualMode"
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
        :show-role-list="userPreferences.showRoleList"
        :role-id="userPreferences.roleId"
        :is-conversation-active="conversationActive"
        :enabled-plugins="userPreferences.enabledPlugins"
        :custom-instructions="userPreferences.customInstructions"
        :model-id="userPreferences.modelId"
        :model-kind="userPreferences.modelKind"
        :text-model-id="userPreferences.textModelId"
        :text-model-options="textModelOptions"
        :supports-audio-input="supportsAudioInput"
        :supports-audio-output="supportsAudioOutput"
        :plugin-configs="userPreferences.pluginConfigs"
        @start-chat="startChat"
        @stop-chat="stopChat"
        @set-mute="setMute"
        @select-result="handleSelectResult"
        @send-text-message="sendTextMessage($event)"
        @clear-results="clearResults"
        @update:user-input="userInput = $event"
        @update:user-language="userPreferences.userLanguage = $event"
        @update:suppress-instructions="
          userPreferences.suppressInstructions = $event
        "
        @update:show-role-list="userPreferences.showRoleList = $event"
        @update:role-id="userPreferences.roleId = $event"
        @update:enabled-plugins="userPreferences.enabledPlugins = $event"
        @update:custom-instructions="
          userPreferences.customInstructions = $event
        "
        @update:model-id="userPreferences.modelId = $event"
        @update:model-kind="userPreferences.modelKind = $event"
        @update:text-model-id="userPreferences.textModelId = $event"
        @update:plugin-configs="userPreferences.pluginConfigs = $event"
        @upload-files="handleUploadFiles"
      />

      <!-- Main content -->
      <div class="flex-1 min-w-0 flex flex-col relative">
        <div
          class="flex-1 min-h-0 overflow-hidden"
          :class="
            visualMode
              ? selectedResult
                ? 'bg-white text-slate-900'
                : ''
              : 'border border-gray-300 rounded bg-gray-50'
          "
        >
          <component
            v-if="
              selectedResult &&
              selectedResult.toolName &&
              getToolPlugin(selectedResult.toolName)?.viewComponent
            "
            :is="getToolPlugin(selectedResult.toolName!)!.viewComponent"
            :key="selectedResult.uuid"
            :selected-result="selectedResult"
            :send-text-message="sendTextMessage"
            :google-map-key="startResponse?.googleMapKey || null"
            :set-mute="setMute"
            :plugin-configs="userPreferences.pluginConfigs"
            :is-audio-playing="isAudioPlaying"
            @update-result="handleUpdateResult"
          />
          <div
            v-if="!selectedResult && visualMode"
            class="w-full h-full flex flex-col items-center justify-center gap-4 px-8 text-center text-slate-400"
          >
            <span class="material-icons" style="font-size: 96px"
              >view_in_ar</span
            >
            <p class="text-2xl">{{ visualPrompt }}</p>
          </div>
          <div
            v-else-if="!selectedResult"
            class="w-full h-full flex items-center justify-center"
          >
            <div class="text-gray-400 text-lg">Canvas</div>
          </div>
        </div>
        <!-- The sidebar shows this below the results; here it floats. -->
        <div
          v-if="visualMode && isGeneratingImage"
          class="absolute top-6 left-1/2 -translate-x-1/2 rounded-full bg-slate-800/90 px-6 py-3 text-xl text-slate-100 flex items-center gap-3"
        >
          <span class="material-icons animate-spin">autorenew</span>
          {{ generatingMessage }}
        </div>
      </div>

      <!-- Right sidebar for debugging -->
      <RightSidebar
        v-if="rightSidebarVisible && !visualMode"
        ref="rightSidebarRef"
        :tool-call-history="toolCallHistory"
      />
    </div>

    <VisualControlBar
      v-if="visualMode"
      :chat-active="chatActive"
      :connecting="connecting"
      :can-connect="userPreferences.modelKind !== 'text-rest'"
      :is-muted="isMuted"
      :supports-audio-input="supportsAudioInput"
      :state="visualState"
      :status="statusLine"
      :result-count="toolResults.length"
      :selected-index="selectedIndex"
      :audio-debug="audioDebugEnabled"
      @toggle-chat="chatActive ? stopChat() : startChat()"
      @toggle-mute="setMute(!isMuted)"
      @select="selectResultAt"
      @save-audio="saveAudioDebugRecording"
      @open-settings="sidebarRef?.openConfig()"
      @exit="setVisualMode(false)"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import type { ToolResult } from "gui-chat-protocol/vue";
import {
  toolExecute,
  getToolPlugin,
  setPluginLocale,
  setPluginDispatchConfig,
} from "../tools";
import Sidebar from "../components/Sidebar.vue";
import RightSidebar from "../components/RightSidebar.vue";
import VisualControlBar from "../components/VisualControlBar.vue";
import {
  isAudioDebugEnabled,
  saveAudioDebugRecording,
} from "../utils/audioDebugRecorder";
import { useSessionTransport } from "../composables/useSessionTransport";
import { useUserPreferences } from "../composables/useUserPreferences";
import { useToolResults } from "../composables/useToolResults";
import { useScrolling } from "../composables/useScrolling";
import { createSequenceKeeper } from "gui-chat-protocol";
import { SESSION_CONFIG } from "../config/session";
import { DEFAULT_TEXT_MODEL, type TextModelOption } from "../config/textModels";
import {
  DEFAULT_GOOGLE_LIVE_MODEL_ID,
  DEFAULT_GROK_VOICE_MODEL_ID,
  GOOGLE_LIVE_MODELS,
  GROK_VOICE_MODELS,
  REALTIME_MODELS,
} from "../config/models";
import { getRole } from "../config/roles";
import { imageModelShortLabel } from "../config/imageModels";
import { normalizeImageConfig } from "../tools/backend/imageGeneration";
import type { ImageGenerationConfigValue } from "../tools/backend/types";
import { getLanguageName } from "../config/languages";
import type { TextProvidersResponse } from "../../server/types";
import { v4 as uuidv4 } from "uuid";

const sidebarRef = ref<InstanceType<typeof Sidebar> | null>(null);
const rightSidebarRef = ref<InstanceType<typeof RightSidebar> | null>(null);
const preferences = useUserPreferences();
const {
  state: userPreferences,
  buildInstructions: buildPreferenceInstructions,
  buildTools: buildPreferenceTools,
} = preferences;

// Plugin views show their text in the user's language
watch(() => userPreferences.userLanguage, setPluginLocale, {
  immediate: true,
});

// Plugin views that call the server (useRuntime().dispatch) use the user's
// image settings, the same ones tool calls send (see useToolResults)
watch(
  () => ({
    imageGeneration: {
      ...normalizeImageConfig(
        userPreferences.pluginConfigs.imageGenerationBackend as
          string | ImageGenerationConfigValue | undefined,
      ),
      comfyuiModel:
        userPreferences.comfyuiModel || "flux1-schnell-fp8.safetensors",
    },
  }),
  setPluginDispatchConfig,
  { immediate: true, deep: true },
);

async function sleep(milliseconds: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

const messages = ref<string[]>([]);
const currentText = ref("");
const userInput = ref("");

// Callback for switchRole plugin (set after function definition)
const switchRoleCallback = ref<((roleId: string) => void) | null>(null);

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

// The visual mode (persisted to localStorage): see the template.
const VISUAL_MODE_KEY = "visual_mode_v1";
const visualMode = ref<boolean>(
  localStorage.getItem(VISUAL_MODE_KEY) === "true",
);

function setVisualMode(on: boolean): void {
  visualMode.value = on;
  localStorage.setItem(VISUAL_MODE_KEY, on ? "true" : "false");
}

const audioDebugEnabled = isAudioDebugEnabled();

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
  error?: string;
}

const toolCallHistory = ref<ToolCallHistoryItem[]>([]);

// The entry it returns is the one to give the call's outcome: calls run at the
// same time (a model's several searches), and "the latest result, on the
// latest call of that tool without one" put results on the wrong calls.
function addToolCallToHistory(
  toolName: string,
  args: any,
): ToolCallHistoryItem {
  toolCallHistory.value.push({
    toolName,
    args,
    timestamp: Date.now(),
  });
  // Auto-scroll right sidebar to bottom when new item added
  setTimeout(() => {
    rightSidebarRef.value?.scrollToBottom();
  }, 100);
  return toolCallHistory.value[toolCallHistory.value.length - 1];
}

// The option shown before the providers load, or when none is configured.
const DEFAULT_TEXT_MODEL_OPTION: TextModelOption = {
  id: DEFAULT_TEXT_MODEL.rawId,
  provider: DEFAULT_TEXT_MODEL.provider,
  providerLabel: "OpenAI",
  model: DEFAULT_TEXT_MODEL.model,
  isDefault: true,
};

const textModelOptions = ref<TextModelOption[]>([DEFAULT_TEXT_MODEL_OPTION]);

const PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google Gemini",
  ollama: "Ollama",
  grok: "xAI Grok",
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
    if (userPreferences.modelKind === "voice-grok") {
      return GROK_VOICE_MODELS.some((m) => m.id === userPreferences.modelId)
        ? userPreferences.modelId
        : DEFAULT_GROK_VOICE_MODEL_ID;
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
  stopChatFor: stopTransportChatFor,
  sendUserMessage: sendUserMessageInternal,
  sendFunctionCallOutput,
  sendInstructions,
  sendImagesToModel,
  continueConversation,
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

// Status line showing Model / Mode / Language / Image Model
const statusLine = computed(() => {
  // Get model name
  let modelName = "Unknown";
  if (userPreferences.modelKind === "voice-realtime") {
    const model = REALTIME_MODELS.find((m) => m.id === userPreferences.modelId);
    const label = model?.label || "GPT Realtime";
    modelName = label;
  } else if (userPreferences.modelKind === "voice-google-live") {
    const model = GOOGLE_LIVE_MODELS.find(
      (m) => m.id === userPreferences.modelId,
    );
    const label = model?.label || "Gemini Live";
    modelName = label;
  } else if (userPreferences.modelKind === "voice-grok") {
    const model = GROK_VOICE_MODELS.find(
      (m) => m.id === userPreferences.modelId,
    );
    modelName = model?.label || "Grok Voice";
  } else if (userPreferences.modelKind === "text-rest") {
    // For text models, extract the model name from textModelId
    const textModelId = userPreferences.textModelId;
    if (textModelId) {
      const parts = textModelId.split(":");
      if (parts.length === 2) {
        const provider = parts[0];
        const model = parts[1];
        const providerLabel = PROVIDER_LABELS[provider] || provider;
        modelName = `${providerLabel} ${model}`;
      } else {
        // Handle case where textModelId doesn't have the expected format
        modelName = textModelId;
      }
    } else {
      modelName = "Text Mode";
    }
  }

  // Get image model name (handles the legacy string format and renamed IDs)
  const imageModelName = imageModelShortLabel(
    normalizeImageConfig(
      userPreferences.pluginConfigs.imageGenerationBackend as
        string | ImageGenerationConfigValue | undefined,
    ),
  );

  // Get role name
  const role = getRole(userPreferences.roleId);
  const roleName = role.name;

  // Get language name
  const languageName = getLanguageName(userPreferences.userLanguage);

  return `${modelName} / ${imageModelName} / ${roleName} / ${languageName}`;
});

// The visual mode's control bar and empty canvas.
const visualState = computed(() => {
  if (userPreferences.modelKind === "text-rest") {
    return "The visual mode needs a voice model: choose one in Configuration.";
  }
  if (connecting.value) return "Connecting…";
  if (!chatActive.value) return "Tap the microphone to start.";
  if (isMuted.value) return "Muted";
  return conversationActive.value ? "Responding…" : "Listening";
});

const visualPrompt = computed(() => {
  if (chatActive.value) return "Ask for anything — results appear here.";
  // A text model can't connect here (no text entry): the button is disabled.
  if (userPreferences.modelKind === "text-rest") {
    return "Choose a voice model in Configuration to start.";
  }
  return "Tap the microphone to start.";
});

const selectedIndex = computed(() =>
  selectedResult.value ? toolResults.value.indexOf(selectedResult.value) : -1,
);

function selectResultAt(index: number): void {
  const result = toolResults.value[index];
  if (result) handleSelectResult(result);
}

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
        options.push({
          id: `${provider.provider}:${model}`,
          provider: provider.provider,
          providerLabel,
          model,
          isDefault: provider.defaultModel === model,
          disabled: !provider.hasCredentials,
        });
      }
    }

    if (options.length === 0) {
      options.push(DEFAULT_TEXT_MODEL_OPTION);
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
    textModelOptions.value = [DEFAULT_TEXT_MODEL_OPTION];
    if (!userPreferences.textModelId) {
      userPreferences.textModelId = DEFAULT_TEXT_MODEL.rawId;
    }
  }
}

onMounted(() => {
  void loadTextProviders();
});

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
  sleep,
  sendInstructions,
  sendFunctionCallOutput,
  sendImagesToModel,
  conversationActive,
  isDataChannelOpen,
  scrollToBottomOfSideBar: scrolling.scrollSidebarToBottom,
  scrollCurrentResultToTop: scrolling.scrollCanvasToTop,
  switchRole: (roleId: string) => {
    switchRoleCallback.value?.(roleId);
  },
  onResult: (result, startedAt) => sequence.observe(result, startedAt),
  getUserSpokeAt: () => sequence.userSpokeAt(),
  waitForSpeechEnd,
});

// Keeps a slideshow or a story going (gui-chat-protocol's sequence keeper):
// asks the model once to go on when it ends a reply mid-sequence. The
// results say where the sequence is (ToolResult.sequence), and the user
// speaking or sending a message stops it.
const sequence = createSequenceKeeper({
  isIdle: () =>
    chatActive.value &&
    !conversationActive.value &&
    !isAudioPlaying.value &&
    !userSpeaking.value &&
    !isGeneratingImage.value,
  // Required: text chat takes a turn for them.
  sendInstructions: (instructions) => sendInstructions(instructions, true),
  continueConversation,
  log: (message) => console.info(`[sequence] ${message}`),
});

// Runs a call and puts its outcome on its own history entry.
async function handleToolCall(
  params: any,
  entry: ToolCallHistoryItem,
): Promise<void> {
  try {
    const outcome = await originalHandleToolCall(params);
    if (outcome && "result" in outcome) entry.result = outcome.result;
    else if (outcome) entry.error = outcome.error;
  } catch (error) {
    entry.error = error instanceof Error ? error.message : String(error);
  }
}

const isListenerMode = computed(() => userPreferences.roleId === "listener");
const lastSpeechStartedTime = ref<number | null>(null);

// LLM audio playback state (for avatar lip-sync, visual feedback, etc.)
const isAudioPlaying = ref(false);

// The longest a sequence step waits for the model's voice to finish: a
// playback-stopped event that never comes must not hold the step forever.
const SPEECH_WAIT_MAX_MS = 120_000;
// How long playback must stay stopped to count as the end of the voice. The
// audio queue can run dry for a moment while a reply's audio is still
// arriving (seen with Grok: stopped and started again within a second),
// which would otherwise release a step mid-explanation.
const SPEECH_END_QUIET_MS = 800;

// How long a step queued behind another waits, once that one is shown, for
// the model to start explaining it; past that the step is shown.
const SPEECH_START_WAIT_MS = 6_000;

// The step being held, when one is: a step asked for meanwhile waits for it.
let heldStep: Promise<boolean> | null = null;

/** Resolves when the model's voice has finished playing (stopped for
 *  SPEECH_END_QUIET_MS) or SPEECH_WAIT_MAX_MS has passed: true; or when the
 *  chat ended while waiting: false, so the step isn't shown after Stop. A
 *  chat that isn't active (text chat) doesn't wait.
 *
 *  One step at a time. A held step's result hasn't reached the model, so it
 *  may ask for the next step meanwhile (Grok asked for slide 3 six seconds
 *  after slide 2); both would then appear the moment the voice stopped, and
 *  slide 2 would be replaced at once. A step asked for while another is
 *  held waits until that one is shown, then for the model to explain it:
 *  its voice to start (at most SPEECH_START_WAIT_MS) and end. */
function waitForSpeechEnd(): Promise<boolean> {
  if (!chatActive.value) return Promise.resolve(true);
  const before = heldStep;
  const mine: Promise<boolean> = (async () => {
    if (before) {
      console.info("[sequence] step queued behind the one held");
      if (!(await before)) return false;
      if (!(await waitForSpeechStart())) return false;
    }
    return waitForQuiet();
  })();
  heldStep = mine;
  void mine.finally(() => {
    if (heldStep === mine) heldStep = null;
  });
  return mine;
}

/** Resolves when the model's voice starts playing, or after
 *  SPEECH_START_WAIT_MS without it: true; when the chat ends first: false. */
function waitForSpeechStart(): Promise<boolean> {
  if (!chatActive.value) return Promise.resolve(false);
  if (isAudioPlaying.value) return Promise.resolve(true);
  return new Promise((resolve) => {
    const done = (goOn: boolean) => {
      stopWatching();
      clearTimeout(limit);
      resolve(goOn);
    };
    const limit = setTimeout(() => done(true), SPEECH_START_WAIT_MS);
    const stopWatching = watch([isAudioPlaying, chatActive], () => {
      if (!chatActive.value) done(false);
      else if (isAudioPlaying.value) done(true);
    });
  });
}

/** The wait for the voice to stop (see waitForSpeechEnd). */
function waitForQuiet(): Promise<boolean> {
  if (!chatActive.value) return Promise.resolve(false);
  const started = Date.now();
  return new Promise((resolve) => {
    let quiet: ReturnType<typeof setTimeout> | undefined;
    const done = (why: string, goOn = true) => {
      stopWatching();
      clearTimeout(limit);
      clearTimeout(quiet);
      const waited = Date.now() - started;
      if (waited > SPEECH_END_QUIET_MS) {
        console.info(
          `[sequence] step ${goOn ? "shown" : "dropped"} after ${waited} ms (${why})`,
        );
      }
      resolve(goOn);
    };
    const check = () => {
      clearTimeout(quiet);
      quiet = undefined;
      if (!chatActive.value) return done("chat ended", false);
      if (!isAudioPlaying.value) {
        quiet = setTimeout(() => done("voice ended"), SPEECH_END_QUIET_MS);
      }
    };
    const limit = setTimeout(() => done("waited too long"), SPEECH_WAIT_MAX_MS);
    const stopWatching = watch([isAudioPlaying, chatActive], check);
    check();
  });
}
// Between the voice transport's speech started and stopped events. A session
// that ends mid-speech (stopped, dropped, switched) sends no stopped event.
const userSpeaking = ref(false);
// A session that ends mid-reply (stopped, dropped, switched) may send no
// playback-stopped event either (OpenAI's stopChat doesn't), and a stale
// isAudioPlaying would hold every sequence step of the next session for
// SPEECH_WAIT_MAX_MS.
watch(chatActive, (active) => {
  if (active) return;
  userSpeaking.value = false;
  isAudioPlaying.value = false;
});

registerEventHandlers({
  onToolCall: async (msg, id, argStr) => {
    // Track tool call in history for debugging
    const toolName = typeof msg === "string" ? msg : msg.name || "unknown";
    let args: unknown = argStr;
    try {
      args = JSON.parse(argStr);
    } catch {
      // Shown as the model sent it.
    }
    const entry = addToolCallToHistory(toolName, args);
    await handleToolCall({ msg, rawArgs: argStr }, entry);
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
    userSpeaking.value = true;
    sequence.userSpoke();
    if (isListenerMode.value) {
      console.log("MSG: Speech started");
    }
  },
  onSpeechStopped: () => {
    userSpeaking.value = false;
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
  onConversationFinished: () => sequence.replyEnded(),
  onError: (error) => {
    console.error("Session error", error);
  },

  // LLM audio playback events (for avatar lip-sync, visual feedback, etc.)
  onAudioPlaybackStarted: () => {
    console.log("[Avatar Debug] HomeView: isAudioPlaying = true");
    isAudioPlaying.value = true;
  },
  onAudioPlaybackStopped: () => {
    console.log("[Avatar Debug] HomeView: isAudioPlaying = false");
    isAudioPlaying.value = false;
    sequence.replyEnded();
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
  // A typed message is the user speaking: it may be "next" to a step that
  // waits for them, or "stop".
  sequence.userSpoke();

  // In text-rest mode, auto-start the session if not active
  if (
    transportKind.value === "text-rest" &&
    !chatActive.value &&
    !connecting.value
  ) {
    await startChat();
  }

  // Add user message as a tool result for conversation history
  const userMessageResult: ToolResult = {
    uuid: uuidv4(),
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
}

function stopChat(): void {
  sequence.stop();
  stopTransportChat();
}

function setMute(muted: boolean): void {
  if (!supportsAudioInput.value) {
    return;
  }
  sessionSetMute(muted);
}

function clearResults(): void {
  toolResults.value = [];
  toolCallHistory.value = [];
  selectedResult.value = null;
}

async function switchRole(newRoleId: string): Promise<void> {
  // Step 1: Disconnect if connected
  if (chatActive.value) {
    stopChat();
  }

  // Step 2: Switch to the specified role
  userPreferences.roleId = newRoleId;

  // Wait a brief moment to ensure cleanup is complete
  await sleep(500);

  // Step 3: Connect to the remote LLM
  await startChat();
}

// Set the switchRole callback for the plugin
switchRoleCallback.value = switchRole;

watch(
  () => userPreferences.modelKind,
  (newKind, previousKind) => {
    // The active session already follows newKind, so stop the previous one
    // by kind (a still-open voice connection would keep the microphone).
    if (newKind !== previousKind) {
      stopTransportChatFor(previousKind);
    }
  },
);
</script>

<style scoped></style>
