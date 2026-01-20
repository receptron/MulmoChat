/**
 * MulmoChat Tool Types
 *
 * MulmoChat-specific ToolPlugin type with StartApiResponse.
 * For common types, import directly from "gui-chat-protocol/vue".
 */

import type { StartApiResponse } from "../../server/types";
import type {
  ToolPlugin as BaseToolPlugin,
  InputHandler,
  ToolContext,
  ToolResultComplete,
} from "gui-chat-protocol/vue";

/**
 * MulmoChat ToolPlugin with StartApiResponse as the server response type
 */
export type ToolPlugin<
  T = unknown,
  J = unknown,
  A extends object = object,
> = BaseToolPlugin<T, J, A, InputHandler, StartApiResponse>;

/**
 * Type for toolExecute function
 */
export type ToolExecuteFn = (
  context: ToolContext,
  name: string,
  args: Record<string, unknown>,
) => Promise<ToolResultComplete>;

/**
 * Type for getToolPlugin function
 */
export type GetToolPluginFn = (
  name: string,
) => ToolPlugin<unknown, unknown, object> | null;
