// A rooted gui-chat-protocol `FileOps` over one directory, with the containment
// guard in a single place. Every caller-supplied `rel` is resolved against the
// root and rejected if it escapes, so a plugin can never read or write outside
// the area it was handed.
//
// Two layers guard containment: a lexical check rejects `..` / absolute inputs,
// then a realpath check resolves symlinks in any existing path component and
// confirms the true target is still inside the root.
//
// Copied from MulmoTerminal's server/backends/fileOps.ts and
// server/infra/path-within.ts (https://github.com/receptron/mulmoterminal,
// MIT License, Copyright (c) 2026 Receptron).
import fs from "fs/promises";
import { realpathSync } from "node:fs";
import path from "path";
import type { FileOps } from "gui-chat-protocol";

const MAX_SYMLINK_DEPTH = 40;

// Windows compares paths case-insensitively, so only win32 folds case.
const normalize = (p: string): string => {
  const resolved = path.resolve(p);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
};

/** Is `target` `base` itself, or inside it? Lexical only: callers guarding a
 *  boundary must also compare realpaths (see safeAbs below). */
function isWithin(base: string, target: string): boolean {
  const root = normalize(base);
  const candidate = normalize(target);
  if (candidate === root) return true;
  return candidate.startsWith(root.endsWith(path.sep) ? root : root + path.sep);
}

async function readlinkOrNull(p: string): Promise<string | null> {
  try {
    return await fs.readlink(p);
  } catch {
    return null;
  }
}

// realpath, but tolerant of a not-yet-created leaf/dir: resolve the deepest
// existing ancestor, then re-append the missing tail. A broken symlink is
// followed explicitly, so a dangling link pointing outside the root cannot slip
// past the containment check.
async function realpathAllowingMissing(p: string, depth = 0): Promise<string> {
  if (depth > MAX_SYMLINK_DEPTH) throw new Error("too many symlink levels");
  try {
    return realpathSync.native(p);
  } catch {
    const link = await readlinkOrNull(p);
    if (link !== null) {
      return realpathAllowingMissing(
        path.resolve(path.dirname(p), link),
        depth + 1,
      );
    }
    const parent = path.dirname(p);
    if (parent === p) return p;
    return path.join(
      await realpathAllowingMissing(parent, depth),
      path.basename(p),
    );
  }
}

/** `rootFor` is called per operation, so the root can be resolved lazily. */
export function createFileOps(rootFor: () => string, label: string): FileOps {
  const lexicalAbs = (rel: string): { root: string; abs: string } => {
    const root = path.resolve(rootFor());
    const abs = path.resolve(root, rel);
    if (!isWithin(root, abs)) {
      throw new Error(`${label} path escapes its root: ${rel}`);
    }
    return { root, abs };
  };

  const safeAbs = async (rel: string): Promise<string> => {
    const { root, abs } = lexicalAbs(rel);
    const [realRoot, realAbs] = await Promise.all([
      realpathAllowingMissing(root),
      realpathAllowingMissing(abs),
    ]);
    if (!isWithin(realRoot, realAbs)) {
      throw new Error(`${label} path escapes its root via symlink: ${rel}`);
    }
    return abs;
  };

  return {
    async read(rel) {
      return fs.readFile(await safeAbs(rel), "utf8");
    },
    async readBytes(rel) {
      return new Uint8Array(await fs.readFile(await safeAbs(rel)));
    },
    async write(rel, content) {
      const abs = await safeAbs(rel);
      await fs.mkdir(path.dirname(abs), { recursive: true });
      await fs.writeFile(abs, content);
    },
    async readDir(rel) {
      return fs.readdir(await safeAbs(rel));
    },
    async stat(rel) {
      const s = await fs.stat(await safeAbs(rel));
      return { mtimeMs: s.mtimeMs, size: s.size };
    },
    async exists(rel) {
      // safeAbs runs before the try so an escaping path still throws.
      const abs = await safeAbs(rel);
      try {
        await fs.access(abs);
        return true;
      } catch {
        return false;
      }
    },
    async unlink(rel) {
      await fs.rm(await safeAbs(rel), { force: true });
    },
  };
}
