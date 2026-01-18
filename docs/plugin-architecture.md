# プラグインアーキテクチャ設計

## 目的

**プラグインを汎用的に作りたい**

プラグインを他のアプリでも再利用可能にするためのリファクタリングと設計整理。

---

## 現状の課題

### 1. 設定の責務が不明確

プラグイン固有の設定とバックエンド設定が混同している。

```typescript
// 現状: プラグインがバックエンド選択UIを持っている
// src/tools/configs/HtmlGenerationConfig.vue - Claude or Gemini を選択
config: {
  key: "htmlBackend",
  component: HtmlGenerationConfig,
}
```

**本来の責務分離:**
- **バックエンド設定** → アプリ層で管理 (どのAIプロバイダを使うか)
- **プラグイン固有設定** → プラグインで管理 (プラグイン特有の動作設定)

### 2. プラグインがバックエンドに依存している

プラグインが特定のバックエンド (AIプロバイダ) を直接意識しているため、汎用性が低い。

**あるべき姿:**
- プラグインは「どのバックエンド種別を使うか」だけを宣言
- 具体的なプロバイダ選択はアプリ層が管理

---

## 前提・制約

### 変更しないもの

- **サーバー側 (バックエンド) のエンドポイント** - 既存APIは維持
- **APIキー管理** - 環境変数で管理 (変更不要)

### 現状の設定管理

- クライアント側設定は localStorage に保存
- リクエスト時にアプリ層からPOSTで送信

### バックエンドの定義

バックエンドはAIサービスに限らない (地図、検索など外部サービス全般)。
そのため、共通型定義にはAI固有の概念 (provider等) は含めない。

---

## プラグインの位置づけ

プラグインはツール結果からUIを表示するレイヤー (アーキテクチャの最上位)。

```
Plugins (UI)        ← ツール結果からUI表示、プラグイン固有設定
    ↓
App Layer           ← バックエンド設定管理、プラグインへのサービス提供
    ↓
Backend Services    ← 既存APIを呼び出すラッパー
    ↓
Server (既存API)    ← 変更しない
```

---

## 解決方針

### バックエンド種別を定義

アプリ層でバックエンド種別を定義し、それぞれに設定画面を持つ。

```typescript
type BackendType = "textLLM" | "imageGen" | "audio" | "search" | "browse" | "map" | "mulmocast";
```

### プラグインはバックエンド種別のみを宣言

プラグインは具体的なプロバイダを知らず、種別だけを持つ。

```typescript
// Before: プラグインがプロバイダ選択UIを持つ
config: {
  component: HtmlGenerationConfig,  // Claude or Gemini 選択
}

// After: プラグインは種別だけを宣言
backends: ["textLLM"],
```

### アプリ層が設定を管理

バックエンド種別ごとの設定 (プロバイダ、モデル等) はアプリ層で管理。

```typescript
// アプリ層の設定
backends: {
  textLLM: { provider: "anthropic", model: "claude-sonnet-4-20250514" },
  imageGen: { provider: "openai", model: "gpt-image-1" },
}
```

---

## 実装状況

### 完了

- [x] バックエンド種別の型定義 (`src/tools/backendTypes.ts`)
- [x] プラグインに `backends` フィールド追加
- [x] `src/tools/configs/HtmlGenerationConfig.vue` 削除
- [x] アプリ層のバックエンド設定UI (`src/components/settings/`)
- [x] バックエンド設定を `pluginConfigs` に統合
- [x] 有効なプラグインに基づくバックエンド設定の表示制御 (`getEnabledBackends`)

---

## 変更されたファイル

### 型定義

```typescript
// src/tools/types.ts
export type BackendType =
  | "textLLM"
  | "imageGen"
  | "audio"
  | "search"
  | "browse"
  | "map"
  | "mulmocast";

export interface ToolPlugin<T, J, A extends object> {
  // ...existing fields
  backends?: BackendType[];
}
```

### 更新されたプラグイン

