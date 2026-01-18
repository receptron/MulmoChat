# フレームワーク非依存プラグインアーキテクチャ

## 概要

MulmoChatプラグインをVue以外のフレームワーク（React、Astro、Svelte等）でも利用可能にするための設計ドキュメント。

---

## 現状分析

### 良い点：既に分離されている部分

現在のプラグインアーキテクチャは、ロジック層とUI層がファイルレベルで分離されている。

```
src/tools/models/othello.ts    ← ロジック（フレームワーク非依存）
src/tools/views/othello.vue    ← UI（Vue依存）
src/tools/previews/othello.vue ← プレビュー（Vue依存）
```

#### フレームワーク非依存のコード

| コンポーネント | 場所 | 依存 |
|--------------|------|------|
| `toolDefinition` | `.ts` ファイル | なし（純粋なJSONスキーマ） |
| `execute()` 関数 | `.ts` ファイル | `ToolContext` のみ |
| `ToolResult` インターフェース | 型定義 | なし |
| ビジネスロジック | バックエンド関数 | HTTP API、アルゴリズム |
| `isEnabled()` チェック | `.ts` ファイル | なし |

#### Vue依存のコード

| コンポーネント | 場所 | Vue依存 |
|--------------|------|---------|
| `viewComponent` | `.vue` ファイル | `<script setup>`, `ref()`, `watch()`, `computed()` |
| `previewComponent` | `.vue` ファイル | Vueコンポーネントライフサイクル |
| UIレンダリング | テンプレート構文 | `v-if`, `v-for`, `@click` 等 |

### 問題点

#### 1. ToolPluginインターフェースにUIコンポーネントが混在

```typescript
// src/tools/types.ts - 現状
export interface ToolPlugin<T, J, A extends object> {
  // フレームワーク非依存
  toolDefinition: ToolDefinition;
  execute: (context: ToolContext, args: A) => Promise<ToolResult<T, J>>;
  generatingMessage: string;
  isEnabled: (startResponse?: StartApiResponse | null) => boolean;

  // Vue依存 - ここが問題
  viewComponent?: VueComponent;
  previewComponent?: VueComponent;

  // その他
  systemPrompt?: string;
  backends?: BackendType[];
}
```

#### 2. 外部プラグインパッケージがVueをバンドル

```typescript
// @mulmochat-plugin/quiz のエクスポート - 現状
import View from "./View.vue";
import Preview from "./Preview.vue";

export const plugin: ToolPlugin = {
  // ...
  viewComponent: View,      // Vueコンポーネントがバンドルされる
  previewComponent: Preview,
};
```

**問題:**
- Reactアプリで使用する際もVueコンポーネントがバンドルに含まれる
- Vueが peer dependency として必要

#### 3. コンポーネントのpropsインターフェースが暗黙的

Viewコンポーネントが受け取るpropsが明示的に定義されていない。

```typescript
// 現状：App.vue で動的に渡される
<component
  :is="getToolPlugin(selectedResult.toolName!).viewComponent"
  :selected-result="selectedResult"
  :send-text-message="sendTextMessage"
  :google-map-key="startResponse?.googleMapKey"
  @update-result="handleUpdateResult"
/>
```

各コンポーネントが独自にpropsを定義しており、一貫性がない。

---

## 解決方針

### 1. インターフェースの分離

```typescript
// 新しい型定義

/**
 * コアプラグイン - フレームワーク非依存
 */
export interface ToolPluginCore<
  T = unknown,
  J = unknown,
  A extends object = object,
> {
  toolDefinition: ToolDefinition;
  execute: (context: ToolContext, args: A) => Promise<ToolResult<T, J>>;
  generatingMessage: string;
  waitingMessage?: string;
  uploadMessage?: string;
  isEnabled: (startResponse?: StartApiResponse | null) => boolean;
  delayAfterExecution?: number;
  systemPrompt?: string;
  fileUpload?: FileUploadConfig;
  config?: ToolPluginConfig;
  samples?: ToolSample[];
  backends?: BackendType[];
}

/**
 * Vueプラグイン - Vue用アダプター
 */
export interface ToolPluginVue<
  T = unknown,
  J = unknown,
  A extends object = object,
> extends ToolPluginCore<T, J, A> {
  viewComponent?: VueComponent;
  previewComponent?: VueComponent;
}

/**
 * Reactプラグイン - React用アダプター
 */
export interface ToolPluginReact<
  T = unknown,
  J = unknown,
  A extends object = object,
> extends ToolPluginCore<T, J, A> {
  ViewComponent?: React.ComponentType<ViewComponentProps<T, J>>;
  PreviewComponent?: React.ComponentType<PreviewComponentProps<T, J>>;
}
```

