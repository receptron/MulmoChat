import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import "./index.css";
import "material-icons/iconfont/material-icons.css";
import "@mulmochat-plugin/quiz/style.css";
import "@mulmochat-plugin/form/style.css";

createApp(App).use(router).mount("#app");
