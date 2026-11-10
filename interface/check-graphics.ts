// Works out once per computer how to render, and saves the answer to out/graphics.json for render-settings.ts to read.
// Downloads the render browser too, the first time, so that doesn't surprise anyone halfway through a video.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { ensureBrowser, renderStill, selectComposition } from "@remotion/renderer";

const ROOT = path.resolve(import.meta.dirname, "..");
const SOFTWARE = /swiftshader|llvmpipe|software/i;
type Gl = "angle" | "swangle";

await ensureBrowser({ onBrowserDownload: () => {
  console.error("Downloading the render browser. This only happens once.");
  return { version: null, onProgress: () => {} };
} });

const publicDir = mkdtempSync(path.join(os.tmpdir(), "video-gen-probe-"));
const serveUrl = await bundle({ entryPoint: path.join(ROOT, "interface/graphics-probe.tsx"), publicDir });

const probe = async (gl: Gl) => {
  let renderer: string | undefined;
  const opts = { serveUrl, chromiumOptions: { gl }, logLevel: "error" as const, onBrowserLog: (log: { text: string }) => {
    if (log.text.startsWith("GRAPHICS:")) renderer = log.text.slice("GRAPHICS:".length);
  } };
  const composition = await selectComposition({ ...opts, id: "probe" });
  await renderStill({ ...opts, composition, output: path.join(publicDir, `${gl}.png`) });
  if (!renderer) throw new Error("The browser didn't report its graphics hardware.");
  return renderer;
};

const forced = process.env.VIDEO_GEN_GL as Gl | undefined;
let answer: { gl: Gl; mode: "gpu" | "software" } | undefined;
let lastError = "";
for (const gl of forced ? [forced] : (["angle", "swangle"] as Gl[])) {
  try {
    const renderer = await probe(gl);
    answer = { gl, mode: gl === "swangle" || SOFTWARE.test(renderer) ? "software" : "gpu" };
    break;
  } catch (err) {
    lastError = (err as Error).message;
  }
}
rmSync(publicDir, { recursive: true, force: true });

if (!answer) {
  console.log(JSON.stringify({ state: "failed", message: lastError.slice(0, 300) }));
  process.exit(1);
}
if (!forced) {
  mkdirSync(path.join(ROOT, "out"), { recursive: true });
  writeFileSync(path.join(ROOT, "out/graphics.json"), `${JSON.stringify({ platform: process.platform, ...answer })}\n`);
}
console.log(JSON.stringify({ state: "ready", mode: answer.mode }));
process.exit(0);
