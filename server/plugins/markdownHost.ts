// The MarkdownHostApp backend for @mulmoclaude/markdown-plugin (presentDocument),
// spread into context.app by createAppContext. The plugin's View reaches these
// through useRuntime().dispatch({ kind, … }) → POST /api/plugin/presentDocument,
// and its create path calls fillImages + saveNewDoc.
//
// Adapted from MulmoTerminal's server/backends/markdown.ts and docPath.ts
// (https://github.com/receptron/mulmoterminal, MIT License, Copyright (c) 2026
// Receptron). Differences:
//   - Documents are limited to `.md` files inside the workspace. MulmoTerminal
//     also opens any `.md` on disk by absolute path; MulmoChat's tool is driven
//     by voice and text models, so it stays inside the workspace.
//   - No live refresh (MulmoChat has no pubsub) and no workspace Marp themes.
import { randomBytes } from "node:crypto";
import path from "node:path";
import { marked } from "marked";
import puppeteer from "puppeteer";
import type { ToolResult } from "gui-chat-protocol";
import {
  fillImagePlaceholders,
  renderMarpDeck,
  type ExportPdfOptions,
  type MarkdownHostApp,
} from "@mulmoclaude/markdown-plugin";
import { createFileOps } from "./fileOps";
import { workspaceRoot } from "./workspace";

const DOCS_DIR = "artifacts/documents";
const PREFIX_MAX_LENGTH = 60;
const DOC_ID_BYTES = 8;
const DOC_CREATE_ATTEMPTS = 5;

// Rooted at the workspace: paths that escape it, including through symlinks,
// are refused.
const workspaceFiles = createFileOps(() => workspaceRoot(), "workspace");

/** A workspace-relative `.md` path, or an error the model can act on. */
function documentPath(rel: string): string {
  if (typeof rel !== "string" || path.extname(rel).toLowerCase() !== ".md") {
    throw new Error(`not a .md document path: ${rel}`);
  }
  return rel;
}

// One path-safe filename segment from a model-supplied prefix.
function sanitizeDocPrefix(prefix: string): string {
  const cleaned = String(prefix || "document")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, PREFIX_MAX_LENGTH);
  return cleaned || "document";
}

// artifacts/documents/YYYY/MM/<prefix>-<16 hex>.md, the same shape MulmoClaude
// and MulmoTerminal use.
function newDocPath(prefix: string): string {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const id = randomBytes(DOC_ID_BYTES).toString("hex");
  return `${DOCS_DIR}/${yyyy}/${mm}/${sanitizeDocPrefix(prefix)}-${id}.md`;
}

const MARKDOWN_PDF_CSS = `
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; font-size: 13px; line-height: 1.6; color: #1f2937; max-width: 800px; margin: 0 auto; padding: 32px 48px; }
  h1 { font-size: 1.75rem; } h2 { font-size: 1.25rem; border-bottom: 1px solid #e5e7eb; padding-bottom: .25rem; } h3 { font-size: 1rem; }
  pre { background: #f3f4f6; padding: .75rem; border-radius: .375rem; overflow-x: auto; } code { background: #f3f4f6; padding: .1rem .3rem; border-radius: .25rem; }
  table { border-collapse: collapse; width: 100%; } th, td { border: 1px solid #e5e7eb; padding: .5rem .75rem; } a { color: #2563eb; } img { max-width: 100%; height: auto; }
`;

async function exportPdf(
  options: ExportPdfOptions,
): Promise<{ pdfBase64: string }> {
  // Images are data URLs inside the markdown, so nothing needs resolving.
  const browser = await puppeteer.launch({ headless: true });
  try {
    const page = await browser.newPage();
    // The markdown is model-written and may carry raw HTML. The PDF needs no
    // scripts, and its images are data URLs, so no scripts run and nothing is
    // fetched: an <img>, <iframe> or CSS url() can't reach this machine or the
    // local network from the server.
    await page.setJavaScriptEnabled(false);
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      const url = request.url();
      if (url.startsWith("data:") || url === "about:blank") {
        void request.continue();
      } else {
        void request.abort();
      }
    });
    let pdf: Uint8Array;
    if (options.marp) {
      const { html, css, slideWidth, slideHeight } = await renderMarpDeck(
        options.markdown,
        { themes: [], inlineSVG: true },
      );
      await page.setViewport({ width: slideWidth, height: slideHeight });
      await page.setContent(
        `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:white}${css}
div.marpit > svg > foreignObject > section img:not([data-marp-twemoji]){max-width:100%;max-height:60cqh;object-fit:contain}
</style></head><body>${html}</body></html>`,
        { waitUntil: "load" },
      );
      pdf = await page.pdf({
        width: `${slideWidth}px`,
        height: `${slideHeight}px`,
        margin: { top: "0", bottom: "0", left: "0", right: "0" },
        printBackground: true,
      });
    } else {
      const body = await marked.parse(options.markdown);
      await page.setContent(
        `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${MARKDOWN_PDF_CSS}</style></head><body>${body}</body></html>`,
        { waitUntil: "load" },
      );
      pdf = await page.pdf({
        format: options.format === "A4" ? "A4" : "Letter",
        margin: { top: "16mm", bottom: "16mm", left: "16mm", right: "16mm" },
        printBackground: true,
      });
    }
    return { pdfBase64: Buffer.from(pdf).toString("base64") };
  } finally {
    await browser.close();
  }
}

const imageDataOf = (result: ToolResult): string | null => {
  const data = result.data as { imageData?: unknown } | undefined;
  return typeof data?.imageData === "string" ? data.imageData : null;
};

/** The markdown host backends; `generateImage` fills image placeholders. */
export function createMarkdownHostApp(
  generateImage: (prompt: string) => Promise<ToolResult>,
): MarkdownHostApp {
  return {
    async loadDoc(rel) {
      return { content: await workspaceFiles.read(documentPath(rel)) };
    },

    // Overwrite only: the View saves the document it opened.
    async saveDoc(rel, markdown) {
      const target = documentPath(rel);
      if (!(await workspaceFiles.exists(target))) {
        throw new Error(`document not found: ${rel}`);
      }
      await workspaceFiles.write(target, markdown);
      return { path: target };
    },

    async saveNewDoc(prefix, markdown) {
      for (let attempt = 0; attempt < DOC_CREATE_ATTEMPTS; attempt++) {
        const rel = newDocPath(prefix);
        if (await workspaceFiles.exists(rel)) continue;
        await workspaceFiles.write(rel, markdown);
        return { path: rel };
      }
      throw new Error(`could not create a document under ${DOCS_DIR}`);
    },

    async marpThemes() {
      return { themes: [] };
    },

    // Images are inlined as data URLs; a failed image becomes a text marker.
    async fillImages(markdown) {
      const { markdown: filled } = await fillImagePlaceholders(markdown, {
        resolveImage: async (prompt) =>
          imageDataOf(await generateImage(prompt)),
      });
      return { markdown: filled };
    },

    exportPdf,
  };
}
