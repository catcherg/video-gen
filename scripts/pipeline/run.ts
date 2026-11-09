// Runs the stages in order until one needs a person, fails for good, or the video is finished.
// Real side effects are passed in as Deps, so all of this logic can be tested without a browser or a bill.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Fact, VideoSpec } from "../../src/core/spec";
import { checkSource } from "../lib/sceneChecks";
import { assembleSpec, factProblems, storyProblems, toFact, type RawFact, type Story } from "./assemble";
import { costOf, MODEL, type ModelClient, type ModelRequest, type ModelResult, type Turn, type Upload } from "./model";
import { FACTS_SCHEMA, FACTS_SYSTEM, SCENE_SCHEMA, SCENE_SYSTEM, sceneReference, STORY_SCHEMA, STORY_SYSTEM } from "./prompts";
import { nextStep, pipelineDir, saveState, totalUsd, type PipelineState, type Stage } from "./state";

const MAX_ATTEMPTS: Record<"facts" | "story" | "scene", number> = { facts: 3, story: 3, scene: 4 };
const MAX_SEED_TRIES = 5;
const HEARTBEAT_MS = 30000;
const FILES = { physics: "physics.ts", timeline: "timeline.ts", scene: "scene.tsx" } as const;

export type CheckResult = { passed: boolean; problems: string[] };

export type Deps = {
  root: string;
  model: ModelClient;
  log: (line: string) => void;
  now: () => number;
  /** Writes the WAV and song map, and reports any measured problems with the song. */
  makeSong: (slug: string) => Promise<string[]>;
  typecheck: (slug: string) => Promise<string[]>;
  register: (slug: string) => void;
  unregister: (slug: string) => void;
  checkVideo: (slug: string) => Promise<CheckResult>;
  renderReview: (slug: string) => Promise<string[]>;
  renderFinal: (slug: string) => Promise<CheckResult>;
  /** The song's WAV hash, recorded in the spec once it's approved. */
  wavHash: (slug: string) => string;
};

export const videoPath = (root: string, slug: string, ...parts: string[]) => path.join(root, "videos", slug, ...parts);

class BudgetExceeded extends Error {}

const readUploads = (root: string, state: PipelineState): Upload[] =>
  state.uploads.map((name) => {
    const bytes = readFileSync(path.join(pipelineDir(root, state.slug), "uploads", name));
    return name.toLowerCase().endsWith(".pdf") ? { name, mediaType: "application/pdf", data: bytes.toString("base64") } : { name, mediaType: "text/plain", data: bytes.toString("utf8") };
  });

const artifact = (root: string, slug: string, name: string) => path.join(pipelineDir(root, slug), name);
const readJson = <T,>(file: string) => JSON.parse(readFileSync(file, "utf8")) as T;
const writeJson = (file: string, value: unknown) => {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
};

const withNote = (text: string, note?: string) => (note ? `${text}\n\nThe person reviewing this asked for these changes: ${note}` : text);

/** Says what's happening now, on screen and in the saved state, so a long stage never looks frozen. */
const setActivity = (deps: Deps, state: PipelineState, stage: Stage, detail: string) => {
  state.activity = { stage, detail, since: deps.now(), pid: process.pid };
  saveState(deps.root, state);
  deps.log(`${stage}: ${detail}`);
};

const formatElapsed = (ms: number) => `${Math.floor(ms / 60000)}m ${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}s`;

/** Calls the model, stopping first if the budget is spent, and records the cost and time of every call. */
const ask = async (deps: Deps, state: PipelineState, stage: Stage, request: ModelRequest, detail: string): Promise<ModelResult> => {
  if (totalUsd(state) >= state.maxUsd) throw new BudgetExceeded(`spent $${totalUsd(state).toFixed(2)}, which reaches the $${state.maxUsd.toFixed(2)} limit`);
  setActivity(deps, state, stage, detail);
  const started = deps.now();
  const heartbeat = setInterval(() => deps.log(`${stage}: still waiting on the model (${formatElapsed(deps.now() - started)})`), HEARTBEAT_MS);
  const result = await deps.model.ask(request).finally(() => clearInterval(heartbeat));
  deps.log(`${stage}: the model answered after ${formatElapsed(deps.now() - started)}`);
  state.usage.push({ stage, model: MODEL, ...result.usage, costUsd: result.costUsd ?? costOf(result.usage), seconds: (deps.now() - started) / 1000 });
  saveState(deps.root, state);
  return result;
};

