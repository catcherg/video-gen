// Makes a video from a description and uploads, stopping for a person to approve the facts, song and frames.
//
//   npm run generate -- <slug> --brief "What the video is about" [--upload file]... [--max-usd 10]
//   npm run generate -- <slug>                                 continue after an approval
//   npm run generate -- <slug> --approve facts|song|frames     approve what's waiting and continue
//   npm run generate -- <slug> --revise facts|story|song|scene --note "What to change"
//   npm run generate -- <slug> --status
//   npm run generate -- <slug> --fixture answers.json          use scripted answers instead of Claude (no cost)
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { planSong, songHits } from "../src/core/music/plan";
import { encodeWav } from "../src/core/audio";
import { renderSong } from "../src/core/music/render";
import { audioPath, loadSongPlan, outputDir, ROOT, videoDir, writeEpisodeAudio } from "./lib/episode";
import { analyseSong, songProblems } from "./lib/songAnalysis";
import { createAnthropicClient, createScriptedClient, type ModelClient } from "./pipeline/model";
import { runPipeline, type CheckResult, type Deps } from "./pipeline/run";
import { approve, GATES, loadState, newState, nextStep, pipelineDir, revise, saveState, STAGES, totalUsd, type Gate, type PipelineState, type Stage } from "./pipeline/state";

const SLUG = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const DEFAULT_MAX_USD = 10;
const IMPORT_MARK = "// new-episode: imports";
const ENTRY_MARK = "  // new-episode: entries";

const args = process.argv.slice(2);
const option = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const options = (name: string) => args.flatMap((a, i) => (a === `--${name}` ? [args[i + 1]] : []));
const VALUE_FLAGS = new Set(["brief", "upload", "max-usd", "approve", "revise", "note", "fixture"]);
const slug = args.find((a, i) => !a.startsWith("--") && !(i > 0 && VALUE_FLAGS.has(args[i - 1].slice(2))));

const stop = (message: string): never => {
  console.error(message);
  process.exit(2);
};

if (!slug || !SLUG.test(slug)) stop('Usage: npm run generate -- <slug> --brief "What the video is about" [--upload file]');
const id = slug as string;

const run = (command: string, commandArgs: string[]) => spawnSync(command, commandArgs, { cwd: ROOT, encoding: "utf8" });

const registryPath = path.join(ROOT, "videos/registry.ts");
const identifier = (s: string) => s.split("-").map((w, i) => (i === 0 ? w : w[0].toUpperCase() + w.slice(1))).join("");

const importLine = (s: string) => `import { meta as ${identifier(s)} } from "./${s}/meta";\n`;
const entryLine = (s: string) => `  { meta: ${identifier(s)}, load: () => import("./${s}") },\n`;

const readCheck = (s: string): CheckResult => {
  const file = path.join(outputDir(s), "checks.json");
  const parsed = JSON.parse(readFileSync(file, "utf8")) as { passed: boolean; findings: { severity: string; check: string; frame?: number; message: string }[] };
  return { passed: parsed.passed, problems: parsed.findings.filter((f) => f.severity === "error").map((f) => `[${f.check}]${f.frame === undefined ? "" : ` frame ${f.frame}`} ${f.message}`) };
};

const runCheck = (s: string): CheckResult => {
  const result = run("npm", ["run", "--silent", "check-video", s]);
  if (!existsSync(path.join(outputDir(s), "checks.json")) || (result.status !== 0 && !result.stdout.includes("FAILED"))) return { passed: false, problems: [`The video crashed while being checked: ${(result.stderr || result.stdout).slice(-1500)}`] };
  return readCheck(s);
};

