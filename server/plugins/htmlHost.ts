// Host wiring for @mulmoclaude/html-plugin (presentHtml). The tool call itself
// (save new HTML under artifacts/html/, or present one already there) runs
// through the generic registry with context.files.artifacts. This module adds
// the two host pieces the package leaves to its host:
//
//   1. The View's dispatch: loadHtml / saveHtml go to executeHtmlDispatch
//      rather than execute(), and packHtml builds a zip here (see
//      pluginDispatchHandlers in dispatch.ts).
//   2. Serving the page for the View's iframe at GET /artifacts/html/<path>.
//
// Adapted from MulmoTerminal's server/backends/html.ts
// (https://github.com/receptron/mulmoterminal, MIT License, Copyright (c) 2026
// Receptron). Differences: no `files.byPath` and no /htmlfile mount, so pages
// stay inside <workspace>/artifacts/html/; and packHtml (the View's ZIP
// button), which MulmoTerminal doesn't implement.
import path from "node:path";
import express, { Request, Response, Router } from "express";
import { strToU8, zipSync } from "fflate";
import {
  executeHtmlDispatch,
  isHtmlArtifactPath,
  isHtmlDispatchArgs,
  isPackHtmlArgs,
  toArtifactsRelative,
  type PackHtmlResult,
} from "@mulmoclaude/html-plugin";
import { artifactsFileOps } from "./workspace";
import { requireLocalClient } from "../utils/trustedOrigin";

// A page can only load inline content and the CDNs below (the preview route
// serves nothing else from the workspace), so the zip holds just the page.
async function packHtml(filePath: string): Promise<PackHtmlResult> {
  if (!isHtmlArtifactPath(filePath)) {
    throw new Error("path must be an existing .html file");
  }
  const html = await artifactsFileOps.read(toArtifactsRelative(filePath));
  const name = path.posix.basename(filePath);
  const zip = zipSync({ [name]: strToU8(html) });
  return {
    filename: `${name.replace(/\.html$/i, "")}.zip`,
    zipBase64: Buffer.from(zip).toString("base64"),
  };
}

/** The View's loadHtml / saveHtml / packHtml actions. */
export async function dispatchHtml(args: object): Promise<unknown> {
  if (isPackHtmlArgs(args)) return packHtml(args.path);
  if (!isHtmlDispatchArgs(args)) {
    throw new Error("unsupported presentHtml action");
  }
  return executeHtmlDispatch({ files: { artifacts: artifactsFileOps } }, args);
}

// The page is model-written, so the response itself sandboxes it:
// `sandbox allow-scripts` without allow-same-origin gives the document an
// opaque origin even when opened directly, so its scripts can't reach the
// app's /api or storage, and `connect-src 'none'` stops fetch/XHR. Inline
// scripts, the curated CDNs below and images are allowed.
//
// The CDNs are @mulmoclaude/core's SANDBOXED_VIEW_CDN_ALLOWLIST, copied because
// that subpath export doesn't resolve under the server's moduleResolution.
// Keep in sync with it and with the CDNs named in PRESENT_HTML_PROMPT
// (src/tools/index.ts).
const ALLOWED_CDNS = [
  "https://cdn.jsdelivr.net",
  "https://unpkg.com",
  "https://cdnjs.cloudflare.com",
  "https://fonts.googleapis.com",
  "https://fonts.gstatic.com",
  "https://cdn.plot.ly",
].join(" ");
const HTML_PREVIEW_CSP = [
  "sandbox allow-scripts",
  "default-src 'none'",
  `script-src 'unsafe-inline' ${ALLOWED_CDNS}`,
  `style-src 'unsafe-inline' ${ALLOWED_CDNS}`,
  `font-src ${ALLOWED_CDNS}`,
  `img-src 'self' ${ALLOWED_CDNS} data: blob: https:`,
  `media-src 'self' https: data: blob:`,
  "connect-src 'none'",
].join("; ");

const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

// The request must name this machine. A DNS-rebinding page sends its own
// domain as Host, so it is refused. The Vite dev proxy rewrites Host to
// localhost, so the dev app works (also from other devices).
function isLoopbackHost(host: string | undefined): boolean {
  if (!host) return false;
  try {
    return LOOPBACK_HOSTNAMES.has(new URL(`http://${host}`).hostname);
  } catch {
    return false;
  }
}

export const htmlPreviewRouter: Router = express.Router();

htmlPreviewRouter.get(
  /^\/artifacts\/html\/(.+)/,
  requireLocalClient,
  async (req: Request, res: Response): Promise<void> => {
    // cors() runs on every route; a page must not be readable cross-site.
    res.removeHeader("Access-Control-Allow-Origin");
    if (!isLoopbackHost(req.get("host"))) {
      res.status(403).json({ error: "Host not allowed" });
      return;
    }
    const rest = String(req.params[0] ?? "");
    if (!/\.html$/i.test(rest)) {
      res.status(404).json({ error: "not found" });
      return;
    }
    let html: string;
    try {
      // Rooted FileOps: `..`, absolute paths and symlinks out of artifacts/
      // are refused.
      html = await artifactsFileOps.read(`html/${decodeURIComponent(rest)}`);
    } catch {
      res.status(404).json({ error: "not found" });
      return;
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", HTML_PREVIEW_CSP);
    res.send(html);
  },
);
