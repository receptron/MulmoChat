# MulmoClaude — Plan

## Overview

A next-generation agent app built on **Claude Code** as the LLM core and **gui-chat-protocol** as the plugin layer. It replaces MulmoChat's voice-first, OpenAI-realtime architecture with a text/task-driven agent that produces rich visual output and operates directly on a user's file system.

**Core philosophy**: The workspace is the database. Files are the source of truth. Claude is the intelligent interface.

---

## Key Differences from MulmoChat

| Aspect | MulmoChat | MulmoClaude |
|---|---|---|
| LLM core | OpenAI Realtime API (WebRTC) | Claude Code (Agent SDK) |
| Interaction mode | Voice-first | Text/task-first |
| Tool execution | Plugins only | Plugins + native file/bash/computer use |
| Memory | None (stateless) | Chat history + memory.md as files |
| Data storage | None | File system (todos, calendar, contacts) |
| Context on role switch | Persists | Resets (fresh context per role) |
| Transport | WebRTC | HTTP streaming |

---

## Architecture

### LLM Core: Claude Code Agent SDK

Claude drives the agent loop. It decides autonomously which tools to use — native file tools (read, write, bash, glob, grep) or gui-chat-protocol plugins — based on the task and the active role's constraints.

### Plugin Layer: gui-chat-protocol

All visual output follows the gui-chat-protocol standard:
- **ToolDefinition**: JSON Schema for Claude's function calling
- **ToolResult**: Standardized result with `data`, `jsonData`, `instructions`
- **ViewComponent**: Full canvas view per tool result
- **PreviewComponent**: Sidebar thumbnail per tool result

### Workspace

The app operates within a user-selected workspace directory. All data lives here as plain files.

```
workspace/
  .chat/                        ← conversation history (role-scoped)
    developer/
      2026-03-29_session.md
    office/
      2026-03-29_session.md
  todos/
    inbox.md
    projects/
      app-redesign.md
  calendar/
    2026-03.md
    2026-04.md
  contacts/
    john-doe.md
  memory.md                     ← distilled facts always loaded as context
```

---

## Roles

A role defines:
1. **Persona** — system prompt
2. **Plugin palette** — available gui-chat-protocol plugins
3. **Memory scope** — which history files are loaded as context
4. **Context reset** — switching roles always starts a fresh conversation

All roles have access to Claude Code's native file tools (read, write, bash, glob, grep). The plugin palette shapes *what visual outputs* are available, not what the agent can do to the file system.

### Built-in Roles

| Role | Persona | Key Plugins |
|---|---|---|
| **General** | Route to appropriate role | switchRole |
| **Developer** | Coding agent | code preview, diff viewer, browser |
| **Office** | Business document assistant | presentDocument, spreadsheet, presentation |
| **Brainstorm** | Creative facilitator | mindMap, generateImage, presentDocument |
| **Tutor** | Adaptive teacher | putQuestions, presentDocument, generateImage |
| **MulmoCaster** | Multimedia storyteller | showPresentation |
| **Organizer** | Personal productivity | todo, calendar, contacts |

---

## File System as Database

Core app data is stored as **Markdown + YAML frontmatter** files. This format is:
- Human-readable and editable in any text editor
- Parseable by Claude without special tools
- Version-controllable with git
- Portable and syncable (iCloud, Dropbox, etc.)

### Todo

```markdown
---
id: todo-001
status: open
due: 2026-04-01
tags: [work, urgent]
related: [contacts/john-doe.md]
---

# Refactor auth middleware

Notes and context here.
```

### Calendar Event

```markdown
---
id: cal-001
date: 2026-04-01T14:00
duration: 60m
attendees: [contacts/john-doe.md]
related: [todos/projects/app-redesign.md]
---

# Design review with John
```

### Contact

```markdown
---
id: contact-001
email: john@example.com
phone: +1-555-0100
tags: [work]
---

# John Doe

Notes about this contact.
```

Cross-referencing is done via relative file paths in frontmatter — no foreign keys, no joins, just file reads.

---

## Chat History & Memory

### Session Files

Each conversation is saved continuously (after every exchange) to prevent data loss. Files are scoped by role:

```
.chat/{role-id}/YYYY-MM-DD_HH-MM.md
```

### Context Loading Strategy

When starting a session in a role:
1. Always load `memory.md` (distilled persistent facts)
2. Load last N session files for this role
3. Claude can search deeper history via grep when needed

### memory.md

A curated file Claude updates when important facts are established — decisions, preferences, recurring context. Similar to a CLAUDE.md but user-facing.

---

## Core App Plugins (New)

These plugins render file-backed data visually and write changes back to files on user interaction:

| Plugin | Visual Output | Writes Back To |
|---|---|---|
| `todo` | Interactive checklist | `todos/*.md` |
| `calendar` | Month/week view | `calendar/*.md` |
| `contacts` | Contact card(s) | `contacts/*.md` |
| `fileTree` | Navigable directory tree | (read-only) |
| `diffViewer` | File diff display | (read-only) |
| `docReader` | Render any file (PDF, md, CSV) | (read-only) |

---

## Interaction Model

1. User selects a workspace directory on first launch
2. User selects a role (or starts with General)
3. User types a task
4. Claude agent loop runs:
   - Reads relevant context (memory.md, recent history, workspace files)
   - Decides which tools to call (native file tools and/or plugins)
   - Executes tools, streams results to canvas
5. Visual output appears in canvas via gui-chat-protocol ViewComponents
6. Session is saved to `.chat/{role}/` after each exchange
7. On role switch: canvas clears, context resets, new role's history loads

---

## Tech Stack

- **Frontend**: Vue 3 + gui-chat-protocol components
- **LLM**: Claude via Anthropic SDK (claude-sonnet-4-6 or claude-opus-4-6)
- **Agent**: Claude Code Agent SDK for multi-step tool use
- **Server**: Express.js (minimal — mostly Claude API proxy + file serving)
- **Storage**: Local file system (workspace directory)
- **Plugin protocol**: gui-chat-protocol (framework-agnostic core)

---

## Open Questions

1. **Workspace selection UX** — drag & drop, path input, or recent workspaces picker?
2. **Git integration** — should the app offer to init/commit the workspace as a git repo?
3. **Multi-workspace** — support switching between workspaces, or one at a time?
4. **File watcher** — should the app watch for external file changes and update the canvas?
5. **Security** — sandbox Claude's file access to the workspace directory only, or allow broader access?
6. **Mobile** — is this desktop-only, or should the file model work on mobile too?
