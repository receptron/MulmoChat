# LLM Native OS ビジョン

MulmoChat を「OS」、プラグインを「LLM Native Application」として捉えた設計ビジョンと開発ロードマップ。

## 目次

1. [コンセプト](#コンセプト)
2. [アーキテクチャ層](#アーキテクチャ層)
3. [現状の機能](#現状の機能)
4. [不足している機能](#不足している機能)
5. [開発ロードマップ](#開発ロードマップ)
6. [設計原則](#設計原則)
7. [ポータビリティ](#ポータビリティ)

---

## コンセプト

### LLM Native OS とは

従来の OS がハードウェアを抽象化しアプリケーションに API を提供するように、LLM Native OS は LLM を抽象化し、アプリケーション（プラグイン）に統一的なインターフェースを提供する。

```
従来の OS                          LLM Native OS
─────────────────────────────────────────────────────
アプリケーション                    プラグイン（LLM Native App）
    ↓                                  ↓
システムコール                      context.app API
    ↓                                  ↓
カーネル                           LLM Native OS Core
    ↓                                  ↓
ハードウェア                        LLM / バックエンドサービス
```

### なぜこの視点が重要か

1. **不足機能の発見**: 従来 OS の機能と比較することで、必要な機能が明確になる
2. **設計の指針**: 各レイヤーの責務が明確になり、モジュール設計が改善される
3. **エコシステム形成**: プラグイン開発者が増え、アプリケーションが充実する
4. **ポータビリティ**: OS 層を抽象化すれば、異なるホストアプリでプラグインを共有できる

---

## アーキテクチャ層

### 4層アーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│                    アプリケーション層                         │
│              （プラグイン / LLM Native Apps）                 │
│                                                             │
│   ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐      │
│   │ Weather │  │ Othello │  │  Map    │  │  HTML   │      │
│   └─────────┘  └─────────┘  └─────────┘  └─────────┘      │
├─────────────────────────────────────────────────────────────┤
│                      OS 層（Core）                           │
│                   gui-chat-protocol                         │
│                                                             │
│  ・型定義（ToolPlugin, ToolResult, ToolContext）             │
│  ・プロトコル（プラグイン ↔ OS 間の契約）                      │
│  ・リソース管理（将来）                                       │
│  ・パーミッション（将来）                                     │
├─────────────────────────────────────────────────────────────┤
│                    ホストアプリ層                            │
│              （MulmoChat, 将来の他アプリ）                    │
│                                                             │
│  ・UI フレームワーク実装（Vue/React）                         │
│  ・セッション管理                                            │
│  ・ユーザー設定                                              │
│  ・context.app の実装                                       │
├─────────────────────────────────────────────────────────────┤
│                   バックエンド層                             │
│                                                             │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐      │
│  │ textLLM │  │imageGen │  │ search  │  │   map   │      │
│  │(Claude) │  │(Gemini) │  │  (Exa)  │  │(Google) │      │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### 各層の責務

| 層 | 責務 | 実装場所 |
|----|------|----------|
| **アプリケーション層** | ユーザー向け機能の提供 | 各プラグインパッケージ |
| **OS 層** | 標準プロトコル定義、層間の契約 | gui-chat-protocol |
| **ホストアプリ層** | UI 実装、セッション管理、API 提供 | MulmoChat |
| **バックエンド層** | 外部サービスとの通信 | サーバー / API |

---

## 現状の機能

### 実装済み ✅

| 機能 | 説明 | 実装 |
|------|------|------|
| **ツール実行** | LLM がプラグインを呼び出し | execute() |
| **UI 表示** | 結果の表示（View/Preview） | Vue コンポーネント |
| **バックエンド抽象化** | プロバイダ非依存 | backends 宣言 |
| **外部入力** | ファイル/クリップボード | inputHandlers |
| **設定管理** | プラグイン設定の保存 | getConfig/setConfig |
| **LLM への指示** | ツール実行後の指示 | instructions |
| **状態更新** | 既存結果の更新 | updating フラグ |

---

## 不足している機能

### 優先度: 高 🔴

#### 1. エージェント自律実行システム（Agentic Execution）

**現状の問題:**
- ユーザーの問いかけ → 返答の単純な繰り返しのみ
- 複数ステップのタスクを自動で完了できない
- エラー時に自動で修正・リトライできない
- 複数の依頼を並行管理できない

**必要な機能:**

##### 1.1 自動ループ実行（attempt_completion パターン）

```typescript
interface TaskExecution {
  // タスク完了判定
  attemptCompletion: () => CompletionResult;

  // 継続実行
  continueExecution: () => Promise<void>;

  // ユーザー確認が必要な場合
  requestUserConfirmation: (question: string) => Promise<boolean>;
}

type CompletionResult =
  | { status: "completed"; summary: string }
  | { status: "needs_more_work"; nextAction: string }
  | { status: "needs_user_input"; question: string }
  | { status: "error"; error: string; canRetry: boolean };
```

##### 1.2 タスク・コンテキスト管理

```typescript
interface TaskContext {
  id: string;

  // タスクの目的・意図
  purpose: {
    original: string;        // ユーザーの元の依頼
    clarified: string;       // 明確化された目的
    confirmedByUser: boolean;
  };

  // 状態管理
  state: TaskState;

  // Todo リスト
  todos: TodoItem[];

  // 実行履歴
  history: ExecutionRecord[];

  // 関連リソース
  resources: ResourceReference[];

  // エラー履歴と学習
  errors: ErrorRecord[];
}

type TaskState =
  | "planning"      // 計画中
  | "executing"     // 実行中
  | "waiting_user"  // ユーザー入力待ち
  | "error"         // エラー発生
  | "completed";    // 完了

interface TodoItem {
  id: string;
  description: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  result?: unknown;
}

interface ExecutionRecord {
  timestamp: Date;
  action: string;
  toolUsed?: string;
  input?: unknown;
  output?: unknown;
  success: boolean;
}
```

##### 1.3 エラー自動補正

```typescript
interface ErrorHandler {
  // エラー分析
  analyzeError: (error: Error, context: TaskContext) => ErrorAnalysis;

  // 自動修正の試行
  attemptAutoFix: (analysis: ErrorAnalysis) => Promise<FixResult>;

  // リトライ戦略
  getRetryStrategy: (error: Error) => RetryStrategy;
}

interface ErrorAnalysis {
  type: "input_error" | "api_error" | "logic_error" | "resource_missing";
  cause: string;
  suggestedFix: string;
  canAutoFix: boolean;
}

interface RetryStrategy {
  shouldRetry: boolean;
  maxAttempts: number;
  backoffMs: number;
  modifyInput?: (original: unknown) => unknown;
}
```

##### 1.4 マルチタスク管理

```typescript
interface TaskManager {
  // タスク作成
  createTask: (userRequest: string) => TaskContext;

  // アクティブタスク一覧
  getActiveTasks: () => TaskContext[];

  // タスク切り替え
  switchTask: (taskId: string) => void;

  // タスク目的の修正
  updatePurpose: (taskId: string, newPurpose: string) => void;

  // ユーザーへの目的確認
  confirmPurposeWithUser: (taskId: string) => Promise<boolean>;
}
```

**ユーザー体験の具体例:**

##### 例1: 複数ステップタスクの自動実行

```
ユーザー: 「ブログ記事を書いて、画像も生成して、HTMLにまとめて」

┌─────────────────────────────────────────────────────────────────┐
│ TaskContext 作成                                                │
├─────────────────────────────────────────────────────────────────┤
│ id: "task-001"                                                  │
│ purpose:                                                        │
│   original: "ブログ記事を書いて、画像も生成して、HTMLにまとめて"   │
│   clarified: "AI技術に関するブログ記事を作成し、                 │
│              関連画像を3枚生成し、HTMLページとして出力する"        │
│   confirmedByUser: false  ← 必要に応じてユーザーに確認           │
│                                                                 │
│ state: "planning"                                               │
│                                                                 │
│ todos:                                                          │
│   [1] ブログ記事の執筆 (pending)                                 │
│   [2] 記事に合った画像を3枚生成 (pending)                        │
│   [3] 記事と画像をHTMLにまとめる (pending)                       │
└─────────────────────────────────────────────────────────────────┘

システム: 「ブログ記事のテーマを確認させてください。
          AI技術全般でよろしいですか？
          それとも特定のトピック（生成AI、機械学習など）がありますか？」

ユーザー: 「生成AIの最新トレンドで」

┌─────────────────────────────────────────────────────────────────┐
│ TaskContext 更新                                                │
├─────────────────────────────────────────────────────────────────┤
│ purpose:                                                        │
│   clarified: "生成AIの最新トレンドに関するブログ記事を作成..."    │
│   confirmedByUser: true  ✓                                      │
│                                                                 │
│ state: "executing"                                              │
└─────────────────────────────────────────────────────────────────┘

[自動実行ループ開始]

Step 1: ブログ記事の執筆
  → textLLM プラグイン呼び出し
  → 結果: 2000文字の記事生成
  → todos[1].status = "completed"
  → history に記録

Step 2: 画像生成
  → imageGen プラグイン呼び出し
  → エラー発生: "Rate limit exceeded"

[エラー自動補正]
  → ErrorAnalysis: { type: "api_error", canAutoFix: true }
  → RetryStrategy: { shouldRetry: true, backoffMs: 5000 }
  → 5秒待機後リトライ
  → 成功: 3枚の画像生成
  → todos[2].status = "completed"

Step 3: HTML作成
  → リソース参照システムで記事と画像を取得
  → generateHtml プラグイン呼び出し
  → 結果: 完全なHTMLページ生成
  → todos[3].status = "completed"

[attemptCompletion]
  → 全てのtodoが completed
  → status: "completed"
  → summary: "生成AIの最新トレンドに関するブログ記事、
             画像3枚、HTMLページを作成しました"

システム: 「完了しました！生成AIの最新トレンドに関するブログ記事、
          画像3枚、HTMLページを作成しました。
          HTMLページをプレビューで表示しています。」
```

##### 例2: エラー時の自動補正とユーザー確認

```
ユーザー: 「東京の天気を調べて、それに合った服装を提案して」

[自動実行ループ]

Step 1: 天気情報取得
  → weather プラグイン呼び出し
  → エラー: "Location ambiguous: 東京都？東京駅？"

[エラー自動補正の判断]
  → ErrorAnalysis: { type: "input_error", canAutoFix: false }
  → ユーザー確認が必要

システム: 「『東京』の場所を特定できませんでした。
          以下のどちらですか？
          1. 東京都（都心部の天気）
          2. 東京駅（ピンポイント天気）」

ユーザー: 「1」

[TaskContext 更新・実行再開]
  → 東京都の天気情報取得成功
  → 「晴れ、最高気温28度、湿度60%」

Step 2: 服装提案
  → textLLM プラグイン呼び出し
  → リソース参照で天気情報を取得
  → 服装提案生成

[attemptCompletion]
  → status: "completed"
  → summary: "東京都は晴れで28度です。
             軽めのシャツとパンツがおすすめです。"
```

##### 例3: 複数タスクの並行管理

```
ユーザー: 「プレゼン資料を作って。あ、その前に今日の予定も確認したい」

[マルチタスク管理]

┌─────────────────────────────────────────────────────────────────┐
│ TaskManager.getActiveTasks()                                    │
├─────────────────────────────────────────────────────────────────┤
│ Task 1 (task-001):                                              │
│   purpose: "プレゼン資料の作成"                                  │
│   state: "waiting_user"  ← 詳細待ち                             │
│   todos: [テーマ決定, スライド作成, ...]                         │
│                                                                 │
│ Task 2 (task-002):                                              │
│   purpose: "今日の予定確認"                                      │
│   state: "executing"  ← 現在実行中                              │
│   todos: [カレンダー確認]                                        │
└─────────────────────────────────────────────────────────────────┘

システム: 「2つのタスクを管理しています。
          まず今日の予定を確認しますね。」

[Task 2 実行]
  → calendar プラグイン呼び出し
  → 「10:00 チームMTG, 14:00 クライアント打ち合わせ」
  → Task 2 完了

システム: 「今日の予定: 10:00 チームMTG, 14:00 クライアント打ち合わせ

          では、プレゼン資料の作成に戻ります。
          どのようなテーマのプレゼンですか？」

[Task 1 に切り替え]
  → TaskManager.switchTask("task-001")
  → state: "waiting_user" → ユーザー入力待ち
```

##### 例4: 目的の修正

```
[実行中のタスク]
TaskContext:
  purpose: "商品紹介ページの作成"
  state: "executing"
  todos:
    [1] 商品説明文の作成 (completed)
    [2] 商品画像の生成 (in_progress)
    [3] HTMLページ作成 (pending)

ユーザー: 「あ、やっぱりランディングページじゃなくて、
          SNS投稿用の画像だけでいいや」

[目的の修正]
  → TaskManager.updatePurpose("task-001", "SNS投稿用の商品画像作成")

┌─────────────────────────────────────────────────────────────────┐
│ TaskContext 更新                                                │
├─────────────────────────────────────────────────────────────────┤
│ purpose:                                                        │
│   original: "商品紹介ページの作成"                               │
│   clarified: "SNS投稿用の商品画像作成"  ← 修正                   │
│   confirmedByUser: true                                         │
│                                                                 │
│ todos:                                                          │
│   [1] 商品説明文の作成 (completed) → そのまま活用                │
│   [2] SNS用商品画像の生成 (in_progress) ← 方向性修正            │
│   [3] HTMLページ作成 (pending) → 削除                           │
└─────────────────────────────────────────────────────────────────┘

システム: 「了解しました。SNS投稿用の画像作成に変更します。
          先ほど作成した商品説明を活かして、
          Instagram用の画像を生成しますね。」
```

**インパクト:**
- 複雑なタスクの自動完了
- エラー時の自動リカバリー
- 複数タスクの並行管理
- ユーザー意図の正確な理解と実行

**設計考慮:**
- TaskContext は永続化してセッション跨ぎで継続可能に
- ユーザーがいつでもタスク状態を確認・修正可能
- 自動実行の上限設定（無限ループ防止）
- 重要な判断はユーザー確認を求める

---

#### 2. リソース参照システム（Inter-App Communication）

**現状の問題:**
- プラグイン間でデータを共有できない
- 「さっき生成した画像を編集して」ができない
- LLM が過去のツール結果を参照できない

**必要な機能:**
```typescript
interface ToolContext {
  // 既存
  currentResult?: ToolResult | null;
  app?: ToolContextApp;

  // 追加
  resources?: {
    getById: (uuid: string) => Resource | null;
    getByType: (type: ResourceType) => Resource[];
    getRecent: (count: number) => Resource[];
  };
}

type ResourceType = "image" | "document" | "data" | "audio" | "video";
```

**インパクト:**
- LLM がツール結果をパイプラインで連携可能
- ワークフローの自動化
- ユーザー体験の大幅向上

**設計考慮:**
- リソースの軽量参照（ID + メタデータ）と実データの分離
- メモリ効率（大きなデータは必要時にのみロード）
- gui-chat-protocol への追加（ホストアプリ非依存）

---

#### 2. 永続化の強化（Persistent Storage）

**現状の問題:**
- セッション終了でデータが消える
- 構造化データの保存ができない
- プラグイン間でデータを共有できない

**必要な機能:**
```typescript
interface ToolContextApp {
  // 既存
  getConfig: (key: string) => unknown;
  setConfig: (key: string, value: unknown) => void;

  // 追加
  storage: {
    // Key-Value ストレージ
    get: (key: string) => Promise<unknown>;
    set: (key: string, value: unknown) => Promise<void>;
    delete: (key: string) => Promise<void>;

    // ファイルストレージ
    saveFile: (name: string, data: Blob) => Promise<string>;
    loadFile: (id: string) => Promise<Blob>;
    listFiles: (filter?: FileFilter) => Promise<FileInfo[]>;
  };
}
```

**インパクト:**
- セッション跨ぎのワークフロー
- ユーザーの作業履歴保持
- プラグイン間のデータ共有基盤

---

#### 4. MCP 統合によるプラグイン開発の効率化

**現状の問題:**
- プラグインを毎回ゼロから作成するのは大変
- ツールロジック（バックエンド）と UI（フロントエンド）が密結合
- 既存の MCP ツールエコシステムを活用できていない

**プラグインの構成要素の分解:**

```
プラグイン = Tools（機能） + View（UI）

Tools:
  - ツール定義（スキーマ）
  - 実行ロジック（バックエンド処理）
  → MCP で提供可能

View:
  - メイン表示（View.vue）
  - サムネイル（Preview.vue）
  → フロントエンド固有
```

**MCP（Model Context Protocol）とは:**

MCP は LLM アプリケーションにツールを提供するための標準プロトコル。
サーバー側でツールを実装し、クライアント（LLM アプリ）から呼び出す。

```
┌─────────────────────────────────────────────────────────────────┐
│  現状: プラグインがすべてを実装                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Plugin                                                         │
│  ├── toolDefinition (自分で定義)                                │
│  ├── execute() (自分で実装)                                     │
│  ├── View.vue (自分で実装)                                      │
│  └── Preview.vue (自分で実装)                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  提案: MCP + UI ラッパーとしてのプラグイン                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Plugin (薄いラッパー)                                          │
│  ├── mcpTool: "weather" (MCP ツールを参照)                      │
│  ├── View.vue (UI だけ実装)                                     │
│  └── Preview.vue (UI だけ実装)                                  │
│          │                                                      │
│          ▼                                                      │
│  ┌─────────────────────────────────────────┐                   │
│  │  MCP Client (ホストアプリ層)              │                   │
│  │  - MCP サーバーに接続                     │                   │
│  │  - ツール呼び出しをプロキシ               │                   │
│  └─────────────────────────────────────────┘                   │
│          │                                                      │
│          ▼                                                      │
│  ┌─────────────────────────────────────────┐                   │
│  │  MCP Server(s)                           │                   │
│  │  - Weather, Search, Database, etc.       │                   │
│  │  - 既存のエコシステムを活用               │                   │
│  └─────────────────────────────────────────┘                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**必要な機能:**

##### 4.1 MCP ツールラッパー型プラグイン

```typescript
// 従来: すべて自分で実装
export const pluginCore: ToolPluginCore = {
  toolDefinition: {
    name: "weather",
    description: "Get weather information",
    parameters: { /* スキーマ定義 */ }
  },
  execute: async (context, args) => {
    // 天気 API を自分で呼び出し
    const data = await fetchWeatherAPI(args.location);
    return { message: "Weather fetched", data };
  },
};

// 提案: MCP ツールを参照
export const pluginCore: ToolPluginCore = {
  // MCP ツールを参照（toolDefinition は MCP から取得）
  mcpTool: {
    server: "weather-server",  // MCP サーバー名
    tool: "get_weather",       // ツール名
  },

  // execute は自動生成または省略可能
  // MCP ツールの結果を UI 用に変換する場合のみ実装
  transformResult: (mcpResult) => ({
    message: mcpResult.content,
    data: { temperature: mcpResult.temperature, ... }
  }),
};
```

##### 4.2 MCP サーバー管理

```typescript
interface ToolContextApp {
  // 既存の機能...

  // MCP 関連
  mcp: {
    // 利用可能な MCP サーバー一覧
    listServers: () => MCPServerInfo[];

    // MCP ツール呼び出し
    callTool: (server: string, tool: string, args: unknown) => Promise<MCPResult>;

    // MCP ツール定義取得
    getToolDefinition: (server: string, tool: string) => ToolDefinition;
  };
}
```

##### 4.3 プラグイン種別

```typescript
// 1. フルプラグイン（従来通り）
interface FullPlugin extends ToolPluginCore {
  toolDefinition: ToolDefinition;
  execute: ExecuteFunction;
  viewComponent: Component;
  previewComponent: Component;
}

// 2. MCP ラッパープラグイン（新規）
interface MCPWrapperPlugin {
  // MCP ツール参照
  mcpTool: {
    server: string;
    tool: string;
  };

  // オプション: 結果の変換
  transformResult?: (mcpResult: unknown) => ToolResult;

  // UI コンポーネント
  viewComponent: Component;
  previewComponent?: Component;
}

// 3. UI オンリープラグイン（MCP ツールに UI を追加）
interface UIOnlyPlugin {
  // 既存の MCP ツールまたは他プラグインのツールを参照
  toolRef: string;  // "mcp:weather-server/get_weather" or "plugin:weather"

  // UI のみ提供
  viewComponent: Component;
  previewComponent?: Component;
}
```

**具体例:**

##### 例1: 既存 MCP ツールに UI を追加

```
[状況]
- MCP サーバー "exa-search" が既に存在
- search ツールを提供
- しかし UI がない（テキスト結果のみ）

[解決策: UI オンリープラグイン]

// プラグイン定義（最小限）
export const plugin: UIOnlyPlugin = {
  toolRef: "mcp:exa-search/search",

  viewComponent: SearchResultsView,  // カード形式で結果表示
  previewComponent: SearchPreview,   // サムネイル
};

// View.vue だけ実装
<template>
  <div class="search-results">
    <div v-for="result in results" class="result-card">
      <h3>{{ result.title }}</h3>
      <p>{{ result.snippet }}</p>
      <a :href="result.url">詳細</a>
    </div>
  </div>
</template>
```

##### 例2: MCP ツール + カスタム後処理

```
[状況]
- MCP サーバー "weather" が気象データを返す
- しかしユーザーには「服装提案」も表示したい

[解決策: MCP ラッパープラグイン with transformResult]

export const pluginCore: MCPWrapperPlugin = {
  mcpTool: {
    server: "weather",
    tool: "get_current_weather",
  },

  // MCP 結果を加工
  transformResult: async (mcpResult, context) => {
    const weather = mcpResult;

    // textLLM で服装提案を生成
    const suggestion = await context.app?.generateText({
      prompt: `気温${weather.temperature}度、${weather.condition}の日の服装を提案して`,
    });

    return {
      message: `${weather.location}: ${weather.temperature}度`,
      data: {
        weather,
        clothingSuggestion: suggestion,
      },
    };
  },
};
```

##### 例3: 複数 MCP ツールの組み合わせ

```
[状況]
- "search" MCP サーバー: Web 検索
- "browser" MCP サーバー: ページ取得
- これらを組み合わせて「検索して要約」したい

[解決策: フルプラグイン with MCP 呼び出し]

export const pluginCore: ToolPluginCore = {
  toolDefinition: {
    name: "search_and_summarize",
    description: "Search and summarize results",
    parameters: { query: { type: "string" } }
  },

  execute: async (context, args) => {
    // 1. MCP で検索
    const searchResults = await context.app?.mcp.callTool(
      "search", "web_search", { query: args.query }
    );

    // 2. 上位3件のページを取得
    const pages = await Promise.all(
      searchResults.slice(0, 3).map(r =>
        context.app?.mcp.callTool("browser", "fetch_page", { url: r.url })
      )
    );

    // 3. textLLM で要約
    const summary = await context.app?.generateText({
      prompt: `以下の情報を要約して:\n${pages.join('\n')}`
    });

    return {
      message: "Search and summarize completed",
      data: { searchResults, summary },
    };
  },
};
```

**開発フローの変化:**

```
従来のプラグイン開発:
1. ツール定義を書く
2. バックエンド API を調査・実装
3. エラーハンドリングを実装
4. View/Preview を実装
5. テスト
→ 1-2日かかる

MCP 統合後のプラグイン開発:
1. 既存 MCP ツールを探す（または作る）
2. View/Preview を実装
3. 必要なら transformResult を実装
→ 数時間で完了
```

**アーキテクチャへの影響:**

```
┌─────────────────────────────────────────────────────────────────┐
│                    アプリケーション層                            │
│               (プラグイン / LLM Native Apps)                     │
│                                                                 │
│   ┌───────────┐  ┌───────────┐  ┌───────────┐                 │
│   │FullPlugin │  │MCP Wrapper│  │ UI Only   │                 │
│   │(従来型)    │  │ Plugin    │  │ Plugin    │                 │
│   └───────────┘  └───────────┘  └───────────┘                 │
├─────────────────────────────────────────────────────────────────┤
│                      OS 層（Core）                               │
│                    gui-chat-protocol                            │
│                                                                 │
│  ・ToolPluginCore / MCPWrapperPlugin / UIOnlyPlugin 型定義      │
│  ・MCP Client インターフェース                                   │
├─────────────────────────────────────────────────────────────────┤
│                    ホストアプリ層                                │
│                                                                 │
│  ┌─────────────────────────────────────────┐                   │
│  │  MCP Client 実装                         │                   │
│  │  - サーバー接続管理                       │                   │
│  │  - ツール呼び出しプロキシ                 │                   │
│  └─────────────────────────────────────────┘                   │
├─────────────────────────────────────────────────────────────────┤
│                   バックエンド層                                 │
│                                                                 │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐          │
│  │  MCP    │  │  MCP    │  │  MCP    │  │ Direct  │          │
│  │ Server  │  │ Server  │  │ Server  │  │  API    │          │
│  │(Weather)│  │(Search) │  │(Browser)│  │(Legacy) │          │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

**インパクト:**
- プラグイン開発時間の大幅短縮（UI 実装だけでOK）
- MCP エコシステムの活用（既存ツールの再利用）
- バックエンド/フロントエンドの明確な分離
- ツールの共有・再利用が容易に

**設計考慮:**
- MCP サーバーの接続管理をホストアプリ層で行う
- プラグインは MCP を意識せず、context.app.mcp 経由で呼び出し
- MCP 非対応の既存プラグインとの互換性維持
- MCP サーバーのセキュリティ（信頼できるサーバーのみ接続）

##### 4.4 ツールインターフェース仕様（RFC 的アプローチ）

**課題:**
既存プラグインのバックエンドとプラグインの整合性を保証する仕組みがない。

**提案: 統一ツール識別子とインターフェース仕様**

```typescript
// ツールの一意識別子
type ToolURI = string;  // 例: "guichat://weather/get_current"
                        //     "mcp://exa-search/search"
                        //     "plugin://othello/make_move"

// ツールインターフェース仕様
interface ToolSpec {
  // 識別子
  uri: ToolURI;
  version: string;  // セマンティックバージョニング "1.0.0"

  // インターフェース定義（JSON Schema ベース）
  input: JSONSchema;
  output: JSONSchema;

  // メタデータ
  metadata: {
    name: string;
    description: string;
    category: string;
    capabilities?: ToolCapabilities;
  };
}
```

**ツール登録レジストリ:**

```typescript
interface ToolRegistry {
  // ツール登録
  register: (spec: ToolSpec, implementation: ToolImplementation) => void;

  // ツール検索
  lookup: (uri: ToolURI) => ToolSpec | null;
  search: (query: { category?: string; capability?: string }) => ToolSpec[];

  // バージョン互換性チェック
  isCompatible: (required: ToolURI, available: ToolURI) => boolean;
}
```

**既存プラグインとの整合性:**

```
┌─────────────────────────────────────────────────────────────────┐
│  既存プラグイン → ToolSpec 生成                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  // 既存の weather プラグイン                                    │
│  export const pluginCore = {                                    │
│    toolDefinition: { name: "weather", ... },                    │
│    execute: async (ctx, args) => { ... }                        │
│  };                                                             │
│                                                                 │
│  ↓ 自動変換                                                     │
│                                                                 │
│  ToolSpec {                                                     │
│    uri: "plugin://weather/get_weather",                         │
│    version: "1.0.0",                                            │
│    input: { /* toolDefinition.parameters から生成 */ },         │
│    output: { /* ToolResult スキーマ */ },                        │
│  }                                                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  MCP ツール → ToolSpec マッピング                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  MCP Server "exa-search" の "search" ツール                     │
│                                                                 │
│  ↓ 自動マッピング                                               │
│                                                                 │
│  ToolSpec {                                                     │
│    uri: "mcp://exa-search/search",                              │
│    version: "1.0.0",                                            │
│    input: { /* MCP ツールスキーマから */ },                      │
│    output: { /* MCP 結果スキーマから */ },                       │
│  }                                                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**相互運用性の実現:**

```typescript
// UI プラグインが任意のツールを参照
export const plugin: UIOnlyPlugin = {
  // ToolURI で参照（実装がプラグインか MCP かを意識しない）
  toolRef: "guichat://weather/get_current",  // or "mcp://..." or "plugin://..."

  viewComponent: WeatherView,
};

// ホストアプリが適切な実装にルーティング
const result = await toolRegistry.execute("guichat://weather/get_current", args);
// → プラグイン実装か MCP 実装か、レジストリが解決
```

**バージョン管理と互換性:**

```typescript
// ツール仕様のバージョン管理
const spec_v1: ToolSpec = {
  uri: "guichat://weather/get_current",
  version: "1.0.0",
  input: { location: "string" },
  output: { temperature: "number", condition: "string" },
};

const spec_v2: ToolSpec = {
  uri: "guichat://weather/get_current",
  version: "2.0.0",
  input: { location: "string", unit: "celsius | fahrenheit" },  // 追加
  output: { temperature: "number", condition: "string", humidity: "number" },  // 追加
};

// 互換性チェック
toolRegistry.isCompatible("guichat://weather/get_current@^1.0.0", spec_v2);
// → true（後方互換あり）
```

**メリット:**
- 既存プラグインと MCP ツールの統一的な扱い
- インターフェースの明示的な仕様化（RFC 的）
- バージョン管理による互換性保証
- ツールの発見・検索が容易に

---

### 優先度: 中 🟡

#### 5. ツール機能宣言（Capabilities）

**現状の問題:**
- LLM がツールの入出力を正確に把握できない
- 適切なツール選択が難しい

**必要な機能:**
```typescript
interface ToolCapabilities {
  inputTypes?: ResourceType[];   // 受け付ける入力
  outputType?: ResourceType;     // 出力の種類
  streaming?: boolean;           // ストリーミング対応
  undoable?: boolean;            // 取り消し可能
  sideEffects?: boolean;         // 副作用あり
}
```

**インパクト:**
- LLM のツール選択精度向上
- リソース参照システムとの連携
- ホストアプリの UI 最適化

---

#### 6. Undo/Redo / 履歴管理

**現状の問題:**
- ツール実行を取り消せない
- 状態の巻き戻しができない

**必要な機能:**
```typescript
interface ToolResult {
  // 既存フィールド...

  // 追加
  undoable?: boolean;
  undo?: () => Promise<void>;
}

interface ToolContext {
  history?: {
    canUndo: boolean;
    canRedo: boolean;
    undo: () => Promise<void>;
    redo: () => Promise<void>;
  };
}
```

**インパクト:**
- 安心して試行錯誤できる環境
- 複雑なワークフローの管理

---

#### 7. バックグラウンドタスク / 通知

**現状の問題:**
- プラグインは呼ばれた時だけ動く
- 長時間処理の進捗表示がない
- プロアクティブな通知ができない

**必要な機能:**
```typescript
interface ToolContextApp {
  // 追加
  tasks: {
    run: (task: BackgroundTask) => TaskHandle;
    cancel: (handle: TaskHandle) => void;
  };

  notifications: {
    show: (notification: Notification) => void;
    requestPermission: () => Promise<boolean>;
  };
}
```

**インパクト:**
- 長時間処理（動画生成等）の UX 向上
- プロアクティブな AI アシスタント

---

### 優先度: 低 🟢

#### 8. パーミッションシステム

**必要な機能:**
```typescript
interface ToolPluginCore {
  // 追加
  permissions?: Permission[];
}

type Permission =
  | "network"      // ネットワークアクセス
  | "storage"      // ストレージアクセス
  | "camera"       // カメラアクセス
  | "location"     // 位置情報
  | "notifications"; // 通知
```

**インパクト:**
- セキュリティ向上
- ユーザー信頼の獲得
- サードパーティプラグインの安全な導入

---

#### 9. プラグインマーケットプレイス

**必要な機能:**
- プラグインの発見・検索
- インストール/アンインストール
- バージョン管理・自動更新
- レビュー・評価

**インパクト:**
- エコシステムの形成
- 開発者コミュニティの拡大

---

## 開発ロードマップ

### Phase 1: 基盤強化（短期）

```
┌─────────────────────────────────────────┐
│  1. エージェント自律実行システム           │
│     - TaskContext 型定義                 │
│     - attempt_completion パターン        │
│     - エラー自動補正                      │
│     - マルチタスク管理                    │
├─────────────────────────────────────────┤
│  2. リソース参照システム                  │
│     - Resource 型定義                    │
│     - context.resources API             │
│     - プラグイン間連携のデモ              │
├─────────────────────────────────────────┤
│  3. MCP 統合                            │
│     - MCP Client インターフェース定義     │
│     - MCPWrapperPlugin / UIOnlyPlugin   │
│     - 既存 MCP ツールとの連携デモ         │
├─────────────────────────────────────────┤
│  4. 永続化 API                          │
│     - storage API 定義                  │
│     - MulmoChat での実装                │
└─────────────────────────────────────────┘
```

### Phase 2: 機能拡充（中期）

```
┌─────────────────────────────────────────┐
│  5. Capabilities 宣言                   │
│  6. Undo/Redo                          │
│  7. バックグラウンドタスク                │
│  8. ストリーミング実行                   │
└─────────────────────────────────────────┘
```

### Phase 3: エコシステム（長期）

```
┌─────────────────────────────────────────┐
│  9. パーミッションシステム               │
│  10. プラグインマーケットプレイス         │
│  11. 他ホストアプリへの展開              │
└─────────────────────────────────────────┘
```

---

## 設計原則

### 1. 層の独立性

各層は独立してテスト・開発できる。

```
gui-chat-protocol    → 型定義のみ、実装なし
プラグイン（core）    → OS 層にのみ依存
プラグイン（vue）     → core + Vue に依存
ホストアプリ          → 全層を統合
```

### 2. 最小 API 原則

OS 層の API は最小限に保つ。

```typescript
// Good: 汎用的で最小限
context.resources.getById(uuid)

// Bad: 特定ユースケースに特化
context.getLastGeneratedImage()
```

### 3. 宣言的インターフェース

プラグインは「何ができるか」を宣言し、「どう実現するか」はホストアプリに委ねる。

```typescript
// プラグイン側
capabilities: {
  outputType: "image",
  inputTypes: ["image", "text"],
}

// ホストアプリ側が適切な UI/ルーティングを提供
```

### 4. 後方互換性

新機能は Optional として追加し、既存プラグインを壊さない。

```typescript
interface ToolContext {
  currentResult?: ToolResult;    // 既存
  app?: ToolContextApp;          // 既存
  resources?: ResourceManager;   // 新規（Optional）
}
```

### 5. フレームワーク非依存

OS 層（gui-chat-protocol）は UI フレームワークに依存しない。

```
gui-chat-protocol/
├── index.ts    # Core（フレームワーク非依存）
├── vue.ts      # Vue バインディング
└── react.ts    # React バインディング
```

---

## ポータビリティ

### 目標

プラグインの core 部分は、MulmoChat 以外のホストアプリでも動作する。

```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   MulmoChat     │  │   Future App A  │  │   Future App B  │
│   (Vue)         │  │   (React)       │  │   (CLI)         │
├─────────────────┤  ├─────────────────┤  ├─────────────────┤
│ gui-chat-protocol (共通)                                   │
├─────────────────────────────────────────────────────────────┤
│ プラグイン Core（共通）                                      │
└─────────────────────────────────────────────────────────────┘
```

### 実現のために必要なこと

1. **gui-chat-protocol の標準化**
   - API の安定化
   - バージョニングポリシー
   - ドキュメント整備

2. **ホストアプリ実装ガイド**
   - context.app の実装要件
   - UI コンポーネントの要件
   - テストスイート

3. **プラグイン認証**
   - 互換性テスト
   - 認証バッジ

---

## 次のステップ

1. **エージェント自律実行システムの設計詳細化**
   - TaskContext / TaskManager API 設計
   - attempt_completion パターンの実装
   - エラーハンドリング戦略

2. **リソース参照システムの設計詳細化**
   - Resource 型定義
   - context.resources API
   - 既存プラグインの対応

3. **MCP 統合の設計詳細化**
   - context.app.mcp API 設計
   - MCPWrapperPlugin / UIOnlyPlugin 型定義
   - MCP サーバー接続管理

4. **プロトタイプ実装**
   - マルチステップタスクの自動実行デモ
   - 画像生成 → 画像編集の連携
   - 既存 MCP ツール + UI プラグインのデモ
   - エラー自動補正のデモ

5. **開発者フィードバック**
   - API 設計のレビュー
   - ユースケースの収集

---

## 関連ドキュメント

- [プラグインアーキテクチャ](./plugin-architecture.ja.md)
- [プラグイン開発ガイド](./plugin-development-guide.ja.md)
- [プラグイン抽出ガイド](./plugin-extraction-guide.ja.md)
