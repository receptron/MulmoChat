// Host wiring for @mulmoclaude/mulmoscript-plugin (presentMulmoScript). The
// package's `./server` entry does the heavy work (mulmocast image, audio, movie
// and PDF generation, path containment, generation tracking, and the router
// for the View's dispatch kinds). This module gives it MulmoChat's backend:
// stories under <workspace>/artifacts/stories, the artifacts FileOps, an
// atomic write, the ffmpeg probe, and generation / script-changed events sent
// to the browser over GET /api/plugin-events (events.ts).
//
//   - mulmoScriptHandlers.dispatch: the View's `useRuntime().dispatch({ kind })`
//   - mulmoScriptHandlers.execute: the tool call. The package's save/reopen/
//     edit-beat execute, wrapped with the ops' path guard, the script-changed
//     event for a beat edit, and the `autoGenerateMovie` background trigger.
//   - mulmoScriptMediaRouter: GET /api/mulmoscript/media, the movie / PDF bytes
//     for the View's download and clip buttons (host adapter fetchMediaBlob).
//
// Adapted from MulmoTerminal's server/backends/mulmoscript.ts
// (https://github.com/receptron/mulmoterminal, MIT License, Copyright (c) 2026
// Receptron). Differences: one stories root and no `byPath`, so scripts stay
// inside <workspace>/artifacts/stories and the media route only serves files
// there (MulmoTerminal also opens scripts by absolute path and in the other
// directories it was launched in).
//
// Generation reads its API keys from the server's environment (mulmocast uses
// OPENAI_API_KEY and GEMINI_API_KEY, the same names as MulmoChat's .env).
import path from "node:path";
import fs from "node:fs/promises";
import { execFile } from "node:child_process";
import express, { Request, Response, Router } from "express";
import { rateLimit } from "express-rate-limit";
import {
  createMulmoScriptServerOps,
  createMulmoScriptDispatchHandler,
  executeMulmoScriptSave,
  GENERATION_EVENT,
  SCRIPT_CHANGED_EVENT,
  type MulmoScriptDispatchHandler,
  type MulmoScriptServerOps,
} from "@mulmoclaude/mulmoscript-plugin/server";
import type { SaveMulmoScriptArgs } from "@mulmoclaude/mulmoscript-plugin";
import { artifactsFileOps, workspaceRoot } from "./workspace";
import { publishPluginEvent } from "./events";
import { logger } from "../utils/logger";
import {
  requireLocalClient,
  requireLoopbackHost,
} from "../utils/trustedOrigin";

const TOOL_NAME = "presentMulmoScript";

// undefined = the probe hasn't finished; the ops treat that as available, so
// the startup window never blocks a render.
let ffmpegAvailable: boolean | undefined;

function probeFfmpeg(): void {
  // ffmpeg from PATH is what mulmocast itself runs; fixed argv, no shell.
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  execFile("ffmpeg", ["-version"], (err) => {
    ffmpegAvailable = !err;
    if (err) {
      logger.warn(
        "[mulmo-script] ffmpeg not found; movie and beat rendering are unavailable",
      );
    }
  });
}

// mulmocast outputs: a temp file beside the destination, then rename. The
// suffix is per write, so concurrent generations never share one.
let writeSeq = 0;
async function writeFileAtomic(
  absolutePath: string,
  data: string | Uint8Array,
): Promise<void> {
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  const tmp = `${absolutePath}.${process.pid}.${++writeSeq}.tmp`;
  try {
    await fs.writeFile(tmp, data);
    await fs.rename(tmp, absolutePath);
  } catch (err) {
    await fs.rm(tmp, { force: true }).catch(() => {});
    throw err;
  }
}

// One instance per process: it owns the in-flight movie/PDF sets and the
// generation state. Created on first use, so the workspace is resolved then.
let instance: {
  ops: MulmoScriptServerOps;
  dispatch: MulmoScriptDispatchHandler;
} | null = null;

function mulmoScript() {
  if (instance) return instance;
  const ops = createMulmoScriptServerOps({
    storiesDir: path.join(workspaceRoot(), "artifacts", "stories"),
    artifacts: artifactsFileOps,
    writeFileAtomic,
    isFfmpegAvailable: () => ffmpegAvailable,
    // MulmoChat keeps no per-session generation state; every open View gets
    // the event and filters by its own script.
    onGenerationEvent: (_chatSessionId, event) => {
      publishPluginEvent(TOOL_NAME, GENERATION_EVENT, event);
    },
    // An agent (or another tab) wrote this script: open Views reload it. The
    // View that made the write recognizes its own `origin` and skips it.
    onScriptChanged: (event) => {
      publishPluginEvent(TOOL_NAME, SCRIPT_CHANGED_EVENT, event);
    },
    log: {
      info: (message, data) => logger.info(`[mulmo-script] ${message}`, data),
      warn: (message, data) => logger.warn(`[mulmo-script] ${message}`, data),
      error: (message, data) => logger.error(`[mulmo-script] ${message}`, data),
    },
  });
  probeFfmpeg();
  instance = { ops, dispatch: createMulmoScriptDispatchHandler(ops) };
  return instance;
}

