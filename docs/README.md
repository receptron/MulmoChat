# GUIChat Plugin Documentation

This directory contains documentation for developing plugins for GUIChat/MulmoChat.

## Documents

| Document | Description |
|----------|-------------|
| [LLM Native OS Vision](./llm-native-os-vision.md) | Vision and roadmap: MulmoChat as OS, plugins as LLM Native Apps |
| [Plugin Architecture](./plugin-architecture.md) | Design philosophy, overview, and architecture of the plugin system |
| [Plugin Development Guide](./plugin-development-guide.md) | Step-by-step guide for developing new plugins |
| [Plugin Extraction Guide](./plugin-extraction-guide.md) | Guide for extracting internal plugins to standalone npm packages |

## Quick Start

1. Read [Plugin Architecture](./plugin-architecture.md) to understand the design principles
2. Follow [Plugin Development Guide](./plugin-development-guide.md) to create your plugin

> **Tip**: You can have AI coding assistants like Claude Code read the [Plugin Development Guide](./plugin-development-guide.md) to help create plugins automatically.

> **Note**: [Plugin Extraction Guide](./plugin-extraction-guide.md) documents the process used to migrate internal plugins to npm packages. It is kept for reference purposes.

## Key Concepts

- **Framework Agnostic**: Plugin core logic is separated from UI framework (Vue/React)
- **gui-chat-protocol**: Shared npm package defining standard types and interfaces
- **Core/Vue Separation**: Plugins have `core/` (logic) and `vue/` (UI) directories
- **Backend Abstraction**: Plugins declare backend types, not specific providers

## Existing Plugin Repositories (Reference)

| Plugin | Description |
|--------|-------------|
| [GUIChatPluginBrowse](https://github.com/receptron/GUIChatPluginBrowse) | Web browsing |
| [GUIChatPluginCamera](https://github.com/receptron/GUIChatPluginCamera) | Camera capture |
| [GUIChatPluginCanvas](https://github.com/receptron/GUIChatPluginCanvas) | Canvas drawing |
| [GUIChatPluginEditHtml](https://github.com/receptron/GUIChatPluginEditHtml) | HTML editing |
| [GUIChatPluginEditImage](https://github.com/receptron/GUIChatPluginEditImage) | Image editing |
| [GUIChatPluginExa](https://github.com/receptron/GUIChatPluginExa) | Exa search |
| [GUIChatPluginGenerateHtml](https://github.com/receptron/GUIChatPluginGenerateHtml) | HTML generation |
| [GUIChatPluginGo](https://github.com/receptron/GUIChatPluginGo) | Go game |
| [GUIChatPluginHtml](https://github.com/receptron/GUIChatPluginHtml) | HTML display |
| [GUIChatPluginMap](https://github.com/receptron/GUIChatPluginMap) | Google Maps |
| [GUIChatPluginMarkdown](https://github.com/receptron/GUIChatPluginMarkdown) | Markdown rendering |
| [GUIChatPluginMulmocast](https://github.com/receptron/GUIChatPluginMulmocast) | Mulmocast integration |
| [GUIChatPluginMusic](https://github.com/receptron/GUIChatPluginMusic) | Music playback |
| [GUIChatPluginOthello](https://github.com/receptron/GUIChatPluginOthello) | Othello game |
| [GUIChatPluginPresent3D](https://github.com/receptron/GUIChatPluginPresent3D) | 3D presentations |
| [GUIChatPluginScrollToAnchor](https://github.com/receptron/GUIChatPluginScrollToAnchor) | Scroll navigation |
| [GUIChatPluginSetImageStyle](https://github.com/receptron/GUIChatPluginSetImageStyle) | Image style setting |
| [GUIChatPluginSpreadsheet](https://github.com/receptron/GUIChatPluginSpreadsheet) | Spreadsheet |
| [GUIChatPluginSwitchRole](https://github.com/receptron/GUIChatPluginSwitchRole) | Role switching |
| [GUIChatPluginTextResponse](https://github.com/receptron/GUIChatPluginTextResponse) | Text response display |
| [GUIChatPluginTicTacToe](https://github.com/receptron/GUIChatPluginTicTacToe) | Tic-tac-toe game |
| [GUIChatPluginTodo](https://github.com/receptron/GUIChatPluginTodo) | Todo list |
| [GUIChatPluginWeather](https://github.com/receptron/GUIChatPluginWeather) | Weather display |

## Related Resources

- [gui-chat-protocol npm package](https://www.npmjs.com/package/gui-chat-protocol)
- [Vue 3 Documentation](https://vuejs.org/)
- [Vite Library Mode](https://vitejs.dev/guide/build.html#library-mode)
