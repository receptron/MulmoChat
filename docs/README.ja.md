# GUIChat プラグインドキュメント

このディレクトリには、GUIChat/MulmoChat のプラグイン開発に関するドキュメントが含まれています。

## ドキュメント一覧

| ドキュメント | 説明 |
|------------|------|
| [プラグインアーキテクチャ](./plugin-architecture.ja.md) | プラグインシステムの設計思想、概要、アーキテクチャ |
| [プラグイン開発ガイド](./plugin-development-guide.ja.md) | 新規プラグイン開発のステップバイステップガイド |
| [プラグイン抽出ガイド](./plugin-extraction-guide.ja.md) | 内部プラグインを独立した npm パッケージに移行するガイド |

## クイックスタート

1. [プラグインアーキテクチャ](./plugin-architecture.ja.md)で設計思想を理解
2. [プラグイン開発ガイド](./plugin-development-guide.ja.md)に従ってプラグインを作成

> **Tip**: Claude Code などの AI コーディングアシスタントに[プラグイン開発ガイド](./plugin-development-guide.ja.md)を読み込ませることで、プラグインを自動作成できます。

> **Note**: [プラグイン抽出ガイド](./plugin-extraction-guide.ja.md)は、内部プラグインを npm パッケージに移行した際の手順を記録したものです。参考資料として残しています。

## 主要コンセプト

- **フレームワーク非依存**: プラグインのコアロジックは UI フレームワーク（Vue/React）から分離
- **gui-chat-protocol**: 標準の型とインターフェースを定義する共有 npm パッケージ
- **Core/Vue 分離**: プラグインは `core/`（ロジック）と `vue/`（UI）ディレクトリを持つ
- **バックエンド抽象化**: プラグインは具体的なプロバイダではなくバックエンド種別を宣言

## 既存プラグインリポジトリ（参考）

| プラグイン | 説明 |
|-----------|------|
| [GUIChatPluginBrowse](https://github.com/receptron/GUIChatPluginBrowse) | Web ブラウジング |
| [GUIChatPluginCamera](https://github.com/receptron/GUIChatPluginCamera) | カメラキャプチャ |
| [GUIChatPluginCanvas](https://github.com/receptron/GUIChatPluginCanvas) | キャンバス描画 |
| [GUIChatPluginEditHtml](https://github.com/receptron/GUIChatPluginEditHtml) | HTML 編集 |
| [GUIChatPluginEditImage](https://github.com/receptron/GUIChatPluginEditImage) | 画像編集 |
| [GUIChatPluginExa](https://github.com/receptron/GUIChatPluginExa) | Exa 検索 |
| [GUIChatPluginGenerateHtml](https://github.com/receptron/GUIChatPluginGenerateHtml) | HTML 生成 |
| [GUIChatPluginGo](https://github.com/receptron/GUIChatPluginGo) | 囲碁ゲーム |
| [GUIChatPluginHtml](https://github.com/receptron/GUIChatPluginHtml) | HTML 表示 |
| [GUIChatPluginMap](https://github.com/receptron/GUIChatPluginMap) | Google Maps |
| [GUIChatPluginMarkdown](https://github.com/receptron/GUIChatPluginMarkdown) | Markdown レンダリング |
| [GUIChatPluginMulmocast](https://github.com/receptron/GUIChatPluginMulmocast) | Mulmocast 連携 |
| [GUIChatPluginMusic](https://github.com/receptron/GUIChatPluginMusic) | 音楽再生 |
| [GUIChatPluginOthello](https://github.com/receptron/GUIChatPluginOthello) | オセロゲーム |
| [GUIChatPluginPresent3D](https://github.com/receptron/GUIChatPluginPresent3D) | 3D プレゼンテーション |
| [GUIChatPluginScrollToAnchor](https://github.com/receptron/GUIChatPluginScrollToAnchor) | スクロールナビゲーション |
| [GUIChatPluginSetImageStyle](https://github.com/receptron/GUIChatPluginSetImageStyle) | 画像スタイル設定 |
| [GUIChatPluginSpreadsheet](https://github.com/receptron/GUIChatPluginSpreadsheet) | スプレッドシート |
| [GUIChatPluginSwitchRole](https://github.com/receptron/GUIChatPluginSwitchRole) | ロール切り替え |
| [GUIChatPluginTextResponse](https://github.com/receptron/GUIChatPluginTextResponse) | テキストレスポンス表示 |
| [GUIChatPluginTicTacToe](https://github.com/receptron/GUIChatPluginTicTacToe) | 三目並べゲーム |
| [GUIChatPluginTodo](https://github.com/receptron/GUIChatPluginTodo) | Todo リスト |
| [GUIChatPluginWeather](https://github.com/receptron/GUIChatPluginWeather) | 天気表示 |

## 関連リソース

- [gui-chat-protocol npm パッケージ](https://www.npmjs.com/package/gui-chat-protocol)
- [Vue 3 ドキュメント](https://ja.vuejs.org/)
- [Vite ライブラリモード](https://ja.vitejs.dev/guide/build.html#library-mode)