### 2. コンポーネントpropsの標準化

フレームワーク間で共通のpropsインターフェースを定義。

```typescript
/**
 * Viewコンポーネントのprops - フレームワーク非依存の定義
 */
export interface ViewComponentProps<T = unknown, J = unknown> {
  /** 選択されたツール結果 */
  selectedResult: ToolResultComplete<T, J>;

  /** テキストメッセージを送信する関数 */
  sendTextMessage: (text?: string) => void;

  /** 結果を更新するコールバック */
  onUpdateResult?: (result: Partial<ToolResult<T, J>>) => void;

  /** プラグイン設定値 */
  pluginConfigs?: Record<string, unknown>;
}

/**
 * Previewコンポーネントのprops
 */
export interface PreviewComponentProps<T = unknown, J = unknown> {
  /** ツール結果 */
  result: ToolResultComplete<T, J>;

  /** 選択されているかどうか */
  isSelected?: boolean;

  /** 選択時のコールバック */
  onSelect?: () => void;
}
```

### 3. パッケージ構造の変更

外部プラグインを以下の構造に変更。

```
@mulmochat-plugin/quiz/
├── src/
│   ├── core/                    ← フレームワーク非依存
│   │   ├── index.ts             ← コアプラグインエクスポート
│   │   ├── types.ts             ← プラグイン固有の型
│   │   ├── execute.ts           ← execute関数
│   │   └── toolDefinition.ts    ← ツール定義
│   │
│   ├── vue/                     ← Vueアダプター
│   │   ├── index.ts             ← Vueプラグインエクスポート
│   │   ├── View.vue
│   │   └── Preview.vue
│   │
│   └── react/                   ← Reactアダプター
│       ├── index.tsx            ← Reactプラグインエクスポート
│       ├── View.tsx
│       └── Preview.tsx
│
├── package.json
└── vite.config.ts
```

#### package.json exports

```json
{
  "name": "@mulmochat-plugin/quiz",
  "exports": {
    ".": {
      "types": "./dist/core/index.d.ts",
      "import": "./dist/core/index.js",
      "require": "./dist/core/index.cjs"
    },
    "./vue": {
      "types": "./dist/vue/index.d.ts",
      "import": "./dist/vue/index.js",
      "require": "./dist/vue/index.cjs"
    },
    "./react": {
      "types": "./dist/react/index.d.ts",
      "import": "./dist/react/index.js",
      "require": "./dist/react/index.cjs"
    }
  },
  "peerDependencies": {
    "vue": "^3.5.0"
  },
  "peerDependenciesMeta": {
    "vue": {
      "optional": true
    },
    "react": {
      "optional": true
    }
  }
}
```

#### 使用例

```typescript
// Vueアプリケーション
import QuizPlugin from "@mulmochat-plugin/quiz/vue";

// Reactアプリケーション
import QuizPlugin from "@mulmochat-plugin/quiz/react";

// コアロジックのみ（UIなし）
import { plugin as quizCore } from "@mulmochat-plugin/quiz";
```

---

## 実装計画

### Phase 1: 型定義の整理

1. `ToolPluginCore` インターフェースを定義
2. `ViewComponentProps`, `PreviewComponentProps` を定義
3. 既存の `ToolPlugin` を `ToolPluginVue` のエイリアスとして維持（後方互換性）

**対象ファイル:**
- `src/tools/types.ts`
- `src/common/types.ts`（外部プラグイン用）

### Phase 2: 内蔵プラグインのリファクタリング

1. 内蔵プラグインのViewコンポーネントを標準propsに統一
2. Previewコンポーネントを標準propsに統一

**対象ファイル:**
- `src/tools/views/*.vue`
- `src/tools/previews/*.vue`
- `src/views/HomeView.vue`（props渡し部分）

### Phase 3: Quizプラグインの分離

1. core/ ディレクトリにロジックを移動
2. vue/ ディレクトリにVueコンポーネントを移動
3. ビルド設定を更新
4. package.json の exports を設定

**対象リポジトリ:**
- `MulmoChatPluginQuiz/`

### Phase 4: Reactデモの実装

1. react/ ディレクトリを作成
2. View.tsx, Preview.tsx を実装
3. Reactデモアプリを作成

**成果物:**
- `MulmoChatPluginQuiz/src/react/`
- `MulmoChatPluginQuiz/demo/react/`

### Phase 5: 他のプラグインへの展開

1. GenerateImage, Form, SummarizePdf プラグインに同様の変更を適用
2. 内蔵プラグインの外部化を検討

