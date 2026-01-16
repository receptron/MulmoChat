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
Plugin execute()
```

## 1. Storage Layer (localStorage)

プラグイン設定は `localStorage` の `plugin_configs_v1` キーに JSON として保存される。

```typescript
// Key: "plugin_configs_v1"
// Value: { "imageGenerationBackend": {...}, "otherConfig": {...} }
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

## 6. Plugin Usage (現状の問題)

現在、プラグイン内では複数の方法で config を取得しようとしている:

```typescript
// src/tools/backend/imageGeneration.ts

export function getRawImageConfig(context?: ToolContext) {
  return (
    context?.getPluginConfig?.("imageGenerationBackend") ||  // 方法1: 関数経由
    context?.userPreferences?.pluginConfigs?.["imageGenerationBackend"] ||  // 方法2: pluginConfigs
    context?.userPreferences?.imageGenerationBackend  // 方法3: legacy (直接プロパティ)
  );
}
```

### 問題点

1. **プラグインがアプリ内部構造を知っている**
   - `userPreferences.pluginConfigs` という構造を知っている
   - `userPreferences.imageGenerationBackend` という legacy プロパティを知っている
   - これは npm パッケージ化したプラグインには不適切

2. **責務の混在**
   - config の取得はアプリ側の責務
   - プラグインは `getPluginConfig(key)` のみを使うべき

3. **Fallback の複雑さ**
   - 3つのフォールバックがあり、理解しにくい

### 理想的な設計

```typescript
// プラグイン側（シンプル）
export function getConfig(context?: ToolContext) {
  return context?.getPluginConfig?.("imageGenerationBackend");
}

// アプリ側（HomeView.vue）が責任を持つ
const getPluginConfig = <T = any,>(key: string): T | undefined => {
  // legacy migration, fallbacks などはここで行う
  return userPreferences.pluginConfigs[key] as T | undefined;
};
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
│                    { "imageGenerationBackend": {...} }                       │
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
│                              Plugin                                          │
│                                                                              │
│  execute(context: ToolContext, args) {                                       │
│    const config = context.getPluginConfig("myConfig");  // ← 理想                                                     │
│    // or                                                                     │
│    const config = context.userPreferences?.pluginConfigs?.myConfig;  // ← 現状                                         │
│  }                                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

## TODO: Design Decisions

1. **プラグインは `getPluginConfig` のみを使うべきか？**
   - Yes: プラグインがアプリ内部を知らなくて良い
   - migration や fallback はアプリ側の責務

2. **`userPreferences` 全体を渡す必要があるか？**
   - 現状: 渡している（`context.userPreferences`）
   - 検討: 必要な情報だけを渡す方が良いかもしれない

3. **npm パッケージ化したプラグインの config 責務**
   - `@mulmochat-plugin/generate-image` の `configUtils.ts` が `getRawImageConfig` を持つ
   - これはアプリ内部構造を知ってしまっている
   - 解決策: config 取得は app 側 (`src/tools/backend/`) に残す
