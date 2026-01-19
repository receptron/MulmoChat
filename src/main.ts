import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import "./index.css";
import "material-icons/iconfont/material-icons.css";
import "@mulmochat-plugin/generate-image/style.css";
import "@mulmochat-plugin/quiz/style.css";
import "@mulmochat-plugin/form/style.css";
import "@mulmochat-plugin/summarize-pdf/style.css";
import "@gui-chat-plugin/spreadsheet/style.css";
import "@gui-chat-plugin/todo/style.css";
import "@gui-chat-plugin/text-response/style.css";
import "@gui-chat-plugin/othello/style.css";
import "@gui-chat-plugin/go/style.css";
import "@gui-chat-plugin/weather/style.css";
import "@gui-chat-plugin/music/style.css";

createApp(App).use(router).mount("#app");
