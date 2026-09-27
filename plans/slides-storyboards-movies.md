# Plan: Slides, Storyboards and Movies in MulmoChat

## Overview

MulmoGlass (receptron/mulmoglass) has four sequence features that people understand at once:

| Feature | Tool | MulmoGlass PR |
|---|---|---|
| Slideshows: one generated picture per slide, explained aloud, going on by itself | `presentSlide` | #8, #10 |
| Storyboards: a cast of characters drawn once, then panels that keep them the same | `defineStoryboard`, `presentPanel` | #12 |
| Step-by-step guides: a slideshow that waits for the user after each step | `presentSlide` with `mode: "steps"` | #13, #14 |
| Interactive stories: panels that offer choices and wait for the user's pick | `presentPanel` with `choices` | #13, #14 |

This plan brings them to MulmoChat and adds what MulmoGlass can't have: **turning a storyboard or a
slideshow into a narrated movie** with mulmocast (presentMulmoScript). A movie needs a server, so it
belongs here.

Only after this is finished do the tools move into shared plugin packages (see "Afterwards"): the
move should carry finished code, one copy per app, not code still changing.

## Where things stand (checked 2026-09-27)

### MulmoGlass (the source)
- `src/tools/presentSlide.ts`: slides and guides; a guide is recognised by its length and first
  title (slides carry no ID); "go back" re-shows the saved step; each step is drawn with the previous
  step as a reference image.
