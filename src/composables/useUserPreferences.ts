/* eslint-env browser */

import { reactive, watch } from "vue";
import { DEFAULT_LANGUAGE_CODE, getLanguageName } from "../config/languages";
import { DEFAULT_MODE_ID, getMode } from "../config/modes";
import { pluginTools, getPluginSystemPrompts } from "../tools";
import { DEFAULT_REALTIME_MODEL_ID } from "../config/models";
import { DEFAULT_TEXT_MODEL } from "../config/textModels";
import type { BuildContext } from "./types";

const USER_LANGUAGE_KEY = "user_language_v1";
const SUPPRESS_INSTRUCTIONS_KEY = "suppress_instructions_v1";
const MODE_ID_KEY = "mode_id_v2";
const LEGACY_SYSTEM_PROMPT_ID_KEY = "system_prompt_id_v1"; // For migration
const ENABLED_PLUGINS_KEY = "enabled_plugins_v1";
const CUSTOM_INSTRUCTIONS_KEY = "custom_instructions_v1";
const MODEL_ID_KEY = "model_id_v1";
const MODEL_KIND_KEY = "model_kind_v2";
const TEXT_MODEL_ID_KEY = "text_model_id_v1";
const IMAGE_GENERATION_BACKEND_KEY = "image_generation_backend_v1";
const PLUGIN_CONFIGS_KEY = "plugin_configs_v1";

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const getStorage = (): StorageLike | null => {
  const globalObj = globalThis as { localStorage?: StorageLike };
  return globalObj.localStorage ?? null;
};

const getStoredValue = (key: string): string | null => {
  const storage = getStorage();
  return storage?.getItem(key) ?? null;
};

const setStoredValue = (key: string, value: string) => {
  const storage = getStorage();
  storage?.setItem(key, value);
};

const setStoredObject = (key: string, value: Record<string, boolean>) => {
  const storage = getStorage();
  storage?.setItem(key, JSON.stringify(value));
};

export interface UserPreferencesState {
  userLanguage: string;
  suppressInstructions: boolean;
  modeId: string;
  customInstructions: string;
  enabledPlugins: Record<string, boolean>;
  modelId: string;
  modelKind: "voice-realtime" | "text-rest";
  textModelId: string;
  imageGenerationBackend: "gemini" | "comfyui";
  pluginConfigs: Record<string, any>;
}

export interface UseUserPreferencesReturn {
  state: UserPreferencesState;
  buildInstructions: (context: BuildContext) => string;
  buildTools: (context: BuildContext) => unknown[];
}

const initEnabledPlugins = (): Record<string, boolean> => {
  const stored = getStoredValue(ENABLED_PLUGINS_KEY);
  if (!stored) return {};
  try {
    return JSON.parse(stored);
  } catch {
    return {};
  }
};

const initPluginConfigs = (): Record<string, any> => {
  const stored = getStoredValue(PLUGIN_CONFIGS_KEY);
  if (!stored) return {};
  try {
    return JSON.parse(stored);
  } catch {
    return {};
  }
};

const resolveStoredModelKind = (
  stored: string | null,
): UserPreferencesState["modelKind"] => {
  if (stored === "text-rest") return "text-rest";
  return "voice-realtime";
};

// Migrate old imageGenerationBackend to new pluginConfigs
const migrateOldConfigs = (): Record<string, any> => {
  const configs = initPluginConfigs();

  // If we already have the new config, no migration needed
  if (configs.imageGenerationBackend) {
    return configs;
  }

  // Check for old imageGenerationBackend setting
  const oldBackend = getStoredValue(IMAGE_GENERATION_BACKEND_KEY);
  if (oldBackend) {
    configs.imageGenerationBackend = oldBackend;
    // Save the migrated config
    setStoredObject(PLUGIN_CONFIGS_KEY, configs);
  }

  return configs;
};

export function useUserPreferences(): UseUserPreferencesReturn {
  const storedModelKind = resolveStoredModelKind(
    getStoredValue(MODEL_KIND_KEY),
  );
  const state = reactive<UserPreferencesState>({
    userLanguage: getStoredValue(USER_LANGUAGE_KEY) || DEFAULT_LANGUAGE_CODE,
    suppressInstructions: getStoredValue(SUPPRESS_INSTRUCTIONS_KEY) === "true",
    modeId:
      getStoredValue(MODE_ID_KEY) ||
      getStoredValue(LEGACY_SYSTEM_PROMPT_ID_KEY) ||
      DEFAULT_MODE_ID,
    customInstructions: getStoredValue(CUSTOM_INSTRUCTIONS_KEY) || "",
    enabledPlugins: initEnabledPlugins(),
    modelId: getStoredValue(MODEL_ID_KEY) || DEFAULT_REALTIME_MODEL_ID,
    modelKind: storedModelKind,
    textModelId: getStoredValue(TEXT_MODEL_ID_KEY) || DEFAULT_TEXT_MODEL.rawId,
    imageGenerationBackend:
      (getStoredValue(IMAGE_GENERATION_BACKEND_KEY) as "gemini" | "comfyui") ||
      "gemini",
    pluginConfigs: migrateOldConfigs(),
  });

  watch(
    () => state.userLanguage,
    (val) => {
      setStoredValue(USER_LANGUAGE_KEY, val);
    },
  );

  watch(
    () => state.suppressInstructions,
    (val) => {
      setStoredValue(SUPPRESS_INSTRUCTIONS_KEY, String(val));
    },
  );

  watch(
    () => state.modeId,
    (val) => {
      setStoredValue(MODE_ID_KEY, val);
      // Clean up old key after migration
      const storage = getStorage();
      if (storage?.getItem(LEGACY_SYSTEM_PROMPT_ID_KEY)) {
        storage.setItem(LEGACY_SYSTEM_PROMPT_ID_KEY, "");
      }
    },
  );

  watch(
    () => state.customInstructions,
    (val) => {
      setStoredValue(CUSTOM_INSTRUCTIONS_KEY, val);
    },
  );

  watch(
    () => state.modelId,
    (val) => {
      setStoredValue(MODEL_ID_KEY, val);
    },
  );

  watch(
    () => state.modelKind,
    (val) => {
      setStoredValue(MODEL_KIND_KEY, val);
    },
  );

  watch(
    () => state.textModelId,
    (val) => {
      setStoredValue(TEXT_MODEL_ID_KEY, val);
    },
  );

  watch(
    () => state.imageGenerationBackend,
    (val) => {
      setStoredValue(IMAGE_GENERATION_BACKEND_KEY, val);
    },
  );

  watch(
    () => state.enabledPlugins,
    (val) => {
      setStoredObject(ENABLED_PLUGINS_KEY, val);
    },
    { deep: true },
  );

  watch(
    () => state.pluginConfigs,
    (val) => {
      setStoredObject(PLUGIN_CONFIGS_KEY, val);
    },
    { deep: true },
  );

  const buildInstructions = ({ startResponse }: InstructionBuildContext) => {
    const mode = getMode(state.modeId);
    const pluginPrompts = mode.includePluginPrompts
      ? getPluginSystemPrompts(
          startResponse,
          state.enabledPlugins,
          state.modeId,
        )
      : "";
    const customInstructionsText = state.customInstructions.trim()
      ? ` ${state.customInstructions}`
      : "";
    return `${mode.prompt}${pluginPrompts}${customInstructionsText} The user's native language is ${getLanguageName(state.userLanguage)}.`;
  };

  const buildTools = ({ startResponse }: InstructionBuildContext) =>
    pluginTools(startResponse, state.enabledPlugins, state.modeId);

  return {
    state,
    buildInstructions,
    buildTools,
  };
}
