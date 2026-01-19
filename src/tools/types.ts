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
} from "gui-chat-protocol/vue";

/**
 * MulmoChat ToolPlugin with StartApiResponse as the server response type
 */
export type ToolPlugin<
  T = unknown,
  J = unknown,
  A extends object = object,
> = BaseToolPlugin<T, J, A, InputHandler, StartApiResponse>;
