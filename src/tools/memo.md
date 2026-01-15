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

## 1. 自己完結型（サーバAPI不要、クライアントのみで動作）

| プラグイン | 備考 |
|-----------|------|
| map | 完全自己完結 |
| othello | `../logic/othelloLogic`を使用 |
| go | `../logic/goLogic`を使用 |
| spreadsheet | 完全自己完結 |
| present3D | 完全自己完結 |
| form | 完全自己完結 |
| music | 完全自己完結 |
| todo | localStorageのみ使用 |
| textResponse | 完全自己完結 |
| scrollToAnchor | viewなし、完全自己完結 |
| weather | `./weather/offices.json`を使用 |
| setImageStyle | viewなし、完全自己完結 |
| camera | ローカルカメラのみ |
| canvas | ローカル描画のみ |
| html | HTMLレンダリングのみ |

## 2. サーバAPIに依存

| プラグイン | APIエンドポイント | 用途 |
|-----------|------------------|------|
| generateImage | `/api/generate-image`, `/api/generate-image/openai`, `/api/generate-image/comfy` | 画像生成 |
| editImage | (generateImageと同じ) | 画像編集 |
| mulmocast | `/api/generate-movie`, `/api/viewer-json`, `/api/download-movie` | 動画生成・ダウンロード |
| markdown | `/api/save-images`, `/api/check-pdf`, `/api/generate-pdf`, `/api/download-pdf` | 画像保存、PDF生成 |
| browse | `/api/browse` | Webページ取得 |
| exa | `/api/exa-search` | AI検索 |
| generateHtml | `/api/generate-html` | HTML生成 |
| editHtml | `/api/generate-html` | HTML編集 |
| pdf | `/api/summarize-pdf`, `/api/save-pdf` | PDF要約・保存 |

## 3. src/tools/外のレポジトリ内コードに依存

| プラグイン | 外部依存 |
|-----------|----------|
| switchRole | `../../config/roles` |

## 依存関係図

```
src/tools/utils/
├── imageTypes.ts      ← generateImage, editImage, camera, canvas
├── imageGeneration.ts ← generateImage, editImage, mulmocast, markdown
├── htmlTypes.ts       ← html, generateHtml, editHtml
├── blankImage.ts      ← mulmocast, markdown
└── index.ts           (集約エクスポート)

レポジトリ内外部依存:
└── switchRole → ../../config/roles
```

## インポート方針

すべてのプラグインは共有コードを `../utils` から直接インポートします。
再エクスポートは行わず、シンプルな依存関係を維持しています。
