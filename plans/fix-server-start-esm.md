# fix: `yarn start` fails with ERR_MODULE_NOT_FOUND

Issue: #275

## Cause
- `server/tsconfig.json` uses `moduleResolution: "bundler"`, so tsc accepts extensionless relative imports and emits them unchanged into `dist/server`. Node ESM (`"type": "module"`) cannot resolve them. `tsx` (dev) hides this.
- `app.get("*")` is Express 4 syntax; Express 5 throws at registration. Only reached when `NODE_ENV=production`.

## Fix
1. Add `.js` to every relative import under `server/` (excluding `server/tests/`, which run through tsx and are not compiled).
2. Keep `moduleResolution: "bundler"`: `NodeNext` would enforce extensions in tsc, but the published `.d.ts` of `gui-chat-protocol` and `@mulmoclaude/*-plugin` use extensionless re-exports and stop resolving under it.
3. Enforce the extension with an ESLint `no-restricted-syntax` rule scoped to `server/**/*.ts`.
4. Replace `app.get("*")` with `app.get("/{*splat}")`.
5. CI: after `yarn build`, start `dist/server/index.js` in production mode and check `/api/health` and `/`.

## Out of scope
- Making dependency `.d.ts` NodeNext-compatible.
- `yarn start`'s inline `NODE_ENV=` not working under Windows cmd.
