// View actions (useRuntime().dispatch({ kind, … })) that a package handles in a
// function other than execute(). The plugin route sends a request carrying a
// `kind` for these tools here; everything else goes to execute().
import { dispatchHtml } from "./htmlHost";

export const pluginDispatchHandlers: Readonly<
  Record<string, (args: object) => Promise<unknown>>
> = {
  presentHtml: dispatchHtml,
};
