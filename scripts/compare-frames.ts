// Renders every frame and compares it with a saved set, telling real changes apart from render noise.
// Usage: npm run compare-frames <slug> -- --save      save the current frames as the baseline
//        npm run compare-frames <slug>               compare the current code with that baseline
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { outputDir, requireSlug, ROOT } from "./lib/episode";
import { guardedBrowser, secureBundle } from "./lib/sandbox";
import { classifyDiff, diffImages, readPng } from "./lib/pngDiff";

const args = process.argv.slice(2);
const save = args.includes("--save");
const slug = requireSlug(args.find((a) => !a.startsWith("--")), "npm run compare-frames <slug> [-- --save]");
const baseline = path.join(outputDir(slug), "frames-baseline");
const current = path.join(outputDir(slug), "frames-current");

const render = async (target: string) => {
  const serveUrl = await secureBundle(ROOT);
  const browser = await guardedBrowser(ROOT);
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  const result = spawnSync("npx", ["remotion", "render", serveUrl, slug, target, ...(browser ? [`--browser-executable=${browser}`] : []), "--sequence", "--image-format=png", "--concurrency=1", `--props=${JSON.stringify({ withAudio: false })}`, "--log=error"], { cwd: ROOT, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

if (save) {
  await render(baseline);
  console.log(`saved ${readdirSync(baseline).length} frames to ${path.relative(ROOT, baseline)}`);
  process.exit(0);
}
if (!existsSync(baseline)) {
  console.error(`No baseline. Run: npm run compare-frames ${slug} -- --save`);
  process.exit(2);
}

await render(current);
const files = readdirSync(baseline).sort();
const missing = files.filter((f) => !existsSync(path.join(current, f)));
const tally = { identical: 0, noise: 0, changed: 0 };
const changed: string[] = [];
for (const file of files.filter((f) => !missing.includes(f))) {
  const diff = diffImages(readPng(path.join(baseline, file)), readPng(path.join(current, file)));
  const kind = classifyDiff(diff);
  tally[kind]++;
  if (kind === "changed") changed.push(`${file}: ${diff.pixels} px (${(diff.share * 100).toFixed(3)}%), largest change ${diff.maxDelta}`);
}
rmSync(current, { recursive: true });
console.log(`${files.length} frames: ${tally.identical} identical, ${tally.noise} render noise, ${tally.changed} changed, ${missing.length} missing`);
for (const line of changed.slice(0, 40)) console.log(`  ${line}`);
process.exit(tally.changed + missing.length === 0 ? 0 : 1);
