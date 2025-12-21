# PLAN4: Plugin-Specific Configuration UI Components

## Overview

Extend the `ToolPlugin` type to support optional configuration UI components for each plugin. This allows plugins to provide their own settings interface within the configuration popup, similar to how the `imageGenerationBackend` setting currently works but in a more modular, plugin-specific way.

**Goal**: Move tool-specific configuration from the global config UI into plugin-owned components, making the system more modular and extensible.

## Current Architecture

### Configuration Storage Pattern
Currently, the `imageGenerationBackend` setting demonstrates a tool-specific configuration pattern:

1. **Storage**: Lives in `useUserPreferences` composable
   - Key: `IMAGE_GENERATION_BACKEND_KEY = "image_generation_backend_v1"`
   - State: `imageGenerationBackend: "gemini" | "comfyui"`
   - Persisted to localStorage

2. **UI**: Hardcoded in `Sidebar.vue` config popup (lines 291-311)
   - Dropdown with two options
   - Updates via `update:imageGenerationBackend` event

3. **Usage**: Passed through `ToolContext` to plugin
   - `context.userPreferences?.imageGenerationBackend`
   - Plugin uses it to determine which API endpoint to call

### Problems with Current Approach

1. **Not scalable** - Every new tool setting requires:
   - New field in `UserPreferencesState` interface
   - New localStorage key constant
   - New watcher in `useUserPreferences`
   - New UI code in `Sidebar.vue`
   - New prop/emit declarations

2. **Violates modularity** - Plugin-specific UI lives in global component
3. **Tight coupling** - Sidebar needs to know about every plugin's config needs
4. **Poor separation of concerns** - Plugin logic split between plugin file and Sidebar

## Proposed Architecture

### 1. Plugin Configuration Interface

Extend `ToolPlugin` type to support optional configuration:

```typescript
// src/tools/types.ts

export interface ToolPluginConfig {
  // Storage key for this config (will be prefixed with "plugin_config_")
  key: string;

  // Default value for this configuration
  defaultValue: any;

  // Vue component that renders the configuration UI
  // Props: { value: any }
  // Emits: { 'update:value': [newValue: any] }
  component: any;
}

export interface ToolPlugin<T = Record<string, any>, J = any> {
  toolDefinition: { /* ... existing ... */ };
  execute: (context: ToolContext, args: Record<string, any>) => Promise<ToolResult<T, J>>;
  generatingMessage: string;
  waitingMessage?: string;
  uploadMessage?: string;
  isEnabled: (startResponse?: StartApiResponse) => boolean;
  delayAfterExecution?: number;
  viewComponent?: any;
  previewComponent?: any;
  fileUpload?: FileUploadConfig;
  systemPrompt?: string;

  // NEW: Optional plugin configuration
  config?: ToolPluginConfig;
}
```

### 2. Plugin-Specific Configuration Storage

Store all plugin configs in a single `pluginConfigs` object in user preferences:

```typescript
// src/composables/useUserPreferences.ts

const PLUGIN_CONFIGS_KEY = "plugin_configs_v1";

export interface UserPreferencesState {
  userLanguage: string;
  suppressInstructions: boolean;
  systemPromptId: string;
  customInstructions: string;
  enabledPlugins: Record<string, boolean>;
  modelId: string;
  modelKind: "voice-realtime" | "text-rest";
  textModelId: string;

  // NEW: Unified plugin configuration storage
  // Key: plugin's config.key
  // Value: plugin's config value
  pluginConfigs: Record<string, any>;

  // DEPRECATED: Remove imageGenerationBackend (migrated to pluginConfigs)
}
```

### 3. Plugin Config Component Example

Each plugin provides its own config component:

```vue
<!-- src/tools/configs/ImageGenerationConfig.vue -->
<template>
  <div>
    <label class="block text-sm font-medium text-gray-700 mb-2">
      Image Generation Backend
    </label>
    <select
      :value="value"
      @change="$emit('update:value', ($event.target as HTMLSelectElement).value)"
      class="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <option value="gemini">Google Gemini</option>
      <option value="comfyui">ComfyUI (Local)</option>
    </select>
    <p class="text-xs text-gray-500 mt-1">
      Choose between cloud-based Gemini or local ComfyUI for image generation.
    </p>
  </div>
</template>

<script setup lang="ts">
defineProps<{ value: "gemini" | "comfyui" }>();
defineEmits<{ "update:value": [value: "gemini" | "comfyui"] }>();
</script>
```