/** Asks, checks the answer and asks again with the problems, keeping one growing conversation. */
const askUntilValid = async <T,>(deps: Deps, state: PipelineState, stage: "facts" | "story", request: Omit<ModelRequest, "turns">, first: string, validate: (value: T, result: ModelResult) => string[]): Promise<T> => {
  const turns: Turn[] = [{ role: "user", text: first }];
  let problems: string[] = [];
  for (let attempt = 1; attempt <= MAX_ATTEMPTS[stage]; attempt++) {
    const result = await ask(deps, state, stage, { ...request, turns: [...turns] }, `attempt ${attempt} of ${MAX_ATTEMPTS[stage]}: waiting on the model`);
    const value = result.json as T;
    problems = validate(value, result);
    if (problems.length === 0) return value;
    deps.log(`${stage}: attempt ${attempt} had ${problems.length} problems`);
    turns.push({ role: "assistant", content: result.content }, { role: "user", text: `Fix these problems and answer again in full:\n${problems.map((p) => `- ${p}`).join("\n")}` });
  }
  throw new Error(`${stage} still had problems after ${MAX_ATTEMPTS[stage]} attempts: ${problems.slice(0, 5).join("; ")}`);
};

const runFacts = async (deps: Deps, state: PipelineState) => {
  const raw = await askUntilValid<{ facts: RawFact[] }>(
    deps,
    state,
    "facts",
    { system: FACTS_SYSTEM, uploads: readUploads(deps.root, state), schema: FACTS_SCHEMA, webSearch: true, effort: "high" },
    withNote(`The video is about: ${state.brief}`, state.notes.facts),
    (value, result) => factProblems(value.facts, state.uploads, result.seenUrls),
  );
  writeJson(artifact(deps.root, state.slug, "facts.json"), raw.facts.map(toFact));
};

const copyTemplates = (root: string, slug: string) => {
  for (const file of ["meta.ts", "index.tsx", "overlay.tsx"]) writeFileSync(videoPath(root, slug, file), readFileSync(path.join(root, "templates/video", `${file}.tmpl`), "utf8"));
};

const runStory = async (deps: Deps, state: PipelineState) => {
  const facts = readJson<Fact[]>(artifact(deps.root, state.slug, "facts.json"));
  const story = await askUntilValid<Story>(
    deps,
    state,
    "story",
    { system: STORY_SYSTEM, schema: STORY_SCHEMA, effort: "high" },
    withNote(`The video is about: ${state.brief}\n\nApproved facts:\n${JSON.stringify(facts, null, 1)}`, state.notes.story),
    (value) => storyProblems(assembleSpec(state.slug, value, facts)),
  );
  mkdirSync(videoPath(deps.root, state.slug), { recursive: true });
  writeJson(videoPath(deps.root, state.slug, "spec.json"), assembleSpec(state.slug, story, facts));
  copyTemplates(deps.root, state.slug);
};

const specFile = (deps: Deps, slug: string) => videoPath(deps.root, slug, "spec.json");

/** Tries neighbouring seeds until a song passes its measurements. Only a person decides whether it's any good. */
const runSong = async (deps: Deps, state: PipelineState) => {
  const spec = readJson<VideoSpec>(specFile(deps, state.slug));
  const generator = spec.song.generator;
  if (!generator) throw new Error("the spec has no song generator");
  let problems: string[] = [];
  for (let i = 0; i < MAX_SEED_TRIES; i++) {
    setActivity(deps, state, "song", `generating and measuring seed ${generator.seed}`);
    problems = await deps.makeSong(state.slug);
    if (problems.length === 0) return;
    deps.log(`song: seed ${generator.seed} failed its measurements: ${problems.join("; ")}`);
    generator.seed += 1;
    writeJson(specFile(deps, state.slug), spec);
  }
  throw new Error(`no song passed its measurements after ${MAX_SEED_TRIES} seeds: ${problems.join("; ")}`);
};

const lockApprovedSong = (deps: Deps, state: PipelineState) => {
  const spec = readJson<VideoSpec>(specFile(deps, state.slug));
  spec.song.lockedWavSha256 = deps.wavHash(state.slug);
  writeJson(specFile(deps, state.slug), spec);
};

