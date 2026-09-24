import express, { Request, Response, Router } from "express";
import { getServerPlugins } from "../plugins/registry";
import {
  createAppContext,
  parsePluginRequestConfig,
} from "../plugins/appContext";
import { artifactsFileOps } from "../plugins/workspace";
import { sendApiError } from "../utils/logger";
import { requireTrustedOrigin } from "../utils/trustedOrigin";
import { errorMessageOf } from "../utils/imageGenerationError";

const router: Router = express.Router();

// Run a server-side plugin's execute(). Body: { args, config }, where `config`
// carries the caller's per-user backend settings. Responds with the plugin's
// ToolResult envelope.
router.post(
  "/plugin/:toolName",
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
    if (!plugin) {
      sendApiError(res, req, 404, `Unknown tool: ${toolName}`);
      return;
    }

    const { args, config } = req.body ?? {};
    if (typeof args !== "object" || args === null || Array.isArray(args)) {
      sendApiError(res, req, 400, "args must be an object");
      return;
    }

    try {
      const app = createAppContext(parsePluginRequestConfig(config));
      res.json(
        await plugin.execute(
          { app, files: { artifacts: artifactsFileOps } },
          args,
        ),
      );
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
