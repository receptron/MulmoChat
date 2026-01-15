# プラグイン依存関係メモ

## バックエンドAPI (src/tools/backend/)

サーバーAPIへのアクセスは `src/tools/backend/` に配置されています：

| ファイル | 内容 |
|---------|------|
| `imageGeneration.ts` | `generateImageWithBackend`, `generateImageCommon`, `generateImage`, `editImage` |
| `browse.ts` | `fetchBrowse`, `fetchTwitterEmbed` |
| `exa.ts` | `fetchExaSearch` |
| `html.ts` | `fetchGenerateHtml` |
| `pdf.ts` | `fetchSummarizePdf` |
| `markdown.ts` | `fetchSaveImages` |
| `index.ts` | 全エクスポートの集約 |

## 共有ユーティリティ (src/tools/utils/)

プラグイン間で共有されるユーティリティコードは `src/tools/utils/` に配置されています：

| ファイル | 内容 |
|---------|------|
| `imageTypes.ts` | `ImageToolData` 型定義 |
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
src/tools/backend/
├── imageGeneration.ts ← generateImage, editImage, mulmocast, markdown
├── browse.ts          ← browse
├── exa.ts             ← exa
├── html.ts            ← generateHtml, editHtml
├── pdf.ts             ← pdf
├── markdown.ts        ← markdown
└── index.ts           (集約エクスポート)

src/tools/utils/
├── imageTypes.ts      ← generateImage, editImage, camera, canvas
├── htmlTypes.ts       ← html, generateHtml, editHtml
├── blankImage.ts      ← mulmocast, markdown
└── index.ts           (集約エクスポート)

レポジトリ内外部依存:
└── switchRole → ../../config/roles
```

## インポート方針

- バックエンドAPIへのアクセスは `../backend` からインポート
- 型定義やユーティリティは `../utils` からインポート
- 再エクスポートは行わず、シンプルな依存関係を維持