### 4. Plugin Registration with Config

Update `generateImage` plugin to use new config system:

```typescript
// src/tools/models/generateImage.ts

import ImageGenerationConfig from "../configs/ImageGenerationConfig.vue";

export const plugin: ToolPlugin<ImageToolData> = {
  toolDefinition,
  execute: generateImage,
  generatingMessage: "Generating image...",
  isEnabled: () => true,
  viewComponent: ImageView,
  previewComponent: ImagePreview,
  fileUpload: {
    acceptedTypes: ["image/png", "image/jpeg"],
    handleUpload: createUploadedImageResult,
  },
  systemPrompt:
    "When you are talking about places, objects, people, movies, books and other things, you MUST use the generateImage API to draw pictures to make the conversation more engaging.",

  // NEW: Plugin-specific configuration
  config: {
    key: "imageGenerationBackend",
    defaultValue: "gemini",
    component: ImageGenerationConfig,
  },
};
```

### 5. Sidebar Config Rendering

Dynamically render plugin configs in the configuration popup:

```vue
<!-- src/components/Sidebar.vue -->

<!-- In the config popup, after "Enabled Plugins" section -->
<div v-if="hasPluginConfigs()">
  <label class="block text-sm font-medium text-gray-700 mb-2 mt-4">
    Plugin Settings
  </label>
  <div class="space-y-4">
    <component
      v-for="pluginModule in getPluginsWithConfig()"
      :key="pluginModule.plugin.config.key"
      :is="pluginModule.plugin.config.component"
      :value="pluginConfigs[pluginModule.plugin.config.key] ?? pluginModule.plugin.config.defaultValue"
      @update:value="handlePluginConfigUpdate(pluginModule.plugin.config.key, $event)"
    />
  </div>
</div>
```

### 6. Helper Functions

Add utility functions to work with plugin configs:

```typescript
// src/tools/index.ts

export const getPluginsWithConfig = () => {
  return pluginList.filter((plugin) => plugin.plugin.config);
};

export const hasAnyPluginConfig = () => {
  return pluginList.some((plugin) => plugin.plugin.config);
};

export const getPluginConfigValue = (
  configs: Record<string, any>,
  toolName: string,
  configKey: string,
): any => {
  const plugin = plugins[toolName];
  if (!plugin?.config || plugin.config.key !== configKey) return undefined;
  return configs[configKey] ?? plugin.config.defaultValue;
};

export const initializePluginConfigs = (): Record<string, any> => {
  const configs: Record<string, any> = {};
  pluginList.forEach((plugin) => {
    if (plugin.plugin.config) {
      configs[plugin.plugin.config.key] = plugin.plugin.config.defaultValue;
    }
  });
  return configs;
};
```

### 7. Context Access in Plugins

Plugins access their config via `ToolContext`:

```typescript
// Updated src/tools/types.ts

export interface ToolContext {
  currentResult: ToolResult<any> | null;
  userPreferences?: UserPreferencesState;

  // NEW: Helper to get plugin config value
  getPluginConfig?: <T = any>(key: string) => T | undefined;
}
```

```typescript
// Updated plugin execution (src/tools/models/generateImage.ts)

export async function generateImageCommon(
  context: ToolContext,
  prompt: string,
  editImage: boolean,
): Promise<ToolResult<ImageToolData>> {
  try {
    // NEW: Get config via helper (falls back to userPreferences for backward compat)
    const backend =
      context.getPluginConfig?.("imageGenerationBackend") ||
      context.userPreferences?.pluginConfigs?.["imageGenerationBackend"] ||
      "gemini";

    const endpoint = backend === "comfyui"
      ? "/api/generate-image/comfy"
      : "/api/generate-image";

    // ... rest of implementation
  }
}
```