| プラグイン | backends | 備考 |
|-----------|----------|------|
| generateHtml | `["textLLM"]` | |
| editHtml | `["textLLM"]` | |
| browse | `["browse"]` | |
| exa | `["search"]` | |
| editImage | `["imageGen"]` | |
| setImageStyle | `["imageGen"]` | |
| mulmocast | `["imageGen", "mulmocast"]` | |
| map | `["map"]` | |
| @mulmochat-plugin/generate-image | `["imageGen"]` | 外部プラグイン |

### 削除されたファイル

- `src/tools/configs/HtmlGenerationConfig.vue` (バックエンド設定 → アプリ層へ移行)
- `src/tools/configs/MulmocastConfig.vue` (バックエンド設定 → アプリ層へ移行)
- `@mulmochat-plugin/generate-image` の `ImageGenerationConfig.vue` (バックエンド設定 → アプリ層へ移行)

### 新規追加ファイル

- `src/tools/backendTypes.ts` - バックエンド種別と設定の型定義
- `src/components/settings/` - バックエンド設定UIコンポーネント
  - `BackendSettings.vue` - メインコンポーネント (有効なバックエンドのみ表示)
  - `TextLLMSettings.vue` - テキスト生成バックエンド設定
  - `ImageGenSettings.vue` - 画像生成バックエンド設定
  - `MulmocastSettings.vue` - Mulmocast バックエンド設定
  - `index.ts` - エクスポート

### 追加された関数

- `src/tools/index.ts` - `getEnabledBackends()` 関数
  - 有効なプラグインが使用するバックエンド種別の Set を返す
  - BackendSettings.vue で表示制御に使用

---

## 新しいバックエンド設定の追加方法

新しいバックエンド種別 (例: `audio`) の設定UIを追加する手順。

### 1. 型定義を追加

`src/tools/backendTypes.ts` に設定インターフェースを追加:

```typescript
export interface AudioBackendSettings {
  provider: "openai" | "google" | "elevenlabs";
  voice?: string;
}

export interface BackendSettings {
  textLLM?: TextLLMBackendSettings;
  imageGen?: ImageGenBackendSettings;
  audio?: AudioBackendSettings;  // 追加
}
```

### 2. 設定コンポーネントを作成

`src/components/settings/AudioSettings.vue` を作成:

```vue
<template>
  <div>
    <label class="block text-sm font-medium text-gray-700 mb-2">
      Audio Backend
    </label>
    <select
      :value="modelValue.provider"
      @change="handleProviderChange"
      class="w-full px-3 py-2 border border-gray-300 rounded-md ..."
    >
      <option value="openai">OpenAI</option>
      <option value="google">Google</option>
      <option value="elevenlabs">ElevenLabs</option>
    </select>
  </div>
</template>

<script setup lang="ts">
// ... 実装
</script>
```

### 3. index.ts にエクスポートを追加

`src/components/settings/index.ts`:

```typescript
export { default as AudioSettings } from "./AudioSettings.vue";
```

### 4. BackendSettings.vue に統合

`src/components/settings/BackendSettings.vue`:

```vue
<template>
  <div class="space-y-6">
    <TextLLMSettings v-if="showTextLLM" ... />
    <ImageGenSettings v-if="showImageGen" ... />
    <AudioSettings
      v-if="showAudio"
      :model-value="audioBackend"
      @update:model-value="$emit('update:audioBackend', $event)"
    />
  </div>
</template>

<script setup lang="ts">
// enabledBackends に基づいて表示を制御
const showAudio = computed(
  () => !props.enabledBackends || props.enabledBackends.has("audio"),
);
</script>
```

### 5. Sidebar.vue で pluginConfigs を使用

`src/components/Sidebar.vue`:

```vue
<BackendSettings
  :audio-backend="pluginConfigs.audioBackend || defaultValue"
  @update:audio-backend="handlePluginConfigUpdate('audioBackend', $event)"
/>
```

バックエンド設定は全て `pluginConfigs` に保存される。

### 6. プラグインで使用

プラグインで新しいバックエンド種別を宣言:

```typescript
export const plugin: ToolPlugin<...> = {
  // ...
  backends: ["audio"],
};
```

これにより、`audio` バックエンドを使用するプラグインが有効な場合のみ、Audio 設定UIが表示される。
