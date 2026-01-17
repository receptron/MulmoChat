# Plugin Configuration Flow

This document describes how user preferences and plugin configurations flow through the MulmoChat application.

## Overview

```
localStorage
    ↓
useUserPreferences (composables)
    ↓
HomeView.vue (getPluginConfig関数を定義)
    ↓
useToolResults (composables)
    ↓
ToolContext (plugins receive)
    ↓
backend/ (config utilities)
    ↓
models/ (plugin execute)
```

## 1. Storage Layer (localStorage)

プラグイン設定は `localStorage` の `plugin_configs_v1` キーに JSON として保存される。

```typescript
// Key: "plugin_configs_v1"
// Value: { "imageGenerationBackend": {...}, "htmlGenerationBackend": "claude" }
```

関連コード: `src/composables/useUserPreferences.ts`

```typescript
const PLUGIN_CONFIGS_KEY = "plugin_configs_v1";

const initPluginConfigs = (): Record<string, any> => {
  const stored = getStoredValue(PLUGIN_CONFIGS_KEY);
  if (!stored) return {};
  try {
    return JSON.parse(stored);
  } catch {
    return {};
  }
};
```

## 2. useUserPreferences

`UserPreferencesState` インターフェースで `pluginConfigs` を定義。

```typescript
// src/composables/useUserPreferences.ts

export interface UserPreferencesState extends Record<string, unknown> {
  userLanguage: string;
  suppressInstructions: boolean;
  roleId: string;
  // ... other fields
  pluginConfigs: Record<string, any>;  // ← プラグイン設定
}
```

変更を監視し、自動的に localStorage に永続化:

```typescript
watch(
  () => state.pluginConfigs,
  (val) => {
    setStoredObject(PLUGIN_CONFIGS_KEY, val);
  },
  { deep: true },
);
```

## 3. HomeView.vue

`getPluginConfig` 関数を定義し、`useToolResults` に渡す。

```typescript
// src/views/HomeView.vue (line 446)

const getPluginConfig = <T = any,>(key: string): T | undefined => {
  return userPreferences.pluginConfigs[key] as T | undefined;
};

const { ... } = useToolResults({
  toolExecute,
  getToolPlugin,
  userPreferences: computed(() => userPreferences),
  getPluginConfig,  // ← 関数を渡す
  // ...
});
```

Sidebar と View コンポーネントにも `pluginConfigs` を props として渡す:

```vue
<Sidebar
  :plugin-configs="userPreferences.pluginConfigs"
  @update:plugin-configs="userPreferences.pluginConfigs = $event"
/>

<component
  :plugin-configs="userPreferences.pluginConfigs"
/>
```

## 4. useToolResults

`ToolContext` を作成し、プラグインの `execute()` に渡す。

```typescript
// src/composables/useToolResults.ts

const context: ToolContext = {
  currentResult: selectedResult.value ?? undefined,
  userPreferences: options.userPreferences.value,  // ← 全体を渡す
  getPluginConfig: options.getPluginConfig,        // ← 関数を渡す
  app: { ... },
};

const result = await options.toolExecute(context, msg.name, args);
```

## 5. ToolContext Interface

プラグインが受け取るコンテキストの型定義。

```typescript
// src/tools/types.ts

export interface ToolContext {
  currentResult?: ToolResult<unknown> | null;
  userPreferences?: UserPreferencesState;  // ← 全 preferences
  getPluginConfig?: <T = unknown>(key: string) => T | undefined;  // ← config取得関数
  app?: Record<string, (...args: any[]) => any>;
}
```

## 6. Backend Config Utilities

アプリ内部構造を知る config 取得ロジックは `backend/` に配置。

### 共通 Config 取得関数

```typescript
// src/tools/backend/config.ts

/**
 * Get raw plugin config from context with fallback chain:
 * 1. getPluginConfig(key) - preferred method
 * 2. userPreferences.pluginConfigs[key] - direct access
 * 3. userPreferences[key] - legacy format
 */
export function getRawPluginConfig(context?: ToolContext, key?: string) {
  if (!key) return undefined;
  return (
    context?.getPluginConfig?.(key) ||
    context?.userPreferences?.pluginConfigs?.[key] ||
    context?.userPreferences?.[key]
  );
}
```

### Image Generation Config

```typescript
// src/tools/backend/imageGeneration.ts

const IMAGE_CONFIG_KEY = "imageGenerationBackend";

export function getRawImageConfig(context?: ToolContext) {
  return getRawPluginConfig(context, IMAGE_CONFIG_KEY);
}

export function normalizeImageConfig(
  config: string | ImageGenerationConfigValue | undefined,
): NormalizedImageConfig {
  if (typeof config === "string") {
    return {
      backend: config as ImageBackend,
      styleModifier: "",
      geminiModel: "gemini-2.5-flash-image",
      openaiModel: "gpt-image-1",
    };
  }
  return {
    backend: config?.backend || "gemini",
    styleModifier: config?.styleModifier || "",
    geminiModel: config?.geminiModel || "gemini-2.5-flash-image",
    openaiModel: config?.openaiModel || "gpt-image-1",
  };
}
```

### HTML Generation Config

```typescript
// src/tools/backend/html.ts

const HTML_CONFIG_KEY = "htmlGenerationBackend";

export function getRawHtmlConfig(context?: ToolContext) {
  return getRawPluginConfig(context, HTML_CONFIG_KEY);
}

export function normalizeHtmlConfig(
  config: string | undefined,
): HtmlBackend {
  if (config === "gemini") {
    return "gemini";
  }
  return "claude"; // default
}
```

