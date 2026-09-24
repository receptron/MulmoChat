import type { NextFunction, Request, Response } from "express";
import { sendApiError } from "./logger";

// Guard for state-changing routes (e.g. server-run plugins that write into the
// shared workspace). The server listens on all interfaces with permissive CORS,
// so without this any web page the user visits could POST to it.
//
// - Only JSON bodies are accepted: an HTML form cannot send application/json,
//   which rules out cross-site form posts.
// - A browser always sends Origin on a cross-site POST, so a request with an
//   Origin must come from a trusted one: loopback on any port (the Vite dev
//   server, the app itself), or an origin in MULMOCHAT_ALLOWED_ORIGINS
//   (comma-separated, e.g. http://mac.local:5173). The Host header is not
//   trusted: with DNS rebinding an attacker's domain can resolve to this
//   machine and send a matching Origin and Host.
// - Requests without Origin come from non-browser clients (curl, smoke tests)
//   and are allowed.

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

const configuredOrigins = (): Set<string> =>
  new Set(
    (process.env.MULMOCHAT_ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((origin) => origin.trim().replace(/\/$/, ""))
      .filter(Boolean),
  );

function isTrustedOrigin(origin: string): boolean {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  if (LOOPBACK_HOSTS.has(url.hostname)) return true;
  return configuredOrigins().has(url.origin);
}

export function requireTrustedOrigin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.is("application/json")) {
    sendApiError(res, req, 415, "Content-Type must be application/json");
    return;
  }
  const origin = req.get("origin");
  if (origin !== undefined && !isTrustedOrigin(origin)) {
    sendApiError(
      res,
      req,
      403,
      "Origin not allowed",
      `Add ${origin} to MULMOCHAT_ALLOWED_ORIGINS to allow it.`,
    );
    return;
  }
  next();
}
