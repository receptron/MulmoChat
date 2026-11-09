// The /output mount: generated PDFs and movie images, served without login.
// output/workspace is the plugin workspace's fallback location
// (plugins/workspace.ts) — scores, documents and artifacts the user keeps — and
// is never served from here; the plugins hand out what they mean to serve.
import path from "node:path";
import express, { Router } from "express";

export const WORKSPACE_DIR = "workspace";

/** Whether a request path names something inside output/workspace, decided
 *  the way the static server will read it: percent-decoded, with `.`/`..`
 *  and backslashes resolved, and without case (macOS and Windows file
 *  systems ignore it). A path that does not decode is refused too. */
export function isWorkspacePath(requestPath: string): boolean {
  let decoded: string;
  try {
    decoded = decodeURIComponent(requestPath);
  } catch {
    return true;
  }
  const normalized = path.posix.normalize(`/${decoded.replace(/\\/g, "/")}`);
  const first = normalized.split("/").find((segment) => segment !== "");
  return first?.toLowerCase() === WORKSPACE_DIR;
}

export function outputStatic(outputDir: string): Router {
  const router = Router();
  router.use((req, res, next) => {
    if (isWorkspacePath(req.path)) {
      res.sendStatus(404);
      return;
    }
    next();
  });
  router.use(express.static(outputDir));
  return router;
}
