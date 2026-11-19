// What `POST /api/start/live/session` sends OpenAI to start a gpt-live-1
// session: the voice model with its own short instructions, and the Responses
// backend that has MulmoChat's instructions and tools.

import type { LiveCreateParams } from "openai/resources/live/live";
import { resolveLiveModels } from "./liveModels.js";
import { resolveVoice } from "./voices.js";

interface FunctionTool {
  type: "function";
  name: string;
  description?: string;
  parameters: Record<string, unknown>;
  strict: false;
}

// What the browser's data channel may send. Without a list it may send
// anything, and a `session.update` can replace the backend's tools: a hosted
// tool or an MCP server, run on the server's key, which is what
// `functionTools` below keeps out of the session. These are the events
// useOpenAILiveSession sends.
export const LIVE_CLIENT_EVENTS = [
  "response.item.create",
  "response.create",
  "session.thinking.append",
  "session.close",
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// Only function tools, rebuilt field by field: the browser's list is sent
// with the server's API key, so nothing else in it (a hosted tool, an MCP
// server with its URL) reaches OpenAI.
const functionTools = (tools: unknown): FunctionTool[] =>
  (Array.isArray(tools) ? tools : []).flatMap((tool) =>
    isRecord(tool) && tool.type === "function" && typeof tool.name === "string"
      ? [
          {
            type: "function" as const,
            name: tool.name,
            ...(typeof tool.description === "string"
              ? { description: tool.description }
              : {}),
            parameters: isRecord(tool.parameters)
              ? tool.parameters
              : { type: "object", properties: {} },
            // As in server/llm/providers/openai.ts: Responses makes a tool
            // strict unless told otherwise, which makes every optional
            // argument required and closes open objects.
            strict: false as const,
          },
        ]
      : [],
  );

/** The session to create, or the reason the request can't start one. */
export function liveSessionParams(
  body: unknown,
): { params: LiveCreateParams } | { error: string } {
  if (!isRecord(body)) return { error: "A JSON object is required" };
  const { sdp, model, voice, instructions, backendInstructions, tools } = body;
  if (typeof sdp !== "string" || !sdp.trim()) {
    return { error: "An SDP offer is required" };
  }
  if (typeof instructions !== "string" || !instructions.trim()) {
    return { error: "instructions are required" };
  }
  if (typeof backendInstructions !== "string" || !backendInstructions.trim()) {
    return { error: "backendInstructions are required" };
  }
  const { live, backend } = resolveLiveModels(model);
  const backendTools = functionTools(tools);
  return {
    params: {
      session: {
        model: live,
        instructions,
        audio: { output: { voice: resolveVoice("openai-live", voice) } },
        client: {
          data_channel: { allowed_client_events: [...LIVE_CLIENT_EVENTS] },
        },
        delegation: {
          type: "responses",
          responses: {
            model: backend,
            instructions: backendInstructions,
            ...(backendTools.length > 0
              ? {
                  tools: backendTools,
                  tool_choice: "auto" as const,
                  parallel_tool_calls: true,
                }
              : {}),
          },
        },
      },
      transport: { type: "webrtc", sdp },
    },
  };
}
