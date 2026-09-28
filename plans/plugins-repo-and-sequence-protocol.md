# A plugins-only repo, starting with the sequence tools

The step after `slides-storyboards-movies.md`. The slideshow and storyboard tools now exist twice:
MulmoGlass's `src/tools/sequenceTools.ts` is a copy of MulmoChat's `server/plugins/sequenceTools.ts`,
and `presentSlide.ts`, `storyboard.ts`, `sequence.ts`, `sequences.ts` and the sequence host are kept
the same by hand in both apps. The guide fix of MulmoChat #231 / MulmoGlass #16 had to be made twice.
This plan moves them into one package, in a new repo that holds only plugins, and adds what
gui-chat-protocol needs so any host can run them.

## What stops a straight move today

1. **The host keeps a sequence going, but only knows which tools are sequences from a list in its
   own code** (`src/tools/sequences.ts`, used by `useSequence`). A package can't add itself to
   that list.
2. **`useSequence` is app code**, the same in both apps apart from the text transport's
   `continueConversation`. Every host would copy it again.
3. **Holding a step needs to know when the user last spoke.** The guide and choice holds read
   `userSpokeSince`, which each app feeds from its own voice events. A plugin has no way to ask.
4. **The work runs in different places**: on MulmoChat's server (behind `postToServer`) and in
   MulmoGlass's page. The holds run in the browser in both.
5. **`editImages(prompt, imagePaths)`** is a convention both apps and MulmoClaude share, but
   gui-chat-protocol doesn't mention it.

## gui-chat-protocol 2.1 (additive; nothing existing changes)

1. **`ToolResult.sequence?: SequenceStep`**: a result says where its sequence is (step, total, kind,
   label, what the model does with it, the call for the next step, whether the next step waits for
   the user). The shape is today's `SequenceStep` from `src/tools/sequence.ts`. A host that supports
   sequences keeps them going; one that doesn't ignores the field. This replaces the per-host list
   (problem 1), and keeps plugin names out of the shell.
2. **`createSequenceKeeper(options)`**, a framework-agnostic helper exported from the core entry,
   like `serialLock`: today's `useSequence` without Vue. Its methods are `observe(result, startedAt)`,
   `replyEnded()`, `userSpoke()`, `stop()` and `userSpokeAt()`. Its options are `isIdle`,
   `sendInstructions(text, required)` and an optional `continueConversation()`, for text chat.
   Hosts wire their transport events to it (problem 2). Times are epoch milliseconds, not
   `performance.now()`, because they cross from browser to server (item 3).