- `src/tools/storyboard.ts`: `defineStoryboard` draws a reference sheet per character in parallel;
  `presentPanel` sends the sheets of the characters in a panel as reference images. Saved as
  `artifacts/storyboards/<id>.json` (MulmoGlass's own format, which maps onto a MulmoScript).
- `src/tools/sequence.ts`: shared pieces (`SequenceStep`, the repeat guard, the fitted-image View
  with caption and choices, `generateStepImage`, `userSpokeSince`).
- `src/tools/sequences.ts`: which tools are sequences. `src/composables/useSequence.ts`: nudges the
  model once when it stops mid-sequence, stops when the user speaks, leaves waiting steps alone.
- `src/host/imageGeneration.ts`: reference images for Gemini (`inlineData`), OpenAI (`/v1/images/edits`,
  multipart `image[]`) and xAI (`/v1/images/edits`, `images` list), shrunk to 768 px JPEG; every image
  saved as `artifacts/images/<YYYY>/<MM>/<id>.<ext>` with the path in the result (#11).
- Exposed to tools as `context.app.generateImageWithReferences(prompt, dataUrls)`, a MulmoGlass-only
  extension.

Lessons from live testing that must carry over:
- Instructions alone don't hold a waiting step. Gemini Live went on to the next guide step and Grok to
  the next panel in the same reply, so the tool refuses a step past a waiting one until the user has
  spoken since it appeared, and while the step before it is still being drawn.
- Gemini Live sometimes calls the next step twice; an identical call within a minute is dropped.
- Gemini needs `responseModalities: ["IMAGE"]`, and a slide title framed as
  `A presentation slide titled "…"`, or it answers some prompts with text only.
- Models draw words into pictures despite "no text"; Gemini skips optional captions.

### MulmoChat (the target)
- `server/plugins/appContext.ts`: `generateImage(prompt, settings)` calls `runImageBackend` with the
  prompt and model only, and returns an inline data URL. **Nothing is saved to disk.**
- `server/routes/image.ts`: `generateGeminiImage({ prompt, images })` already accepts input images
  but labels them all `image/png`; `generateOpenAIImage` uses `images.edit` with **only `images[0]`**.
  ComfyUI (`server/routes/comfyui.ts`) is text-to-image only.
- `src/tools/serverPlugin.ts` `runOnServer`: a server-run tool posts `{ args, config }` to
  `/api/plugin/<tool>`; the package must also be in `PLUGIN_PACKAGES` (`server/plugins/config.ts`).
- `docs/plugin-development-guide.md:752` says `generateImage(prompt)` returns `Promise<string>`; it
  returns a `ToolResult`. Fix when documenting reference images.

### MulmoClaude (the reference host)
- `src/plugins/editImages/` (built into the app, not a package): tool `editImages` with `prompt` and
  `imagePaths` (workspace-relative, e.g. `artifacts/images/2026/04/abc.png`); one image restyles,
  several are combined into one result.
- `server/api/routes/image.ts` `POST /api/edit-image`: `{ prompt, imagePaths }`, at most 8
  (`MAX_EDIT_IMAGES`), sent to Gemini as `inlineData` parts before the prompt. `API_ROUTES.image.edit`.
- `loadSourceImage` accepts `artifacts/images/**.png` only (plus `data/attachments/`): **`.jpg` and
  `.webp` are refused**, although Gemini and xAI return JPEG and the comments say such files exist.
- Images are saved as `artifacts/images/YYYY/MM/<id>.png` (`server/utils/files/image-store.ts`).

### mulmocast 2.12.0 (MulmoScript 1.1)
- Minimal script: `{ "$mulmocast": { "version": "1.1" }, "beats": [{ "text": "…" }] }`; defaults for
  `canvasSize` (1280x720), `speechParams`, `imageParams`, `lang`.
- A beat can show an existing picture: `image: { type: "image", source: { kind: "path", path } }`.
- `imageParams.images` holds named references (`{ type: "image", source }` or
  `{ type: "imagePrompt", prompt }`); a beat's `imageNames` picks which ones its `imagePrompt` uses
  (all of them when omitted). `base64` sources are not supported as references.
- **`path` sources resolve relative to the script's directory.** presentMulmoScript saves scripts in
  `artifacts/stories/`, so a saved image is `../images/2026/09/x.jpg`, not its workspace path.
- presentMulmoScript (`@mulmoclaude/mulmoscript-plugin`, host `server/plugins/mulmoscriptHost.ts`)
  takes a full `script` or a `filePath` (resolved against `artifacts/`) and `autoGenerateMovie`.
  Nothing checks `kind: "path"` sources inside a script for `..` or absolute paths today.

## Decisions

1. **Reference images are passed as workspace paths, as MulmoClaude does** (`imagePaths`), not as data
   URLs (MulmoGlass today). Short, readable by the model, the same in every host. MulmoGlass switches
   to the same shape in Phase 4.
2. **Allow `.jpg` and `.webp` sources.** Converting everything to PNG would make files larger for
   nothing. This needs the same change in MulmoClaude's `loadSourceImage`, so both hosts accept the
   same paths. *(Needs sign-off: it is a MulmoClaude change.)*
3. **Movie narration is written when the movie is made**, by a text model, from the storyboard's
   title, cast, panel scenes, captions and the choices taken. Asking the voice model to pass the
   narration as a tool argument would slow every panel, and a transcript of what it said is not
   available on every transport. *(Recommended; needs sign-off.)*
4. **A movie uses the pictures already made**, one beat per panel or slide, so it shows exactly what the
   user saw and nothing is drawn twice.
5. **Slideshows are saved too** (`artifacts/slideshows/<id>.json`), like storyboards, so either can
   become a movie. The result tells the model the slideshow's ID.

## Phase 1: Reference images and saved images on the server

One PR. Everything later builds on it.

- `server/plugins/appContext.ts`:
  - Save every generated image as `artifacts/images/<YYYY>/<MM>/<id>.<ext>` through the rooted
    `FileOps` (`server/plugins/fileOps.ts`), return the path in `data.imagePath` and say
    `saved to <path>` in the message; keep the data URL for the Views. A failed save still shows the
    picture, without a path. (Same behaviour as MulmoGlass #11.)
  - Add `editImage(prompt, imagePaths)` to `context.app`: load the images through the rooted
    `FileOps` (so `..` and symlinks out of the workspace are refused), at most 8, `.png`/`.jpg`/`.webp`,
    and call the backend with them. Same limits and refusal wording as MulmoClaude's `/api/edit-image`.
- `server/routes/image.ts`:
  - Gemini: send each input image with its real MIME type instead of `image/png`.
  - OpenAI: send every input image to `images.edit`, not only the first.
  - ComfyUI: no input images; `editImage` falls back to the prompt alone and says so in the result.
- Shrink reference images before sending (768 px on the longer side, JPEG), as MulmoGlass does.
- Docs: `docs/architecture.md` (the image host), `docs/plugin-development-guide.md` and `.ja.md`
  (document `generateImage(prompt) → ToolResult` and `editImage(prompt, imagePaths) → ToolResult`;
  fix the `Promise<string>` rows), and the sibling-repo guides CLAUDE.md lists.
- **Test:** `yarn typecheck`, `yarn lint`; a script against `/api/plugin/…` for each backend
  (Gemini, OpenAI; ComfyUI's fallback) with one and two reference images; check that paths outside
  `artifacts/images/` and `..` are refused; `yarn test:image:openai` still passes.

## Phase 2: Slides and storyboards in MulmoChat

One PR, possibly two (slides first, then storyboards).

- Port from MulmoGlass into `src/tools/`: `presentSlide.ts`, `storyboard.ts`, `sequence.ts`,
  `sequences.ts`, and `useSequence.ts` into `src/composables/`. Same tool names, arguments and
  result shapes, so the later packages drop in for both apps.
- **Split by where things must run:**
  - The server does the drawing and the files: character sheets, panels and slides through
    `generateImage` / `editImage`; storyboard and slideshow records in `artifacts/storyboards/` and
    `artifacts/slideshows/`. These become server-run tools (`runOnServer`), or host tools in
    `server/plugins/dispatch.ts` since they are not packages yet (`hostToolDefinition()` placeholders).
  - The browser keeps the sequence state that depends on the user: `userSpokeSince`, the hold for
    waiting steps and steps still being drawn, the repeat guard, and `useSequence`'s nudge. It checks
    before posting to the server.
- **Per transport** (see CLAUDE.md's matrix):
  - OpenAI Realtime, Gemini Live, Grok Voice: `onSpeechStarted` marks the user as having spoken.
  - Text: sending a message counts as speaking; a waiting step simply waits for the next message.
    The nudge uses the text transport's follow-up turn.
- Register the tools in `src/tools/index.ts` and add them to the fixed roles that should have them in
  `src/config/roles.ts` (a tool missing from a role is silently absent). Candidates: General, Office,
  Tutor, Storyteller-like roles.
- The keep-the-plugin-out-of-the-shell rule: `useSequence` reaches the tools only through
  `src/tools/` (`sequences.ts`), never `if (toolName === "presentSlide")` in a view.
- **Test:** the MulmoGlass scenarios on all four transports: a full slideshow; "stop" mid-slideshow; a
  four-panel storyboard with consistent characters; a guide with "next / go back / next / next"; an
  interactive story with spoken (or typed) choices. The in-page overlap test (a step asked for while
  the previous one is drawn; "already on the screen" after another result replaced it).

## Phase 3: The movie

One PR.

- New tool `makeMovie` with `storyboardId` or `slideshowId`:
  1. Load the record.
  2. Ask a text model (the server's text route) for narration per panel or slide: full sentences
     (Gemini TTS refuses very short narration), in the conversation's language.
  3. Build a MulmoScript: `$mulmocast.version "1.1"`, `title`, `lang`, one beat per panel or slide
     with `text` (the narration) and `image: { type: "image", source: { kind: "path", path:
     "../images/…" } }` (paths rewritten relative to `artifacts/stories/`); speakers as
     presentMulmoScript's defaults (Gemini TTS). For an interactive story, the panels of the path
     taken, in order.
  4. Save it through presentMulmoScript's host (`artifacts/stories/<slug>-<ts>.json`) and start the
     movie (`autoGenerateMovie`), so the user sees presentMulmoScript's View with its progress.
- Validate `path` sources: only `../images/…` inside the workspace. Consider adding the same check to
  presentMulmoScript for any script (nothing checks them today); if so, it is its own change.
- Tool description and role prompts: "make a movie of this story/slideshow".
- **Test:** a storyboard and a slideshow each become a playable MP4; beats match panels; the narration
  is in the conversation's language; an interactive story exports the path taken; a missing picture
  file fails with a message the model can repeat.

## Phase 4: MulmoGlass in line

One MulmoGlass PR.

- Pass reference images as workspace paths (`editImage(prompt, imagePaths)`, reading OPFS), replacing
  `generateImageWithReferences`.
- Save slideshow records like storyboards, with the same file shapes as MulmoChat.
- MulmoGlass still can't render movies. How a MulmoGlass storyboard reaches MulmoChat (export and
  import, a shared workspace) is a separate question.

## Afterwards: a plugins-only repo

Not part of this plan; recorded so the phases above don't make it harder.

- Move `presentSlide`, the storyboard tools, the shared sequence code and `makeMovie` into packages in
  a plugins-only repo; later move MulmoClaude's `packages/plugins/*` there too, keeping package names
  and git history, one package at a time, least host-dependent first.
- `editImage` should become a documented convention in gui-chat-protocol (`ToolContextApp` is an open
  record; `generateImage` itself is a convention, mentioned only in the spec's prose). Its upstream
  CLAUDE.md rules for typing apply.
- Local checkouts are stale: `mulmoclaude` 246 commits behind; `plugins/gui-chat-protocol` at 0.4.0
  while 2.0.0 is published. Pull before starting.

## Risks

- **User speech detection gates the waiting steps.** If a transport reports speech late, a real "next"
  is held until the user speaks again. It never happened in MulmoGlass testing, but MulmoChat's text
  transport and each voice need their own check.
- **ComfyUI has no reference images**: storyboards on ComfyUI lose character consistency. Say so in the
  result, or steer storyboards to Gemini/OpenAI.
- **Movie time and cost**: narration (text model), TTS per beat, and rendering; a 6-panel story is a
  few minutes of work. presentMulmoScript already shows progress.
- **Image paths in scripts**: mulmocast resolves `path` relative to the script, and nothing validates
  them; the export must write only paths it checked.
