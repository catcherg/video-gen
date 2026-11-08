// Render a handful of full-size stills for checking: node scripts/stills.mjs 45 165 240 ...
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "node:path";

const frames = process.argv.slice(2).map(Number);
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const opts = { chromiumOptions: { gl: process.env.GL ?? "angle" } };
const composition = await selectComposition({ serveUrl, id: "V12Reel", inputProps: { withAudio: false }, ...opts });
for (const frame of frames) {
  const t0 = Date.now();
  await renderStill({ composition, serveUrl, frame, output: `out/still_${String(frame).padStart(4, "0")}.png`, inputProps: { withAudio: false }, ...opts });
  console.log(`frame ${frame} done in ${Date.now() - t0} ms`);
}