3. **`ToolContext.userSpokeAt?: number`**: when the user last spoke or sent a message (epoch ms),
   from the keeper. It is a plain value, so a host that runs `execute()` on a server forwards it
   with the request (MulmoChat's `runOnServer` config). Plugins that hold a step compare it with
   when the waiting step appeared (problem 3). Absent means "unknown": the plugin doesn't hold.
4. **`editImages(prompt, imagePaths) → ToolResult`** documented beside `generateImage` as a
   `context.app` convention, with MulmoClaude's limits (1 to 8 images under `artifacts/images/`)
   (problem 5).

Per the repo's rules: spec (`spec/GUI_CHAT_PROTOCOL.md`, `API_REFERENCE.md`), `node:test` tests of
the keeper (the cases found in testing and review: a reply ending while a tool runs, a step asked
for before the user spoke, a waiting step, the last step), type-conformance fixtures, then a release.

## The package

One package for slideshows and storyboards (`presentSlide`, `defineStoryboard`, `presentPanel`),
with the usual two entries:

- **Core (`.`)**: definitions, prompts, argument checks, instructions, and one `execute()` per tool
  that does everything the tool decides: the holds and the repeat guard, drawing with
  `context.app.generateImage` / `editImages`, and the records through `context.files.artifacts`.
  Its results carry `sequence`. It runs wherever the host runs `execute()`: on MulmoChat's server
  (`runOnServer`, the two lists CLAUDE.md describes), in MulmoGlass's page.
- **Vue (`./vue`)**: the fitted picture View, the cast View and the previews.

Consequences to handle:

- **State lives where `execute()` runs.** The hold, the repeat guard and each slideshow's shown
  steps would move from MulmoChat's browser to its server. The server is per user, so that is the
  same, but the state must be keyed by session or conversation rather than held in module globals
  if a host serves more than one user.
- **"Already on the screen"** reads `context.currentResult`. `runOnServer` sends only what its
  mapper picks, so MulmoChat forwards the current result's slideshow ID, step and picture path.
- **Clocks**: `userSpokeAt` comes from the browser, and "when the step appeared" from wherever
  `execute()` runs. That is the same machine for both apps today; skew only matters for a remote
  server.

**makeMovie stays in MulmoChat** (decided). It depends on mulmocast, ffmpeg, MulmoChat's text-model
providers and the presentMulmoScript host, none of which the protocol describes. Once the sequence
package exists, it can be a server-only package (like `@mulmoclaude/x-plugin`), reading the records
the sequence package defines.

## The repo

A yarn-workspaces monorepo with one package per plugin, each published to npm, CI (typecheck, lint,
build, tests), and the same `CLAUDE.md` rules as the apps. The first package is the one above. Later,
as the earlier plan says, MulmoClaude's `packages/plugins/*` move in one at a time (least
host-dependent first, keeping names and history), but that needs MulmoClaude's maintainers and is
not part of this plan.

## Phases (one PR each)

1. **gui-chat-protocol 2.1**: the four additions above, spec, tests, release.
2. **The repo and the sequence package**: moved from MulmoChat's files (the more complete ones: text
   chat support, the server split), changed to use `sequence`, `userSpokeAt` and `editImages`.
   Published as `@gui-chat-plugin/sequence`.
3. **MulmoChat uses it**: register it (both lists, as CLAUDE.md requires), replace `useSequence` with
   the keeper, forward `userSpokeAt` and the current result, and delete `sequenceTools.ts`,
   `sequenceHost.ts`, `src/tools/{presentSlide,storyboard,sequence,sequences}.ts`. makeMovie imports
   the record types from the package. Test on all four transports (slideshow, guide, story, an
   interactive story), as in Phase 2 of the earlier plan.
4. **MulmoGlass uses it**: the same, in the page. Test by voice on all three providers, then deploy.
5. **Docs**: the plugin guides CLAUDE.md lists (here and in the sibling repos) gain `sequence`,
   `userSpokeAt` and `editImages`; architecture docs in both apps point to the package.

## Decisions

- **The npm scope is `@gui-chat-plugin/`** (it is host-agnostic, beside weather, mindmap and
  spreadsheet). The package: `@gui-chat-plugin/sequence` unless a better name comes up.
- **makeMovie stays in MulmoChat.**

- **The repo is `receptron/gui-chat-plugins`.**
- **You publish** to npm (gui-chat-protocol and the new package). Each repo gets a script that
  checks, builds and publishes in one command, so a release is one step.
- **MulmoClaude changes are kept to a minimum**: its CI takes a long time. Nothing in this plan
  requires a MulmoClaude change; the protocol additions are optional fields it can ignore, and its
  plugins moving into the new repo stays out of scope.

## Risks

- **Moving the holds to the server in MulmoChat** is the biggest behaviour change. The browser saw
  speech directly; the server sees it only in the request, so a user who speaks while the request is
  in flight isn't counted until the next call. The instructions already tell the model to defer to a
  user who spoke, which covered the same gap for Gemini's late transcripts.
- **Two apps switching at once**: MulmoGlass keeps its copy until Phase 4, so a fix in between goes
  into the package and the copy.
- **Protocol churn**: `sequence` and the keeper are new API that only these tools use at first. The
  alternative (a generic "host hint" field) is less clear; this plan names what it is for.
