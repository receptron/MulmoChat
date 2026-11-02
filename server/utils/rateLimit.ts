import { rateLimit, type RateLimitRequestHandler } from "express-rate-limit";

export const FILE_ROUTE_WINDOW_MS = 60_000;
export const FILE_ROUTE_LIMIT = 60;

// For routes that read or write files. The app calls each one per user action,
// so this only stops a runaway client. Each call has its own counter.
export const fileRouteRateLimit = (): RateLimitRequestHandler =>
  rateLimit({
    windowMs: FILE_ROUTE_WINDOW_MS,
    limit: FILE_ROUTE_LIMIT,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  });