## 7. Plugin Usage (models/)

プラグインは backend から config utilities を import して使用。

```typescript
// src/tools/models/setImageStyle.ts

import {
  getRawImageConfig,
  normalizeImageConfig,
} from "../backend/imageGeneration";

const setImageStyleExecute = async (context: ToolContext, args) => {
  const config = normalizeImageConfig(getRawImageConfig(context));
  const previousStyleModifier = config.styleModifier;
  // ...
};
```

```typescript
// src/tools/models/generateHtml.ts

import { getRawHtmlConfig, normalizeHtmlConfig } from "../backend/html";

const generateHtml = async (context: ToolContext, args) => {
  const backend = normalizeHtmlConfig(getRawHtmlConfig(context));
  // ...
};
```

## Architecture: tools/ Directory Structure

```
src/tools/
├── backend/           # アプリ内部を知る層（API calls, config utilities）
│   ├── config.ts            # getRawPluginConfig (共通)
│   ├── imageGeneration.ts   # getRawImageConfig, normalizeImageConfig, generateImageWithBackend
│   ├── html.ts              # getRawHtmlConfig, normalizeHtmlConfig, generateHtml
│   └── index.ts             # re-exports
├── models/            # プラグイン本体（backend に依存）
│   ├── setImageStyle.ts     # uses backend/imageGeneration
│   ├── generateHtml.ts      # uses backend/html
│   ├── editHtml.ts          # uses backend/html
│   └── ...
├── views/             # Full view components
├── previews/          # Sidebar preview components
├── configs/           # Config UI components
├── types.ts           # ToolPlugin, ToolContext, etc.
└── index.ts           # Plugin registration
```

## Configuration UI

各プラグインは `ToolPluginConfig` で設定 UI を定義できる:

```typescript
// src/tools/types.ts

export interface ToolPluginConfig {
  key: string;        // Storage key (e.g., "imageGenerationBackend")
  defaultValue: unknown;
  component: VueComponent;  // 設定用 Vue コンポーネント
}
```

`Sidebar.vue` → `SettingsPanel.vue` で設定コンポーネントを表示。

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              localStorage                                    │
│                         "plugin_configs_v1"                                  │
│            { "imageGenerationBackend": {...}, "htmlGenerationBackend": ... }│
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↑ save
                                    ↓ load
┌─────────────────────────────────────────────────────────────────────────────┐
│                          useUserPreferences                                  │
│                                                                              │
│  state.pluginConfigs = reactive({ ... })                                    │
│  watch(() => state.pluginConfigs, ...) // auto-save                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                            HomeView.vue                                      │
│                                                                              │
│  getPluginConfig = (key) => userPreferences.pluginConfigs[key]              │
│                                                                              │
│  useToolResults({                                                            │
│    userPreferences: computed(() => userPreferences),                        │
│    getPluginConfig,                                                          │
│  })                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                           useToolResults                                     │
│                                                                              │
│  const context: ToolContext = {                                              │
│    userPreferences: options.userPreferences.value,                          │
│    getPluginConfig: options.getPluginConfig,                                │
│  };                                                                          │
│                                                                              │
│  plugin.execute(context, args)                                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                        backend/ (config utilities)                           │
│                                                                              │
│  getRawPluginConfig(context, key)  - 共通の config 取得（fallback chain）   │
│  getRawImageConfig(context)        - IMAGE_CONFIG_KEY で呼び出し             │
│  getRawHtmlConfig(context)         - HTML_CONFIG_KEY で呼び出し              │
│  normalizeImageConfig(raw)         - デフォルト値、legacy 対応               │
│  normalizeHtmlConfig(raw)                                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                         models/ (plugin execute)                             │
│                                                                              │
│  const config = normalizeImageConfig(getRawImageConfig(context));           │
│  // config.backend, config.styleModifier, etc.                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 設計方針

### 現状のアーキテクチャ

1. **backend/** - アプリ内部構造を知る層
   - `getRawXxxConfig()`: 複数の fallback で config を取得
   - `normalizeXxxConfig()`: デフォルト値を適用
   - API 呼び出し関数

2. **models/** - プラグイン本体
   - backend から config utilities を import
   - アプリ内部構造を直接参照しない

### 残る課題

1. **npm パッケージ化したプラグイン**
   - `@mulmochat-plugin/generate-image` には独自の `configUtils.ts` がある
   - これもアプリ内部構造を知っている
   - 解決策: npm パッケージは `getPluginConfig` のみを使い、app 側で config を渡す

2. **`userPreferences` 全体を渡す必要性**
   - 現状: `context.userPreferences` で全体を渡している
   - 検討: 必要な情報だけを渡す方が良いかもしれない
   - 利点: legacy fallback が可能、柔軟性がある
   - 欠点: プラグインがアプリ内部を知る可能性

3. **理想的な設計（将来）**
   ```typescript
   // プラグイン側（シンプル）
   const config = context.getPluginConfig<ImageConfig>("imageGenerationBackend");

   // アプリ側（HomeView.vue）が legacy migration, fallbacks の責任を持つ
   const getPluginConfig = <T>(key: string): T | undefined => {
     // migration logic here
     return userPreferences.pluginConfigs[key];
   };
   ```
