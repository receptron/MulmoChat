// The workspace server-run plugins write their files into. By default this is
// the workspace MulmoClaude and MulmoTerminal share (~/mulmoclaude), so charts
// and other artifacts made in MulmoChat show up in those apps too.
//
// MulmoChat never creates or seeds that workspace (MulmoClaude does its own
// setup), and plugins only get its artifacts/ area through a rooted FileOps.
// Nothing here is served over HTTP.
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { FileOps } from "gui-chat-protocol";
import { createFileOps } from "./fileOps";
import { logger } from "../utils/logger";

const SHARED_WORKSPACE = path.join(os.homedir(), "mulmoclaude");
const LOCAL_WORKSPACE = path.join(process.cwd(), "output", "workspace");

let resolved: string | null = null;

/**
 * MULMOCHAT_WORKSPACE if set; otherwise the shared ~/mulmoclaude when it
 * exists; otherwise output/workspace in this repo (git-ignored).
 */
export function workspaceRoot(): string {
  if (resolved) return resolved;
  const fromEnv = process.env.MULMOCHAT_WORKSPACE;
  if (fromEnv) {
    resolved = path.resolve(fromEnv);
  } else if (existsSync(SHARED_WORKSPACE)) {
    resolved = SHARED_WORKSPACE;
  } else {
    resolved = LOCAL_WORKSPACE;
  }
  logger.info("Plugin workspace", { workspace: resolved });
  return resolved;
}

/** gui-chat-protocol ToolContext.files.artifacts: <workspace>/artifacts. */
export const artifactsFileOps: FileOps = createFileOps(
  () => path.join(workspaceRoot(), "artifacts"),
  "artifacts",
);
