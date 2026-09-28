// A stand-in for the image models, for tests: with MULMOCHAT_MOCK_IMAGE_MS set
// (`MULMOCHAT_MOCK_IMAGE_MS=8000 yarn dev:server`), every Gemini and OpenAI
// image is this one, returned after that many milliseconds, as a real model
// takes seconds. No API call, so a voice test of a slideshow costs nothing and
// can't hit a spending cap. The picture is a PNG showing the prompt, so a
// screenshot says which slide is on the screen.
//
// Written with node:zlib and a 5x7 bitmap font: the server has no image
// library, and the tests need no more than readable capitals.
import { deflateSync } from "node:zlib";
import { logger } from "./logger";

const WIDTH = 1024;
const HEIGHT = 576;
const MARGIN = 32;

/** The mock's delay in milliseconds, or undefined when images are real. */
export function mockImageDelayMs(): number | undefined {
  const raw = process.env.MULMOCHAT_MOCK_IMAGE_MS;
  if (raw === undefined || raw === "") return undefined;
  const ms = Number(raw);
  return Number.isFinite(ms) && ms >= 0 ? ms : undefined;
}

let count = 0;

/** The mock picture for `prompt` (raw base64 PNG) after the mock's delay, or
 *  undefined when MULMOCHAT_MOCK_IMAGE_MS isn't set. */
export async function mockImage(
  prompt: string,
  referenceCount = 0,
): Promise<string | undefined> {
  const delay = mockImageDelayMs();
  if (delay === undefined) return undefined;
  count += 1;
  const number = count;
  logger.info("mock image", { number, delay, referenceCount });
  await new Promise((resolve) => setTimeout(resolve, delay));
  return renderPng(prompt, number, referenceCount).toString("base64");
}

// --- Drawing ---------------------------------------------------------------

type Rgb = readonly [number, number, number];

/** A light background colour from the prompt, so two pictures differ. */
function backgroundOf(text: string): Rgb {
  let hash = 0;
  for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const channel = (shift: number) => 170 + ((hash >> shift) & 0x3f);
  return [channel(0), channel(8), channel(16)];
}

function renderPng(prompt: string, number: number, references: number) {
  const pixels = Buffer.alloc(WIDTH * HEIGHT * 3);
  const [r, g, b] = backgroundOf(prompt);
  for (let i = 0; i < WIDTH * HEIGHT; i++) {
    pixels[i * 3] = r;
    pixels[i * 3 + 1] = g;
    pixels[i * 3 + 2] = b;
  }
  const ink: Rgb = [30, 30, 40];
  const put = (x: number, y: number, size: number) => {
    for (let dy = 0; dy < size; dy++) {
      for (let dx = 0; dx < size; dx++) {
        const px = x + dx;
        const py = y + dy;
        if (px < 0 || py < 0 || px >= WIDTH || py >= HEIGHT) continue;
        const at = (py * WIDTH + px) * 3;
        pixels[at] = ink[0];
        pixels[at + 1] = ink[1];
        pixels[at + 2] = ink[2];
      }
    }
  };
  const text = (line: string, x: number, y: number, scale: number) => {
    let cx = x;
    for (const char of line) {
      const glyph = FONT[char] ?? FONT["?"];
      glyph.forEach((row, gy) => {
        for (let gx = 0; gx < 5; gx++) {
          if (row[gx] === "#") put(cx + gx * scale, y + gy * scale, scale);
        }
      });
      cx += 6 * scale;
    }
  };

  const refs = references ? ` (${references} REF)` : "";
  const title = `MOCK IMAGE ${number}${refs}`;
  text(title, MARGIN, MARGIN, 6);
  const scale = 3;
  const perLine = Math.floor((WIDTH - 2 * MARGIN) / (6 * scale));
  const lines = wrap(prompt.toUpperCase(), perLine);
  const top = MARGIN + 7 * 6 + 24;
  const maxLines = Math.floor((HEIGHT - top - MARGIN) / (9 * scale));
  lines
    .slice(0, maxLines)
    .forEach((line, i) => text(line, MARGIN, top + i * 9 * scale, scale));
  return encodePng(pixels);
}