/** Code rules are always checked before any generated code runs. */
const staticProblems = (root: string, slug: string, files: Record<string, string>) =>
  Object.entries(files).flatMap(([file, source]) => checkSource(`videos/${slug}/${file}`, source, { videoDir: `videos/${slug}`, kit: "none" }).map((f) => `${file}:${f.line} [${f.rule}] ${f.message}`));

const quarantine = (root: string, slug: string) => {
  for (const file of Object.values(FILES)) {
    const from = videoPath(root, slug, file);
    if (existsSync(from)) renameSync(from, `${from}.rejected`);
  }
};

const runScene = async (deps: Deps, state: PipelineState) => {
  const { root } = deps;
  const { slug } = state;
  const spec = readFileSync(specFile(deps, slug), "utf8");
  const turns: Turn[] = [{ role: "user", text: withNote(`Write the three files for this video. Its slug is "${slug}".\n\nThe spec:\n${spec}`, state.notes.scene) }];
  let problems: string[] = [];
  for (let attempt = 1; attempt <= MAX_ATTEMPTS.scene; attempt++) {
    const label = `attempt ${attempt} of ${MAX_ATTEMPTS.scene}`;
    const result = await ask(deps, state, "scene", { system: SCENE_SYSTEM, reference: sceneReference(root), schema: SCENE_SCHEMA, effort: "xhigh", turns: [...turns] }, `${label}: waiting on the model, which can take over 15 minutes`);
    const answer = result.json as Record<keyof typeof FILES, string>;
    const files = Object.fromEntries((Object.keys(FILES) as (keyof typeof FILES)[]).map((key) => [FILES[key], answer[key]]));

    // Nothing is written to disk, and nothing runs, until the static rules pass.
    problems = staticProblems(root, slug, files);
    if (problems.length === 0) {
      for (const [file, source] of Object.entries(files)) writeFileSync(videoPath(root, slug, file), source);
      setActivity(deps, state, "scene", `${label}: typechecking the code`);
      problems = await deps.typecheck(slug);
    }
    if (problems.length === 0) {
      deps.register(slug);
      setActivity(deps, state, "scene", `${label}: running the full checks, about a minute`);
      const check = await deps.checkVideo(slug);
      if (check.passed) return;
      problems = check.problems;
    }
    deps.log(`scene: attempt ${attempt} had ${problems.length} problems`);
    turns.push({ role: "assistant", content: result.content }, { role: "user", text: `The automated checks found these problems. Fix all of them and return all three files in full:\n${problems.map((p) => `- ${p}`).join("\n")}` });
  }
  deps.unregister(slug);
  quarantine(root, slug);
  throw new Error(`scene still failed after ${MAX_ATTEMPTS.scene} attempts: ${problems.slice(0, 5).join("; ")}`);
};

const runStage = async (deps: Deps, state: PipelineState, stage: Stage) => {
  if (stage === "facts") return runFacts(deps, state);
  if (stage === "story") return runStory(deps, state);
  if (stage === "song") return runSong(deps, state);
  if (stage === "scene") return runScene(deps, state);
  if (stage === "frames") {
    setActivity(deps, state, "frames", "rendering a frame from each shot");
    const stills = await deps.renderReview(state.slug);
    writeJson(artifact(deps.root, state.slug, "review.json"), stills);
    return;
  }
  setActivity(deps, state, "render", "rendering the final video and checking it, a few minutes");
  const result = await deps.renderFinal(state.slug);
  if (!result.passed) throw new Error(`the final video failed its checks: ${result.problems.slice(0, 5).join("; ")}`);
};

/** Advances as far as it can, saving after every stage. Returns the state it stopped in. */
export const runPipeline = async (deps: Deps, state: PipelineState): Promise<PipelineState> => {
  saveState(deps.root, state);
  for (;;) {
    const step = nextStep(state);
    if (step.kind !== "run") return state;
    if (step.stage === "scene" && state.approved.song) lockApprovedSong(deps, state);
    deps.log(`running: ${step.stage}`);
    try {
      await runStage(deps, state, step.stage);
    } catch (err) {
      state.blocked = `${step.stage}: ${(err as Error).message}`;
      delete state.activity;
      saveState(deps.root, state);
      return state;
    }
    delete state.activity;
    state.completed[step.stage] = true;
    saveState(deps.root, state);
  }
};
