# Rate-limit the file routes CodeQL flags

Issue: #300

## Problem

CodeQL's `js/missing-rate-limiting` warns on route handlers that touch the file system without a
rate limiter: `POST /api/save-images`, `/api/generate-pdf`, `/api/save-pdf`, `/api/download-pdf`,
and the production SPA fallback in `server/index.ts`. The media route already had one
(`mediaRateLimit` in `server/plugins/mulmoscriptHost.ts`).

## Approach

- `server/utils/rateLimit.ts` holds the settings once: `fileRouteRateLimit()` returns a new
  `express-rate-limit` middleware with the media route's window and limit, so each route keeps its
  own counter.
- The media route uses it instead of its own copy of the same options.
- Each flagged handler gets `fileRouteRateLimit()` as route middleware, the form CodeQL accepted on
  the media route.

## Tests

`test/test_rateLimit.ts` mounts the real routers and sends requests each route refuses before it
touches a file, so only the limiter decides the status: the request after the limit is a 429, the
ones before are not. Routes on one router run back to back, so a shared counter would fail the
second one.

Removing any one route's limiter, or raising the limit, turns its case red.

## Not covered

The SPA fallback runs only with `NODE_ENV=production` inside `server/index.ts`, which listens on
import; the repo does not run the production build locally. CI's CodeQL run is its check.

The CodeQL errors on the same files (path injection, request forgery) are a separate change.
