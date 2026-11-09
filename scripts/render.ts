// Writes the audio, then the MP4. Usage: npm run render <slug> [-- --fast]
// The default is the most repeatable render. --fast uses more browser tabs and writes a separate preview file.
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { FINAL_CONCURRENCY, PREVIEW_CONCURRENCY } from "../render-settings";
import { outputDir, requireSlug, ROOT, writeVideoAudio } from "./lib/video";
import { guardedBrowser, secureBundle } from "./lib/sandbox";

const args = process.argv.slice(2);
const fast = args.includes("--fast");
const slug = requireSlug(args.find((a) => !a.startsWith("--")), "npm run render <slug> [-- --fast]");

await writeVideoAudio(slug);

mkdirSync(outputDir(slug), { recursive: true });
const output = path.relative(ROOT, path.join(outputDir(slug), fast ? `${slug}-preview.mp4` : `${slug}.mp4`));
const serveUrl = await secureBundle(ROOT);
const browser = await guardedBrowser(ROOT);
const started = Date.now();
const result = spawnSync(
  "npx",
  [
    "remotion",
    "render",
    serveUrl,
    slug,
    output,
    `--props=${JSON.stringify({ withAudio: true })}`,
    `--concurrency=${fast ? PREVIEW_CONCURRENCY : FINAL_CONCURRENCY}`,
    ...(browser ? [`--browser-executable=${browser}`] : []),
    "--log=error",
  ],
  { cwd: ROOT, stdio: "inherit" },
);
if (result.status !== 0) process.exit(result.status ?? 1);
console.log(`wrote ${output} in ${((Date.now() - started) / 1000).toFixed(1)} s`);