## Implementation Plan

### Phase 1: Infrastructure Setup

**Files to modify:**
1. `src/tools/types.ts` - Add `ToolPluginConfig` interface, update `ToolPlugin` and `ToolContext`
2. `src/composables/useUserPreferences.ts` - Add `pluginConfigs` to state, add watchers
3. `src/tools/index.ts` - Add helper functions for config management

### Phase 2: Plugin Config Components

**Files to create:**
1. `src/tools/configs/ImageGenerationConfig.vue` - Config UI for image generation backend

**Files to modify:**
1. `src/tools/models/generateImage.ts` - Add `config` field to plugin export
2. `src/tools/models/editImage.ts` - Share same config with generateImage if needed

### Phase 3: UI Integration

**Files to modify:**
1. `src/components/Sidebar.vue` -
   - Add plugin config rendering section
   - Add `handlePluginConfigUpdate()` method
   - Add props/emits for `pluginConfigs`
   - Remove hardcoded `imageGenerationBackend` UI (lines 291-311)

2. `src/App.vue` -
   - Pass `pluginConfigs` to Sidebar
   - Handle `update:pluginConfigs` event
   - Update `ToolContext` creation to include `getPluginConfig` helper

### Phase 4: Migration & Cleanup

**Tasks:**
1. Add migration logic to move `imageGenerationBackend` from old key to new `pluginConfigs` object
2. Remove deprecated `imageGenerationBackend` field from `UserPreferencesState`
3. Remove `IMAGE_GENERATION_BACKEND_KEY` and its watcher
4. Update all localStorage reads to use new structure

## Benefits

1. **Modularity** - Plugin config UI lives with the plugin code
2. **Scalability** - Adding new plugin configs requires no changes to core UI
3. **Type Safety** - Each plugin defines its own config types
4. **Reusability** - Config components can be reused across plugins
5. **Maintainability** - Plugin authors own their complete feature (logic + UI)
6. **Separation of Concerns** - Sidebar only handles generic plugin config rendering

## Migration Strategy

### Backward Compatibility
During transition, support both old and new config access:

```typescript
// In plugin execute functions
const backend =
  context.getPluginConfig?.("imageGenerationBackend") || // New way
  context.userPreferences?.imageGenerationBackend ||      // Old way (deprecated)
  "gemini";                                               // Default
```

### Data Migration
Add one-time migration in `useUserPreferences`:

```typescript
// Migrate old imageGenerationBackend to new pluginConfigs
const migrateOldConfigs = () => {
  const oldBackend = getStoredValue(IMAGE_GENERATION_BACKEND_KEY);
  const existingConfigs = getStoredValue(PLUGIN_CONFIGS_KEY);

  if (oldBackend && !existingConfigs) {
    const configs = { imageGenerationBackend: oldBackend };
    setStoredValue(PLUGIN_CONFIGS_KEY, JSON.stringify(configs));
  }
};
```

## Future Extensions

Once this pattern is established, other plugins can easily add configs:

1. **Map plugin**: Choose between Google Maps / OpenStreetMap
2. **Browse plugin**: Set default timeout, user agent
3. **Music plugin**: Select music service (Spotify, YouTube Music, etc.)
4. **Mulmocast plugin**: Video quality settings, narration voice
5. **Canvas plugin**: Default canvas size, background color

Each would simply export a `config` field with their UI component.

## Files Summary

### New Files
- `src/tools/configs/ImageGenerationConfig.vue` - Config UI component

### Modified Files
- `src/tools/types.ts` - Add `ToolPluginConfig` interface
- `src/composables/useUserPreferences.ts` - Add `pluginConfigs` state
- `src/tools/index.ts` - Add helper functions
- `src/tools/models/generateImage.ts` - Add config export
- `src/components/Sidebar.vue` - Render plugin configs dynamically
- `src/App.vue` - Pass configs and create helper in context

### Deprecated (for removal later)
- `UserPreferencesState.imageGenerationBackend` field
- `IMAGE_GENERATION_BACKEND_KEY` constant
- Hardcoded image backend UI in Sidebar.vue (lines 291-311)
