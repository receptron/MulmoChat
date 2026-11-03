import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import express from "express";
import movieRouter from "../server/routes/movie";
import pdfRouter from "../server/routes/pdf";
import {
  isSafeFileName,
  isStringRecord,
  isUuid,
} from "../server/utils/outputNames";

const UUID = "0f8fad5b-d9cb-469f-a165-70867728950e";
const PNG = "data:image/png;base64,iVBORw0KGgo=";
const PDF = "data:application/pdf;base64,JVBERi0=";
const UNSAFE_UUIDS: unknown[] = [
  "../x",
  `${UUID}/..`,
  `../${UUID}`,
  "0f8fad5b-d9cb-469f-a165-70867728950",
  `${UUID}x`,
  ` ${UUID}`,
  123,
  ["a"],
  { a: 1 },
];

describe("isUuid", () => {
  it("accepts a UUID in either case and nothing else", () => {
    assert.equal(isUuid(UUID), true);
    assert.equal(isUuid(UUID.toUpperCase()), true);
    [...UNSAFE_UUIDS, "", undefined, null].forEach((value) =>
      assert.equal(isUuid(value), false, String(value)),
    );
  });
});

describe("isSafeFileName", () => {
  it("accepts letters, digits, _ and - only", () => {
    ["a", "beat-1", "image_02", "ABC"].forEach((value) =>
      assert.equal(isSafeFileName(value), true, value),
    );
    [
      "",
      ".",
      "..",
      "a/b",
      "a\\b",
      "a.png",
      "../a",
      "a b",
      "é",
      1,
      null,
    ].forEach((value) =>
      assert.equal(isSafeFileName(value), false, String(value)),
    );
  });
});

describe("isStringRecord", () => {
  it("accepts a plain object whose values are all strings", () => {
    [{}, { a: "x" }, { a: "x", b: "" }].forEach((value) =>
      assert.equal(isStringRecord(value), true, JSON.stringify(value)),
    );
    [null, undefined, 1, "a", [], ["a"], { a: 1 }, { a: "x", b: null }].forEach(
      (value) => assert.equal(isStringRecord(value), false, String(value)),
    );
  });
});

describe("file routes write only under output/", () => {
  const originalCwd = process.cwd();
  let workDir = "";
  let server: Server;
  let baseUrl = "";

  before(async () => {
    workDir = await mkdtemp(path.join(tmpdir(), "mulmochat-output-"));
    process.chdir(workDir);
    const app = express();
    app.use(express.json());
    app.use("/api", movieRouter);
    app.use("/api", pdfRouter);
    server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    const address = server.address();
    if (address === null || typeof address === "string") {
      throw new Error(`unexpected server address: ${address}`);
    }
    baseUrl = `http://127.0.0.1:${address.port}/api`;
  });
  after(async () => {
    server.close();
    process.chdir(originalCwd);
    await rm(workDir, { recursive: true, force: true });
  });

  const post = async (route: string, body: unknown) => {
    const response = await fetch(`${baseUrl}${route}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { status: response.status, json: await response.json() };
  };

  const filesUnder = async (dir: string): Promise<string[]> =>
    readdir(dir, { recursive: true }).catch(() => []);

  it("save-images refuses a uuid that is not a UUID, or an image id with other characters", async () => {
    for (const uuid of UNSAFE_UUIDS) {
      const { status, json } = await post("/save-images", {
        uuid,
        images: { a: PNG },
      });
      assert.equal(status, 400, String(uuid));
      assert.equal(json.error, "UUID must be a UUID");
    }
    for (const id of ["../a", "a/b", "a.png", ".."]) {
      const { status, json } = await post("/save-images", {
        uuid: UUID,
        images: { ok: PNG, [id]: PNG },
      });
      assert.equal(status, 400, id);
      assert.equal(json.error, "Image ids must be letters, digits, _ or -");
    }
    for (const images of [1, "a", [PNG], { a: 1 }, { a: PNG, b: null }]) {
      const { status, json } = await post("/save-images", {
        uuid: UUID,
        images,
      });
      assert.equal(status, 400, JSON.stringify(images));
      assert.equal(json.error, "Images must map ids to strings");
    }
    assert.deepEqual(await filesUnder(workDir), []);
  });

  it("save-images writes each image under output/images/<uuid>/", async () => {
    const { status, json } = await post("/save-images", {
      uuid: UUID,
      images: { "beat-1": PNG },
    });
    assert.equal(status, 200);
    assert.deepEqual(json.imageUrls, {
      "beat-1": `/output/images/${UUID}/beat-1.png`,
    });
    assert.deepEqual(
      await filesUnder(path.join(workDir, "output", "images", UUID)),
      ["beat-1.png"],
    );
  });

  it("save-pdf refuses a uuid that is not a UUID", async () => {
    const before = await filesUnder(workDir);
    for (const uuid of UNSAFE_UUIDS) {
      const { status, json } = await post("/save-pdf", { pdfData: PDF, uuid });
      assert.equal(status, 400, String(uuid));
      assert.equal(json.error, "UUID must be a UUID");
    }
    assert.deepEqual(await filesUnder(workDir), before);
  });

  it("save-pdf writes output/<uuid>_<name>.pdf", async () => {
    const { status, json } = await post("/save-pdf", {
      pdfData: PDF,
      uuid: UUID,
      fileName: "../My Report.pdf",
    });
    assert.equal(status, 200);
    assert.equal(json.pdfUrl, `/output/${UUID}____my_report.pdf`);
    assert.ok(
      (await filesUnder(path.join(workDir, "output"))).includes(
        `${UUID}____my_report.pdf`,
      ),
    );
  });

  it("no longer serves generate-pdf or download-pdf", async () => {
    for (const route of ["/generate-pdf", "/download-pdf"]) {
      const response = await fetch(`${baseUrl}${route}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pdfPath: "/etc/hosts",
          markdown: "x",
          uuid: UUID,
        }),
      });
      await response.arrayBuffer();
      assert.equal(response.status, 404, route);
    }
  });
});
