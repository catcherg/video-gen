// Writes the audio, then the MP4. Usage: npm run render <slug> [-- --fast]
// Default output is byte-reproducible. --fast uses more browser tabs and writes a separate preview file.
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { FINAL_CONCURRENCY, PREVIEW_CONCURRENCY } from "../render-settings";
import { requireSlug, ROOT, writeEpisodeAudio } from "./lib/episode";

const args = process.argv.slice(2);
const fast = args.includes("--fast");
const slug = requireSlug(args.find((a) => !a.startsWith("--")), "npm run render <slug> [-- --fast]");

await writeEpisodeAudio(slug);

mkdirSync(path.join(ROOT, "out"), { recursive: true });
const output = path.join("out", fast ? `${slug}-preview.mp4` : `${slug}.mp4`);
const started = Date.now();
const result = spawnSync(
  "npx",
  [
    "remotion",
    "render",
    "src/index.ts",
    slug,
    output,
    `--props=${JSON.stringify({ withAudio: true })}`,
    `--concurrency=${fast ? PREVIEW_CONCURRENCY : FINAL_CONCURRENCY}`,
    "--log=error",
  ],
  { cwd: ROOT, stdio: "inherit" },
);
if (result.status !== 0) process.exit(result.status ?? 1);
console.log(`wrote ${output} in ${((Date.now() - started) / 1000).toFixed(1)} s`);