const realDeps = (model: ModelClient): Deps => ({
  root: ROOT,
  model,
  log: (line) => console.log(line),
  now: () => Date.now(),
  makeSong: async (s) => {
    await writeEpisodeAudio(s);
    const map = run("npm", ["run", "--silent", "song-map", s]);
    if (map.status !== 0) return [`song-map failed: ${map.stderr}`];
    const plan = loadSongPlan(s);
    if (!plan) return ["the spec has no song generator"];
    const hits = songHits(planSong({ style: plan.style, seed: plan.seed, fps: plan.fps, framesPerBeat: Math.round(plan.beatS * plan.fps), bars: plan.bars, rootMidi: plan.rootMidi, sections: plan.sections.map(({ kind, bars }) => ({ kind, bars })) }));
    return songProblems(analyseSong(encodeWav(renderSong(plan)), hits.KICKS, hits.IMPACTS));
  },
  typecheck: async (s) => {
    const result = run("npm", ["run", "--silent", "typecheck"]);
    return result.status === 0 ? [] : `${result.stdout}${result.stderr}`.split("\n").filter((line) => line.includes(`videos/${s}/`)).slice(0, 40);
  },
  register: (s) => {
    let text = readFileSync(registryPath, "utf8");
    if (text.includes(`"./${s}/meta"`)) return;
    text = text.replace(IMPORT_MARK, `${importLine(s)}${IMPORT_MARK}`).replace(ENTRY_MARK, `${entryLine(s)}${ENTRY_MARK}`);
    writeRegistry(text);
  },
  unregister: (s) => writeRegistry(readFileSync(registryPath, "utf8").replace(importLine(s), "").replace(entryLine(s), "")),
  checkVideo: async (s) => runCheck(s),
  renderReview: async (s) => {
    const spec = JSON.parse(readFileSync(path.join(videoDir(s), "spec.json"), "utf8")) as { shots: { from: { bar: number }; to: { bar: number } }[]; song: { bpm: number; beatsPerBar: number }; format: { fps: number } };
    const frames = spec.shots.map((shot) => Math.round((((shot.from.bar + shot.to.bar) / 2) * spec.song.beatsPerBar * 60 * spec.format.fps) / spec.song.bpm));
    const result = run("npm", ["run", "--silent", "stills", s, ...frames.map(String)]);
    if (result.status !== 0) throw new Error(`rendering review frames failed: ${result.stderr}`);
    return result.stdout.trim().split("\n");
  },
  renderFinal: async (s) => {
    const result = run("npm", ["run", "--silent", "render", s]);
    if (result.status !== 0) return { passed: false, problems: [`render failed: ${result.stderr.slice(-800)}`] };
    return runCheck(s);
  },
  wavHash: (s) => createHash("sha256").update(readFileSync(audioPath(s))).digest("hex"),
});

const writeRegistry = (text: string) => writeFileSync(registryPath, text);

const report = (state: PipelineState) => {
  const seconds = state.usage.reduce((sum, u) => sum + u.seconds, 0);
  console.log(`\nSpent so far: $${totalUsd(state).toFixed(2)} of the $${state.maxUsd.toFixed(2)} limit, ${state.usage.length} model calls, ${seconds.toFixed(0)} s of model time`);
  for (const stage of STAGES) {
    const records = state.usage.filter((u) => u.stage === stage);
    if (records.length > 0) console.log(`  ${stage}: $${records.reduce((s, u) => s + u.costUsd, 0).toFixed(2)}, ${records.length} calls`);
  }
  const step = nextStep(state);
  if (step.kind === "wait") {
    const where = { facts: `videos/${id}/output/pipeline/facts.json`, song: `videos/${id}/output/audio.wav`, frames: `videos/${id}/output/stills/` }[step.gate];
    console.log(`\nWaiting for you to review the ${step.gate}: ${where}`);
    console.log(`Approve:  npm run generate -- ${id} --approve ${step.gate}`);
    console.log(`Change:   npm run generate -- ${id} --revise ${step.gate === "frames" ? "scene" : step.gate} --note "What to change"`);
  } else if (step.kind === "blocked") console.log(`\nStopped. ${step.reason}\nTo try again: npm run generate -- ${id} --revise <stage> --note "What to change"`);
  else if (step.kind === "done") console.log(`\nFinished: videos/${id}/output/${id}.mp4`);
};

let state = loadState(ROOT, id);

if (!state) {
  const brief = option("brief");
  if (!brief) stop(`No run found for "${id}". Start one with --brief "What the video is about".`);
  if (existsSync(videoDir(id))) stop(`videos/${id} already exists. Choose another slug.`);
  const uploads = options("upload");
  for (const file of uploads) if (!existsSync(file)) stop(`Upload not found: ${file}`);
  const maxUsd = Number(option("max-usd") ?? DEFAULT_MAX_USD);
  if (!Number.isFinite(maxUsd) || maxUsd <= 0) stop("--max-usd must be a positive number.");
  state = newState(id, brief as string, uploads.map((f) => path.basename(f)), maxUsd);
  mkdirSync(path.join(pipelineDir(ROOT, id), "uploads"), { recursive: true });
  for (const file of uploads) copyFileSync(file, path.join(pipelineDir(ROOT, id), "uploads", path.basename(file)));
  saveState(ROOT, state);
}

if (args.includes("--status")) {
  report(state);
  process.exit(0);
}

const toApprove = option("approve");
if (toApprove) {
  if (!(GATES as readonly string[]).includes(toApprove)) stop(`--approve must be one of ${GATES.join(", ")}`);
  try {
    state = approve(state, toApprove as Gate);
  } catch (err) {
    stop((err as Error).message);
  }
}

const toRevise = option("revise");
if (toRevise) {
  if (!(STAGES as readonly string[]).includes(toRevise)) stop(`--revise must be one of ${STAGES.join(", ")}`);
  state = revise(state, toRevise as Stage, option("note") ?? "");
}

const fixture = option("fixture");
const model = fixture ? createScriptedClient(JSON.parse(readFileSync(fixture, "utf8")) as unknown[]) : createAnthropicClient();

state = await runPipeline(realDeps(model), state);
report(state);
process.exit(nextStep(state).kind === "blocked" ? 1 : 0);
