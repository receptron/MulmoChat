import express, { Request, Response, Router } from "express";
import { getServerPlugins } from "../plugins/registry";
import {
  createAppContext,
  parsePluginRequestConfig,
} from "../plugins/appContext";
import { artifactsFileOps } from "../plugins/workspace";
import { HOST_TOOL_DEFINITIONS, pluginHostHandlers } from "../plugins/dispatch";
import {
  collectFileChanges,
  FILES_CHANGED_HEADER,
} from "../plugins/fileChanges";
import { sendApiError } from "../utils/logger";
import {
  requireLocalClient,
  requireTrustedOrigin,
} from "../utils/trustedOrigin";
import { errorMessageOf } from "../utils/imageGenerationError";

const router: Router = express.Router();

// Definitions of the tools the host provides itself (renderShapeScript), for
// the browser's tool list. See HOST_TOOL_DEFINITIONS.
router.get("/plugin-host-tools", (_req: Request, res: Response): void => {
  res.json({ tools: HOST_TOOL_DEFINITIONS });
});

// Run a server-side plugin's execute(). Body: { args, config }, where `config`
// carries the caller's per-user backend settings. Responds with the plugin's
// ToolResult envelope.
router.post(
  "/plugin/:toolName",
  requireLocalClient,
  requireTrustedOrigin,
  async (req: Request, res: Response): Promise<void> => {
    let plugins;
    try {
      plugins = await getServerPlugins();
    } catch (error: unknown) {
      sendApiError(
        res,
        req,
        500,
        "Server plugins failed to load",
        errorMessageOf(error),
      );
      return;
    }

    const toolName = String(req.params.toolName);
    const plugin = plugins.get(toolName);
    const host = Object.hasOwn(pluginHostHandlers, toolName)
      ? pluginHostHandlers[toolName]
      : undefined;
    if (!plugin && !host?.execute) {
      sendApiError(res, req, 404, `Unknown tool: ${toolName}`);
      return;
    }

    const { args, config } = req.body ?? {};
    if (typeof args !== "object" || args === null || Array.isArray(args)) {
      sendApiError(res, req, 400, "args must be an object");
      return;
    }

    try {
      const { dispatch, execute } = host ?? {};
      let run: () => unknown;
      if (dispatch && typeof args.kind === "string") {
        run = () => dispatch(args);
      } else if (execute) {
        run = () => execute(args);
      } else if (plugin) {
        run = () =>
          plugin.execute(
            {
              app: createAppContext(parsePluginRequestConfig(config)),
              files: { artifacts: artifactsFileOps },
            },
            args,
          );
      } else {
        throw new Error(`No handler for ${toolName}`);
      }
      const { result, changed } = await collectFileChanges(run);
      // Lets the browser refresh open Views of these files (see fileChanges.ts)
      if (changed.length > 0) {
        res.setHeader(
          FILES_CHANGED_HEADER,
          encodeURIComponent(JSON.stringify(changed)),
        );
      }
      res.json(result);
    } catch (error: unknown) {
      sendApiError(
        res,
        req,
        500,
        `Plugin ${toolName} failed`,
        errorMessageOf(error),
      );
    }
  },
);

export default router;
