// Which workspace files a plugin request wrote. The plugin route runs each
// request inside collectFileChanges() and returns the list in the
// X-Workspace-Files-Changed header; the browser's plugin runtime then
// publishes `file:<path>` so open Views of those files reload (the channel
// @mulmoclaude/core's useFileWatch listens on). MulmoTerminal and MulmoClaude
// push the same event over their socket pubsub; MulmoChat has none, so it
// rides on the response of the request that made the change.
import { AsyncLocalStorage } from "node:async_hooks";
import path from "node:path";
import type { FileOps } from "gui-chat-protocol";

const changes = new AsyncLocalStorage<Set<string>>();

export const FILES_CHANGED_HEADER = "X-Workspace-Files-Changed";

/** Run `fn`, returning its result and the workspace paths it wrote. */
export async function collectFileChanges<T>(
  fn: () => T,
): Promise<{ result: Awaited<T>; changed: string[] }> {
  const changed = new Set<string>();
  const result = await changes.run(changed, fn);
  return { result, changed: [...changed] };
}

/** `ops` with writes and deletes recorded as `<prefix>/<rel>` (workspace-relative). */
export function trackFileChanges(ops: FileOps, prefix: string): FileOps {
  const record = (rel: string) =>
    changes.getStore()?.add(path.posix.normalize(path.posix.join(prefix, rel)));
  return {
    ...ops,
    async write(rel, content) {
      await ops.write(rel, content);
      record(rel);
    },
    async unlink(rel) {
      await ops.unlink(rel);
      record(rel);
    },
  };
}
