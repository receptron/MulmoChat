import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import express, { type Router } from "express";
import movieRouter from "../server/routes/movie";
import pdfRouter from "../server/routes/pdf";
import { mulmoScriptMediaRouter } from "../server/plugins/mulmoscriptHost";
import { FILE_ROUTE_LIMIT } from "../server/utils/rateLimit";

const TOO_MANY_REQUESTS = 429;

const listen = async (
  router: Router,
): Promise<{ server: Server; baseUrl: string }> => {
  const app = express();
  app.use(express.json());
  app.use("/api", router);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error(`unexpected server address: ${address}`);
  }
  return { server, baseUrl: `http://127.0.0.1:${address.port}/api` };
};

// Every request is one the route refuses before touching a file, so only the
// limiter decides whether the last one is answered 429.
const statusesOf = async (url: string, method: string, count: number) => {
  const statuses: number[] = [];
  for (let sent = 0; sent < count; sent++) {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: method === "GET" ? undefined : "{}",
    });
    await response.arrayBuffer();
    statuses.push(response.status);
  }
  return statuses;
};

const ROUTES: { router: Router; method: string; path: string }[] = [
  { router: movieRouter, method: "POST", path: "/save-images" },
  { router: pdfRouter, method: "POST", path: "/save-pdf" },
  { router: mulmoScriptMediaRouter, method: "GET", path: "/mulmoscript/media" },
];

describe("file routes are rate-limited", () => {
  const servers: Server[] = [];
  const baseUrls = new Map<Router, string>();

  before(async () => {
    for (const router of new Set(ROUTES.map((route) => route.router))) {
      const { server, baseUrl } = await listen(router);
      servers.push(server);
      baseUrls.set(router, baseUrl);
    }
  });
  after(() => servers.forEach((server) => server.close()));

  ROUTES.forEach(({ router, method, path }) => {
    it(`${method} ${path} answers ${TOO_MANY_REQUESTS} after ${FILE_ROUTE_LIMIT} requests, with its own counter`, async () => {
      const statuses = await statusesOf(
        `${baseUrls.get(router)}${path}`,
        method,
        FILE_ROUTE_LIMIT + 1,
      );
      const allowed = statuses.slice(0, FILE_ROUTE_LIMIT);
      assert.ok(
        allowed.every((status) => status !== TOO_MANY_REQUESTS),
        `limited early: ${allowed.join(",")}`,
      );
      assert.equal(statuses[FILE_ROUTE_LIMIT], TOO_MANY_REQUESTS);
    });
  });
});
