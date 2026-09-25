// Events server-run plugins send to their Views outside a request, such as
// presentMulmoScript's movie generation progress. MulmoTerminal and MulmoClaude
// push these over a socket pubsub; MulmoChat streams them to the browser as
// server-sent events at GET /api/plugin-events, and the browser's plugin
// runtime (src/tools/pluginRuntime.ts) publishes each one on its in-page bus.
//
// An event is `{ toolName, event, data }`. The runtime delivers it only to the
// Views of that tool, which subscribed with `useRuntime().pubsub.subscribe(event)`.
import express, { Request, Response, Router } from "express";
import {
  requireLocalClient,
  requireLoopbackHost,
} from "../utils/trustedOrigin";

export interface PluginEvent {
  toolName: string;
  event: string;
  data: unknown;
}

const clients = new Set<Response>();

// Keeps idle connections (and proxies) from timing out.
const KEEPALIVE_MS = 25_000;

/** Send an event to every open browser tab. */
export function publishPluginEvent(
  toolName: string,
  event: string,
  data: unknown,
): void {
  const message = `data: ${JSON.stringify({ toolName, event, data } satisfies PluginEvent)}\n\n`;
  for (const res of clients) res.write(message);
}

export const pluginEventsRouter: Router = express.Router();

// The events carry workspace file paths, so only this machine may read them.
pluginEventsRouter.get(
  "/plugin-events",
  requireLocalClient,
  requireLoopbackHost,
  (req: Request, res: Response): void => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.write(": connected\n\n");
    clients.add(res);
    const keepalive = setInterval(
      () => res.write(": keepalive\n\n"),
      KEEPALIVE_MS,
    );
    req.on("close", () => {
      clearInterval(keepalive);
      clients.delete(res);
    });
  },
);
