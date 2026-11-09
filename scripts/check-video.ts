// Runs every automated check on a video and writes videos/<slug>/output/checks.json for tools to act on.
// Usage: npm run check-video <slug> [-- --quick]
// --quick skips everything that needs a browser.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { AUDIT_PREFIX } from "../src/core/AuditProbe";
import type { Caption } from "../src/core/Captions";
import { REGIONS } from "../src/core/layout";
import { songHits } from "../src/core/music/plan";
import { loadSpec, resolveTime, validateSpec, type VideoSpec } from "../src/core/spec";
import { GL } from "../render-settings";
import { audioLagS, makeAudibleDelay } from "./lib/audible";
import { audioPath, loadMeta, loadSongPlan, outputDir, requireSlug, ROOT, videoDir } from "./lib/episode";
import { dominantShare, readPng } from "./lib/pngDiff";
import { checkSource } from "./lib/sceneChecks";
import { auditLayout, checkCaptionNumbers, checkCaptionTiming, checkHitSync, pickFrames, type AuditReport, type Finding } from "./lib/videoChecks";

const STAND_ALONE_SAMPLES = 5;
/** A subject region this close to one solid colour has nothing in it. */
const EMPTY_SUBJECT_SHARE = 0.985;
const MAX_MP4_LAG_S = 1 / 30;

const args = process.argv.slice(2);
const slug = requireSlug(args.find((a) => !a.startsWith("--")), "npm run check-video <slug> [-- --quick]");
const quick = args.includes("--quick");
const dir = videoDir(slug);
const relativeDir = path.relative(ROOT, dir).split(path.sep).join("/");
const findings: Finding[] = [];
const fail = (check: string, message: string) => findings.push({ check, severity: "error", message });
const step = (name: string, detail: string) => console.log(`${findings.some((f) => f.check.startsWith(name) && f.severity === "error") ? "FAIL" : "PASS"} ${name}: ${detail}`);

let framesChecked: number[] = [];

/** Reports everything found so far and exits. */
const finish = (): never => {
  const errors = findings.filter((f) => f.severity === "error");
  const warnings = findings.filter((f) => f.severity === "warning");
  for (const f of [...errors, ...warnings]) console.log(`${f.severity === "error" ? "ERROR" : "warn "} [${f.check}]${f.frame === undefined ? "" : ` frame ${f.frame}`} ${f.message}`);
  mkdirSync(outputDir(slug), { recursive: true });
  writeFileSync(path.join(outputDir(slug), "checks.json"), `${JSON.stringify({ slug, strict, passed: errors.length === 0, quick, framesChecked, errors: errors.length, warnings: warnings.length, findings }, null, 2)}\n`);
  console.log(`${errors.length === 0 ? "PASSED" : "FAILED"}: ${errors.length} errors, ${warnings.length} warnings${strict ? "" : " (older video: layout problems are warnings)"}`);
  process.exit(errors.length === 0 ? 0 : 1);
};

const specPath = path.join(dir, "spec.json");
const rawSpec: unknown = existsSync(specPath) ? JSON.parse(readFileSync(specPath, "utf8")) : undefined;
let spec: VideoSpec | undefined;
if (rawSpec !== undefined) {
  const errors = validateSpec(rawSpec);
  for (const message of errors) fail("spec", message);
  if (errors.length === 0) spec = loadSpec(rawSpec);
}
// Layout rules are strict for videos built on the song generator. Older videos keep their layout, so they only get warnings.
const strict = spec?.song.generator !== undefined;
step("spec", rawSpec === undefined ? "none" : "validated");

const files = readdirSync(dir).filter((f) => /\.tsx?$/.test(f) && !f.includes(".test."));
for (const f of files) for (const s of checkSource(`${relativeDir}/${f}`, readFileSync(path.join(dir, f), "utf8"), { videoDir: relativeDir, kit: spec?.kit })) findings.push({ check: `code-${s.rule}`, severity: "error", message: `${s.file}:${s.line} ${s.message}` });
step("code", `${files.length} files`);
// Nothing below may run a video's code until the code rules have passed.
if (findings.some((f) => f.check.startsWith("code-"))) finish();

const timelinePath = path.join(dir, "timeline.ts");
const captions = existsSync(timelinePath) ? ((await import(pathToFileURL(timelinePath).href)) as { CAPTIONS?: Caption[] }).CAPTIONS ?? [] : [];
findings.push(...checkCaptionTiming(captions, strict));
step("caption-time", `${captions.length} captions`);
if (spec) findings.push(...checkCaptionNumbers(spec, strict));
step("caption-number", spec ? "traced to the facts" : "no spec");

