import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import { loadHostToolDefinitions } from "./tools";
import "./index.css";
import "material-icons/iconfont/material-icons.css";

/* Scan plugin dist files for Tailwind classes */
import.meta.glob(
  [
    "../node_modules/@gui-chat-plugin/*/dist/style.css",
    "../node_modules/@mulmochat-plugin/*/dist/style.css",
    "../node_modules/guichat-plugin-*/dist/style.css",
    "../node_modules/@mulmoclaude/*-plugin/dist/style.css",
  ],
  { eager: true },
);

// Definitions of the tools the server provides (renderShapeScript); each stays
// disabled until its definition arrives.
void loadHostToolDefinitions();

createApp(App).use(router).mount("#app");
