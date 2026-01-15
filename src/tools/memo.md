# プラグイン依存関係メモ

## 共有ユーティリティ (src/tools/utils/)

プラグイン間で共有されるコードは `src/tools/utils/` に配置されています：

| ファイル | 内容 |
|---------|------|
| `imageTypes.ts` | `ImageToolData` 型定義 |
| `imageGeneration.ts` | `generateImageWithBackend`, `generateImageCommon` 関数 |
| `htmlTypes.ts` | `HtmlToolData`, `HtmlLibraryType`, `HtmlArgs` 型定義、`HTML_LIBRARIES`, `LIBRARY_DESCRIPTIONS` |
| `blankImage.ts` | `loadBlankImageBase64` 関数 |
| `index.ts` | 全エクスポートの集約 |

## 1. 自己完結型（自身のmodel/view/preview/logic/configのみ + utils）

| プラグイン | 備考 |
|-----------|------|
| browse | 完全自己完結 |
| map | 完全自己完結 |
| exa | 完全自己完結 |
| othello | `../logic/othelloLogic`を使用 |
| go | `../logic/goLogic`を使用 |
| spreadsheet | 完全自己完結 |
| present3D | 完全自己完結 |
| form | 完全自己完結 |
| music | 完全自己完結 |
| pdf | 完全自己完結 |
| todo | localStorageのみ使用 |
| textResponse | 完全自己完結 |
| scrollToAnchor | viewなし、完全自己完結 |
| weather | `./weather/offices.json`を使用 |
| setImageStyle | viewなし、完全自己完結 |
| generateImage | utils使用、後方互換のため再エクスポート |
| editImage | utils使用 |
| camera | utils使用 |
| canvas | utils使用 |
| mulmocast | utils使用、後方互換のため再エクスポート |
| markdown | utils使用 |
| html | utils使用、後方互換のため再エクスポート |
| generateHtml | utils使用 |
| editHtml | utils使用 |

## 2. src/tools/外の外部コードに依存

| プラグイン | 外部依存 |
|-----------|----------|
| mulmocast | `mulmocast`(npm), `uuid`(npm) |
| markdown | `../../utils/uuid` |
| switchRole | `../../config/roles` |
| camera | `vue` (createApp) |
| QuizPlugin | `@mulmochat-plugin/quiz` (npm外部パッケージ) |

## 依存関係図（リファクタリング後）

```
src/tools/utils/
├── imageTypes.ts      ← generateImage, editImage, camera, canvas
├── imageGeneration.ts ← generateImage, editImage, mulmocast, markdown
├── htmlTypes.ts       ← html, generateHtml, editHtml
├── blankImage.ts      ← mulmocast, markdown
└── index.ts           (集約エクスポート)

外部依存:
├── switchRole → ../../config/roles
├── markdown   → ../../utils/uuid
├── mulmocast  → npm: mulmocast, uuid
├── camera     → npm: vue
└── QuizPlugin → npm: @mulmochat-plugin/quiz
```

## インポート方針

すべてのプラグインは共有コードを `../utils` から直接インポートします。
再エクスポートは行わず、シンプルな依存関係を維持しています。
