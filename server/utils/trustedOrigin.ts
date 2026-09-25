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
// - Requests without Origin come from non-browser clients (curl, smoke tests).
//   Origin can be forged by such clients, so the connection itself must come
//   from this machine (see requireLocalClient). The Vite dev server's proxy
//   connects from loopback, so the app keeps working through it, including
//   from other devices.

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

// IPv4 loopback is the whole 127.0.0.0/8 block; IPv4 clients on a dual-stack
// socket appear as ::ffff:127.x.x.x.
const isLoopbackAddress = (address: string | undefined): boolean =>
  !!address &&
  (address === "::1" ||
    /^127\.\d+\.\d+\.\d+$/.test(address) ||
    /^::ffff:127\.\d+\.\d+\.\d+$/.test(address));

/**
 * Only accept connections from this machine. The server listens on all
 * interfaces, and these routes have no authentication, so without this any
 * device on the network could call them. X-Forwarded-For is not consulted.
 * Set MULMOCHAT_ALLOW_REMOTE_PLUGINS=true to accept other machines anyway
 * (only on a network you trust).
 */
export function requireLocalClient(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (
    process.env.MULMOCHAT_ALLOW_REMOTE_PLUGINS !== "true" &&
    !isLoopbackAddress(req.socket.remoteAddress)
  ) {
    sendApiError(
      res,
      req,
      403,
      "Plugin calls are only accepted from this machine",
      "Set MULMOCHAT_ALLOW_REMOTE_PLUGINS=true to accept other machines.",
    );
    return;
  }
  next();
}

// The request must name this machine. A DNS-rebinding page sends its own
// domain as Host, so it is refused. The Vite dev proxy rewrites Host to
// localhost, so the dev app works (also from other devices).
function isLoopbackHost(host: string | undefined): boolean {
  if (!host) return false;
  try {
    return LOOPBACK_HOSTS.has(new URL(`http://${host}`).hostname);
  } catch {
    return false;
  }
}

/**
 * For GET routes that return workspace content (presentHtml pages, plugin
 * media, plugin events): a loopback Host, and no CORS header, so no other
 * site can read the response. Use after requireLocalClient.
 */
export function requireLoopbackHost(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // cors() runs on every route; this content must not be readable cross-site.
  res.removeHeader("Access-Control-Allow-Origin");
  if (!isLoopbackHost(req.get("host"))) {
    res.status(403).json({ error: "Host not allowed" });
    return;
  }
  next();
}
