// Checks a video's code, then renders sample frames twice in opposite orders to prove each frame stands alone.
// Usage: npm run check-scene <slug> [-- --static]
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { renderStill, selectComposition } from "@remotion/renderer";
import { GL } from "../render-settings";
import { outputDir, requireSlug, ROOT, videoDir } from "./lib/video";
import { guardedBrowser, secureBundle } from "./lib/sandbox";
import { checkSource } from "./lib/sceneChecks";

const SAMPLE_FRAMES = 5;

const args = process.argv.slice(2);
const slug = requireSlug(args.find((a) => !a.startsWith("--")), "npm run check-scene <slug> [-- --static]");
const dir = videoDir(slug);
const relativeDir = path.relative(ROOT, dir).split(path.sep).join("/");
const specPath = path.join(dir, "spec.json");
const kit = existsSync(specPath) ? (JSON.parse(readFileSync(specPath, "utf8")) as { kit?: string }).kit : undefined;

const files = readdirSync(dir).filter((f) => /\.tsx?$/.test(f) && !f.includes(".test."));
const findings = files.flatMap((f) => checkSource(`${relativeDir}/${f}`, readFileSync(path.join(dir, f), "utf8"), { videoDir: relativeDir, kit }));
for (const f of findings) console.log(`FAIL ${f.file}:${f.line} [${f.rule}] ${f.message}`);
console.log(`${findings.length === 0 ? "PASS" : "FAIL"} static checks: ${files.length} files, ${findings.length} problems`);
if (findings.length > 0) process.exit(1);
if (args.includes("--static")) process.exit(0);

const serveUrl = await secureBundle(ROOT);
const browserExecutable = await guardedBrowser(ROOT);
const inputProps = { withAudio: false };
const opts = { serveUrl, inputProps, browserExecutable, chromiumOptions: { gl: GL }, logLevel: "error" as const };
const composition = await selectComposition({ ...opts, id: slug });
const last = composition.durationInFrames - 1;
const frames = [...new Set(Array.from({ length: SAMPLE_FRAMES }, (_, i) => Math.round((i * last) / (SAMPLE_FRAMES - 1))))];

const tempDir = path.join(outputDir(slug), "check");
mkdirSync(tempDir, { recursive: true });
const render = async (order: number[], pass: string) => {
  const hashes = new Map<number, string>();
  for (const frame of order) {
    const output = path.join(tempDir, `${pass}_${frame}.png`);
    await renderStill({ ...opts, composition, frame, output });
    hashes.set(frame, createHash("sha256").update(readFileSync(output)).digest("hex"));
  }
  return hashes;
};
const forwards = await render(frames, "a");
const backwards = await render([...frames].reverse(), "b");
rmSync(tempDir, { recursive: true });

const different = frames.filter((f) => forwards.get(f) !== backwards.get(f));
for (const f of different) console.log(`FAIL frame ${f} differs when rendered in another order`);
console.log(`${different.length === 0 ? "PASS" : "FAIL"} frames stand alone: ${frames.join(", ")}`);
process.exit(different.length === 0 ? 0 : 1);