function wrap(text: string, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const piece = word.length > width ? word.slice(0, width) : word;
    if (line && line.length + 1 + piece.length > width) {
      lines.push(line);
      line = piece;
    } else {
      line = line ? `${line} ${piece}` : piece;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// --- PNG ---------------------------------------------------------------------

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typed = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed));
  return Buffer.concat([length, typed, crc]);
}

/** An 8-bit RGB PNG of WIDTH x HEIGHT `pixels`. */
function encodePng(pixels: Buffer): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(WIDTH, 0);
  header.writeUInt32BE(HEIGHT, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // colour type: RGB
  const stride = WIDTH * 3;
  const raw = Buffer.alloc((stride + 1) * HEIGHT);
  for (let y = 0; y < HEIGHT; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// --- A 5x7 font: capitals, digits and common punctuation ---------------------

const g = (...rows: string[]) => rows;
const FONT: Record<string, string[]> = {
  " ": g(".....", ".....", ".....", ".....", ".....", ".....", "....."),
  A: g(".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"),
  B: g("####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."),
  C: g(".###.", "#...#", "#....", "#....", "#....", "#...#", ".###."),
  D: g("####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."),
  E: g("#####", "#....", "#....", "####.", "#....", "#....", "#####"),
  F: g("#####", "#....", "#....", "####.", "#....", "#....", "#...."),
  G: g(".###.", "#...#", "#....", "#.###", "#...#", "#...#", ".####"),
  H: g("#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"),
  I: g(".###.", "..#..", "..#..", "..#..", "..#..", "..#..", ".###."),
  J: g("..###", "...#.", "...#.", "...#.", "...#.", "#..#.", ".##.."),
  K: g("#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"),
  L: g("#....", "#....", "#....", "#....", "#....", "#....", "#####"),
  M: g("#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"),
  N: g("#...#", "#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#"),
  O: g(".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."),
  P: g("####.", "#...#", "#...#", "####.", "#....", "#....", "#...."),
  Q: g(".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"),
  R: g("####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"),
  S: g(".####", "#....", "#....", ".###.", "....#", "....#", "####."),
  T: g("#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."),
  U: g("#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."),
  V: g("#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."),
  W: g("#...#", "#...#", "#...#", "#.#.#", "#.#.#", "#.#.#", ".#.#."),
  X: g("#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"),
  Y: g("#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."),
  Z: g("#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"),
  "0": g(".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."),
  "1": g("..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."),
  "2": g(".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"),
  "3": g("#####", "...#.", "..#..", "...#.", "....#", "#...#", ".###."),
  "4": g("...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."),
  "5": g("#####", "#....", "####.", "....#", "....#", "#...#", ".###."),
  "6": g("..##.", ".#...", "#....", "####.", "#...#", "#...#", ".###."),
  "7": g("#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."),
  "8": g(".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."),
  "9": g(".###.", "#...#", "#...#", ".####", "....#", "...#.", ".##.."),
  ".": g(".....", ".....", ".....", ".....", ".....", ".##..", ".##.."),
  ",": g(".....", ".....", ".....", ".....", ".##..", "..#..", ".#..."),
  ":": g(".....", ".##..", ".##..", ".....", ".##..", ".##..", "....."),
  ";": g(".....", ".##..", ".##..", ".....", ".##..", "..#..", ".#..."),
  "'": g("..#..", "..#..", ".#...", ".....", ".....", ".....", "....."),
  '"': g(".#.#.", ".#.#.", ".....", ".....", ".....", ".....", "....."),
  "-": g(".....", ".....", ".....", "#####", ".....", ".....", "....."),
  "?": g(".###.", "#...#", "....#", "...#.", "..#..", ".....", "..#.."),
  "!": g("..#..", "..#..", "..#..", "..#..", "..#..", ".....", "..#.."),
  "(": g("...#.", "..#..", ".#...", ".#...", ".#...", "..#..", "...#."),
  ")": g(".#...", "..#..", "...#.", "...#.", "...#.", "..#..", ".#..."),
  "/": g(".....", "....#", "...#.", "..#..", ".#...", "#....", "....."),
  "&": g(".##..", "#..#.", "#.#..", ".#...", "#.#.#", "#..#.", ".##.#"),
  "%": g("##...", "##..#", "...#.", "..#..", ".#...", "#..##", "...##"),
};