// The tool call's arguments, built from checked fields: every field of
// SaveMulmoScriptArgs is optional, so a mistyped one is left out and the
// package rejects the call on its own terms.
function saveArgsFrom(body: Record<string, unknown>): SaveMulmoScriptArgs {
  return {
    ...(body.script !== undefined ? { script: body.script } : {}),
    ...(typeof body.filename === "string" ? { filename: body.filename } : {}),
    ...(typeof body.filePath === "string" ? { filePath: body.filePath } : {}),
    ...(typeof body.autoGenerateMovie === "boolean"
      ? { autoGenerateMovie: body.autoGenerateMovie }
      : {}),
    ...(typeof body.beatIndex === "number"
      ? { beatIndex: body.beatIndex }
      : {}),
    ...(body.beat !== undefined ? { beat: body.beat } : {}),
  };
}

// Save a new script, reopen one, or replace one beat. Failures come back as
// a message (not an HTTP error) so the model can read them and retry.
async function executeTool(body: Record<string, unknown>): Promise<unknown> {
  const { ops } = mulmoScript();
  const guard = ops.guardStoryWirePath(body.filePath);
  if (guard) return { message: guard.error };
  const args = saveArgsFrom(body);
  const outcome = await executeMulmoScriptSave(
    { files: { artifacts: ops.backend.artifacts } },
    args,
  );
  if (!outcome.ok) {
    return {
      message: outcome.error,
      instructions:
        "Acknowledge the error and retry with a valid `script` (new) or an existing `filePath`.",
    };
  }
  // A beat edit rewrote a script that may already be open; the event is how
  // that View hears about it. No origin: this is the agent's write.
  if (args.beatIndex !== undefined && args.beat !== undefined) {
    ops.publishScriptChanged(outcome.filePath);
  }
  // The package's background trigger skips the ffmpeg check, so check here
  // rather than start a job that can't encode.
  let movieNote = "";
  if (args.autoGenerateMovie === true) {
    const ffmpeg = ops.ffmpegGuard();
    if (ffmpeg) {
      movieNote = ` (movie generation was NOT started: ${ffmpeg.error})`;
    } else {
      const resolved = ops.resolveStory(outcome.filePath);
      if (resolved.ok) {
        ops.triggerAutoBackgroundMovie(
          resolved.absolutePath,
          outcome.filePath,
          undefined,
        );
        movieNote = " (movie generation started in the background)";
      }
    }
  }
  return {
    data: { script: outcome.script, filePath: outcome.filePath },
    message: `${outcome.message}${movieNote}`,
    instructions: "Display the storyboard to the user.",
  };
}

export const mulmoScriptHandlers = {
  dispatch: (args: Record<string, unknown>) => mulmoScript().dispatch(args),
  execute: executeTool,
};

function failureStatus(code: string): number {
  if (code === "not_found") return 404;
  if (code === "bad_request") return 400;
  if (code === "unavailable") return 503;
  return 500;
}

const stringQuery = (req: Request, name: string): string | null => {
  const value = req.query[name];
  return typeof value === "string" && value !== "" ? value : null;
};

// What the View downloads: movies, beat clips and PDFs, not the scripts.
const MEDIA_EXTENSIONS = new Set([".mp4", ".mov", ".webm", ".pdf"]);

// Each download reads a whole movie or PDF from disk. The View fetches one per
// click, so this only stops a runaway client.
const mediaRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

export const mulmoScriptMediaRouter: Router = express.Router();

// GET /api/mulmoscript/media?moviePath=…|pdfPath=… — the `stories/…` paths the
// View's status dispatches return. resolveStory keeps them inside the stories
// directory (`..` and symlinks out of it are refused).
mulmoScriptMediaRouter.get(
  "/mulmoscript/media",
  mediaRateLimit,
  requireLocalClient,
  requireLoopbackHost,
  (req: Request, res: Response): void => {
    const wirePath =
      stringQuery(req, "pdfPath") ?? stringQuery(req, "moviePath");
    if (
      !wirePath ||
      path.isAbsolute(wirePath) ||
      !MEDIA_EXTENSIONS.has(path.extname(wirePath).toLowerCase())
    ) {
      res
        .status(400)
        .json({ error: "a stories/ movie or PDF path is required" });
      return;
    }
    const resolved = mulmoScript().ops.resolveStory(wirePath);
    if (!resolved.ok) {
      res.status(failureStatus(resolved.code)).json({ error: resolved.error });
      return;
    }
    res.download(resolved.absolutePath);
  },
);
