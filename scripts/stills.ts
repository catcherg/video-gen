// Renders individual frames for checking. Usage: npm run stills <slug> <frame> [frame...]
import { mkdirSync } from "node:fs";
import path from "node:path";
import { renderStill, selectComposition } from "@remotion/renderer";
import { GL } from "../render-settings";
import { outputDir, requireSlug, ROOT } from "./lib/video";
import { guardedBrowser, secureBundle } from "./lib/sandbox";

const usage = "npm run stills <slug> <frame> [frame...]";
const slug = requireSlug(process.argv[2], usage);
const frames = process.argv.slice(3).map(Number);
if (frames.length === 0 || frames.some((f) => !Number.isInteger(f) || f < 0)) {
  console.error(`Usage: ${usage}`);
  process.exit(2);
}

const outDir = path.join(outputDir(slug), "stills");
mkdirSync(outDir, { recursive: true });

const serveUrl = await secureBundle(ROOT);
const browserExecutable = await guardedBrowser(ROOT);
const inputProps = { withAudio: false };
const opts = { serveUrl, inputProps, browserExecutable, chromiumOptions: { gl: GL }, logLevel: "error" as const };
const composition = await selectComposition({ ...opts, id: slug });
for (const frame of frames) {
  if (frame >= composition.durationInFrames) {
    console.error(`Frame ${frame} is past the end (${composition.durationInFrames} frames)`);
    process.exit(2);
  }
  const output = path.join(outDir, `still_${String(frame).padStart(4, "0")}.png`);
  await renderStill({ ...opts, composition, frame, output });
  console.log(path.relative(ROOT, output));
}
