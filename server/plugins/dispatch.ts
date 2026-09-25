// Host steps for packages the generic registry can't run on its own. The
// plugin route checks here first:
//   - dispatch: View actions (useRuntime().dispatch({ kind, … })) that a
//     package handles in a function other than execute(). Used when the
//     request's args carry a string `kind`.
//   - execute: the tool call, when the host must do more than call the
//     package's execute() (presentMulmoScript's path guard and movie trigger),
//     or for a host tool that no registered package provides
//     (renderShapeScript; its definition is in HOST_TOOL_DEFINITIONS).
// Anything not listed here goes to the package's execute().
import {
  executeShapeScriptDispatch,
  isShapeScriptDispatchArgs,
} from "@mulmoclaude/shapescript-plugin";
import { dispatchHtml } from "./htmlHost";
import { mulmoScriptHandlers } from "./mulmoscriptHost";
import { artifactsFileOps } from "./workspace";
import { RENDER_SHAPE_SCRIPT, renderShapeScript } from "./shapeRenderHost";
import type { ToolDefinition } from "gui-chat-protocol";

type Handler = (args: Record<string, unknown>) => Promise<unknown>;

export interface PluginHostHandlers {
  dispatch?: Handler;
  execute?: Handler;
}

// presentShapeScript's View loads and saves its `.shape` source (loadShape /
// saveShape). Without `files.byPath` the package keeps both inside
// artifacts/shapes/.
async function dispatchShapeScript(
  args: Record<string, unknown>,
): Promise<unknown> {
  if (!isShapeScriptDispatchArgs(args)) {
    throw new Error("unsupported presentShapeScript action");
  }
  return executeShapeScriptDispatch(
    { files: { artifacts: artifactsFileOps } },
    args,
  );
}

export const pluginHostHandlers: Readonly<Record<string, PluginHostHandlers>> =
  {
    presentHtml: { dispatch: dispatchHtml },
    presentShapeScript: { dispatch: dispatchShapeScript },
    presentMulmoScript: mulmoScriptHandlers,
    renderShapeScript: { execute: renderShapeScript },
  };

/** Tools the host provides itself. The browser fetches these definitions
 *  (GET /api/plugin-host-tools), since their packages' definitions live in
 *  Node-only entries it can't import. */
export const HOST_TOOL_DEFINITIONS: readonly ToolDefinition[] = [
  RENDER_SHAPE_SCRIPT,
];