---

## 技術的詳細

### ビルド設定（Vite）

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import react from "@vitejs/plugin-react";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [
    vue(),
    react(),
    dts({
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: ["src/**/*.vue"]
    }),
  ],
  build: {
    lib: {
      entry: {
        "core/index": "src/core/index.ts",
        "vue/index": "src/vue/index.ts",
        "react/index": "src/react/index.tsx",
      },
      formats: ["es", "cjs"],
    },
    rollupOptions: {
      external: ["vue", "react", "react-dom"],
      output: {
        preserveModules: true,
        exports: "named",
      },
    },
  },
});
```

### CSSの扱い

#### 選択肢1: CSS-in-JS

```tsx
// React: styled-components や emotion
const Container = styled.div`
  padding: 1rem;
  background: white;
`;
```

#### 選択肢2: Tailwind CSS（推奨）

両フレームワークで同じユーティリティクラスを使用。

```tsx
// React
<div className="p-4 bg-white rounded-lg">

// Vue
<div class="p-4 bg-white rounded-lg">
```

#### 選択肢3: CSS Modules

```tsx
// React
import styles from "./View.module.css";
<div className={styles.container}>

// Vue
<style module>
.container { ... }
</style>
```

**推奨:** Tailwind CSS + 必要に応じてCSS Modules

### 状態管理

Viewコンポーネント内のローカル状態はフレームワーク固有のAPIを使用。

```typescript
// Vue
const gameState = ref<GameState>(initialState);
watch(() => props.selectedResult, (newResult) => {
  gameState.value = newResult.jsonData;
});

// React
const [gameState, setGameState] = useState<GameState>(initialState);
useEffect(() => {
  setGameState(props.selectedResult.jsonData);
}, [props.selectedResult]);
```

### ホストアプリとの連携

#### Vue ホストアプリ

```vue
<script setup lang="ts">
import { QuizPlugin } from "@mulmochat-plugin/quiz/vue";

const ViewComponent = computed(() => {
  return getToolPlugin(selectedResult.toolName)?.viewComponent;
});
</script>

<template>
  <component
    :is="ViewComponent"
    :selected-result="selectedResult"
    :send-text-message="sendTextMessage"
    @update-result="handleUpdateResult"
  />
</template>
```

#### React ホストアプリ

```tsx
import { QuizPlugin } from "@mulmochat-plugin/quiz/react";

function ToolView({ selectedResult, sendTextMessage, onUpdateResult }) {
  const plugin = getToolPlugin(selectedResult.toolName);
  const ViewComponent = plugin?.ViewComponent;

  if (!ViewComponent) return null;

  return (
    <ViewComponent
      selectedResult={selectedResult}
      sendTextMessage={sendTextMessage}
      onUpdateResult={onUpdateResult}
    />
  );
}
```

---

## 課題と検討事項

### 1. fileUpload の扱い

`FileUploadConfig.handleUpload` は同期的にUIを更新する必要がある場合がある。
フレームワーク非依存にするには、コールバックベースの設計が必要。

### 2. config.component の扱い

プラグイン固有の設定UIもフレームワーク依存。
同様にcore/vue/reactに分離するか、設定はJSONスキーマで定義してホストアプリがUIを生成する方式を検討。

### 3. 後方互換性

既存のVueアプリが壊れないよう、段階的な移行が必要。

```typescript
// 移行期間中の互換性レイヤー
export type ToolPlugin<T, J, A> = ToolPluginVue<T, J, A>;
```

### 4. テスト戦略

- コアロジック: フレームワーク非依存のユニットテスト
- Vueコンポーネント: Vue Test Utils
- Reactコンポーネント: React Testing Library

---

## マイルストーン

| Phase | 内容 | 成果物 |
|-------|------|--------|
| 1 | 型定義の整理 | `ToolPluginCore`, `ViewComponentProps` |
| 2 | 内蔵プラグイン統一 | 標準化されたprops |
| 3 | Quizプラグイン分離 | `@mulmochat-plugin/quiz` のcore/vue分離 |
| 4 | Reactデモ | `@mulmochat-plugin/quiz/react` + デモアプリ |
| 5 | 他プラグインへの展開 | 全外部プラグインの対応 |

---

## 参考

- [Vue 3 コンポーネント](https://vuejs.org/guide/components/registration.html)
- [React コンポーネント](https://react.dev/learn/your-first-component)
- [Vite ライブラリモード](https://vitejs.dev/guide/build.html#library-mode)
- [package.json exports](https://nodejs.org/api/packages.html#package-entry-points)
