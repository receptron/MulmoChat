import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import express from "express";
import { outputStatic } from "../server/utils/outputStatic";

describe("the /output mount", () => {
  let dir = "";
  let server: Server;
  let baseUrl = "";

  before(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "mulmochat-static-"));
    await writeFile(path.join(dir, "a.pdf"), "pdf");
    await mkdir(path.join(dir, "workspace", "jinglescript"), {
      recursive: true,
    });
    await writeFile(
      path.join(dir, "workspace", "jinglescript", "song.json"),
      "{}",
    );
    const app = express();
    app.use("/output", outputStatic(dir));
    server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    const address = server.address();
    if (address === null || typeof address === "string") {
      throw new Error(`unexpected server address: ${address}`);
    }
    baseUrl = `http://127.0.0.1:${address.port}/output`;
  });
  after(async () => {
    server.close();
    await rm(dir, { recursive: true, force: true });
  });

  it("serves generated files", async () => {
    const response = await fetch(`${baseUrl}/a.pdf`);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "pdf");
  });

  it("never serves the fallback plugin workspace", async () => {
    for (const route of [
      "/workspace/jinglescript/song.json",
      "/workspace/",
      "/workspace",
      "/WORKSPACE/jinglescript/song.json",
      "/./workspace/jinglescript/song.json",
      "/%77orkspace/jinglescript/song.json",
      "/x/../workspace/jinglescript/song.json",
      "/x/%2E%2E/workspace/jinglescript/song.json",
      "/workspace%2Fjinglescript%2Fsong.json",
      "/%5Cworkspace%5Cjinglescript%5Csong.json",
      "/%E0%A4%A",
    ]) {
      const response = await fetch(`${baseUrl}${route}`);
      assert.equal(response.status, 404, route);
    }
  });
});