// ---- Sound ----
const meta = await loadMeta(slug);
const wavPath = audioPath(slug);
if (!existsSync(wavPath)) fail("audio", `${path.relative(ROOT, wavPath)} not found. Run: npm run audio ${slug}`);
else {
  const wav = readFileSync(wavPath);
  const sha = createHash("sha256").update(wav).digest("hex");
  if (spec?.song.lockedWavSha256 && spec.song.lockedWavSha256 !== sha) fail("audio-lock", "the WAV doesn't match the song approved in the spec");
  step("audio-lock", spec?.song.lockedWavSha256 ? "matches the approved song" : "no locked song in the spec");

  const mapPath = path.join(dir, "songMap.ts");
  if (existsSync(mapPath)) {
    const { SONG_MAP } = (await import(pathToFileURL(mapPath).href)) as { SONG_MAP: { wavSha256: string; fps: number; kickFrames: number[]; stabFrames: number[]; impactFrames?: number[] } };
    if (SONG_MAP.wavSha256 !== sha) fail("sync", "songMap.ts was measured from a different WAV. Run: npm run song-map");
    const plan = loadSongPlan(slug);
    const songPath = path.join(dir, "song.ts");
    const hits = plan ? songHits(plan) : existsSync(songPath) ? ((await import(pathToFileURL(songPath).href)) as { KICKS: number[]; STABS?: number[]; IMPACTS?: number[] }) : undefined;
    if (hits) {
      const delayOf = makeAudibleDelay(wav);
      findings.push(...checkHitSync(hits.KICKS, SONG_MAP.kickFrames, delayOf, SONG_MAP.fps, "kick"));
      findings.push(...checkHitSync(hits.STABS ?? [], SONG_MAP.stabFrames, delayOf, SONG_MAP.fps, "stab"));
      findings.push(...checkHitSync(hits.IMPACTS ?? [], SONG_MAP.impactFrames ?? [], delayOf, SONG_MAP.fps, "impact"));
    }
    step("sync", `${SONG_MAP.kickFrames.length} kicks against the WAV`);
  } else step("sync", "no song map");

  const mp4 = path.join(outputDir(slug), `${slug}.mp4`);
  if (existsSync(mp4)) {
    const extract = path.join(outputDir(slug), "check-audio.wav");
    const run = spawnSync("npx", ["remotion", "ffmpeg", "-v", "error", "-y", "-i", mp4, "-vn", "-acodec", "pcm_s16le", "-ar", "48000", "-ac", "2", extract], { cwd: ROOT, encoding: "utf8" });
    if (run.status !== 0 || !existsSync(extract)) fail("mp4-sync", `could not read the MP4's audio: ${run.stderr}`);
    else {
      const lag = audioLagS(wav, readFileSync(extract));
      rmSync(extract);
      if (Math.abs(lag) > MAX_MP4_LAG_S) fail("mp4-sync", `the MP4's audio runs ${(lag * 1000).toFixed(0)} ms off the song`);
      step("mp4-sync", `audio in the MP4 is ${(lag * 1000).toFixed(0)} ms from the song`);
    }
  } else step("mp4-sync", "not rendered yet");
}

// ---- Pictures ----
if (!quick) {
  const durationFrames = Math.round(meta.durationS * meta.fps);
  const shots = spec ? spec.shots.map((s) => ({ from: resolveTime(spec as VideoSpec, s.from), to: resolveTime(spec as VideoSpec, s.to) })) : [];
  framesChecked = pickFrames(durationFrames, meta.fps, captions, shots);

  const tempDir = path.join(outputDir(slug), "check");
  mkdirSync(tempDir, { recursive: true });
  const serveUrl = await bundle({ entryPoint: path.join(ROOT, "src/index.ts"), rootDir: ROOT });
  const base = { serveUrl, chromiumOptions: { gl: GL }, logLevel: "error" as const };
  const inputProps = { withAudio: false, audit: true };
  const composition = await selectComposition({ ...base, inputProps, id: slug });

  const shoot = async (frame: number, file: string) => {
    let report: AuditReport | undefined;
    await renderStill({
      ...base,
      inputProps,
      composition,
      frame,
      output: file,
      onBrowserLog: ({ text }) => {
        const at = text.indexOf(AUDIT_PREFIX);
        if (at >= 0) report = JSON.parse(text.slice(at + AUDIT_PREFIX.length)) as AuditReport;
      },
    });
    return report;
  };

  for (const frame of framesChecked) {
    const file = path.join(tempDir, `a_${frame}.png`);
    const report = await shoot(frame, file);
    if (!report) fail("layout", `frame ${frame} sent no measurements`);
    else findings.push(...auditLayout(report, strict));
    if (strict && dominantShare(readPng(file), REGIONS.subject) >= EMPTY_SUBJECT_SHARE) findings.push({ check: "empty-subject", severity: "error", frame, message: "the subject region is almost one solid colour" });
  }
  step("layout", `${framesChecked.length} frames measured`);
  for (const name of ["overlap", "safe-zone", "off-frame", "clipped-text", "text-collision", "leader-crossing", "leader-target", "empty-subject"]) if (findings.some((f) => f.check === name && f.severity === "error")) step(name, "see above");

  const samples = Array.from({ length: STAND_ALONE_SAMPLES }, (_, i) => framesChecked[Math.round((i * (framesChecked.length - 1)) / (STAND_ALONE_SAMPLES - 1))]);
  const unique = [...new Set(samples)].reverse();
  for (const frame of unique) {
    const again = path.join(tempDir, `b_${frame}.png`);
    await shoot(frame, again);
    const hash = (f: string) => createHash("sha256").update(readFileSync(f)).digest("hex");
    if (hash(again) !== hash(path.join(tempDir, `a_${frame}.png`))) fail("frame-alone", `frame ${frame} differs when rendered in another order`);
  }
  step("frame-alone", `${unique.length} frames rendered twice in opposite orders`);
  rmSync(tempDir, { recursive: true });
}

finish();
