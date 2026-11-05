# Fix the path-injection and request-forgery errors in the file routes

Issue: #302

## Problem

CodeQL reports `js/path-injection` and `js/request-forgery` errors in `server/routes/pdf.ts` and
`server/routes/movie.ts`. The request's `uuid`, `title`, image ids and `pdfPath` become file paths.
`download-pdf` streams any path the body names.

## Who calls what

- `generate-pdf`, `download-pdf`: nothing in `src/` or in any installed plugin. They served the
  markdown plugin before it became a package.
- `save-pdf`: `@mulmochat-plugin/summarize-pdf`, with the tool result's `uuid`.
- `save-images`: `app.saveImages`, documented for plugin authors.

## Approach

- Delete `generate-pdf` and `download-pdf`, the way #220 removed the old movie routes. This also
  removes the request-forgery alert, which was `generate-pdf` loading its own HTML in puppeteer.
- `server/utils/outputNames.ts`: `isUuid` and `isSafeFileName`, the rules for request values that
  become part of a file name. Bad values are refused (400), not cleaned, so a caller learns its
  value was wrong instead of finding the file under another name.
- `save-pdf` refuses a non-UUID `uuid`; `fileName` was already reduced to `[a-z0-9_]`.
- `save-images` refuses a non-UUID `uuid` and any image id outside `[A-Za-z0-9_-]`.

## Tests

`test/test_outputFileRoutes.ts`: both rules over accepted and refused values; each route over HTTP
in a temporary working directory, checking that refused requests write nothing and accepted ones
write where they say; and that the deleted routes are gone. Turning off any check, or loosening
either pattern, turns a case red.

## Risk

A plugin that sends a `uuid` that is not a UUID, or an image id with other characters, now gets a
400. The only known callers send UUIDs.
