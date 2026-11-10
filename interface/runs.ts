// Starts the same `generate` command a person would type, one video at a time, and reads its saved state for the page.
// There is only one pipeline: the interface never does a stage itself.
import { spawn, spawnSync } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { PALETTES } from "../src/core/palette";
import type { Fact } from "../src/core/spec";
import { approve, GATES, isRunning, loadState, nextStep, pipelineDir, STAGES, totalUsd, type Gate, type PipelineState, type Stage } from "../scripts/pipeline/state";
import { SLUG } from "./guard";
import type { StageView, VideoSummary, VideoView } from "./types";

export type Launch = (args: string[], logFile: string, onExit: (code: number | null) => void) => () => void;

const LOG_LINES = 14;
const DEFAULT_COLORS = ["#ffd84a", "#86f0c2", "#7f83f2", "#ff9ec7", "#6fd3ff"];

export class Busy extends Error {}

/** Every process started by this one, however deep. Remotion puts its browser in its own group, so a group signal misses it. */
export const descendants = (table: string, root: number) => {
  const children = new Map<number, number[]>();
  for (const line of table.trim().split("\n")) {
    const [pid, parent] = line.trim().split(/\s+/).map(Number);
    children.set(parent, [...(children.get(parent) ?? []), pid]);
  }
  const found: number[] = [];
  const visit = (pid: number) => {
    for (const child of children.get(pid) ?? []) {
      found.push(child);
      visit(child);
    }
  };
  visit(root);
  return found;
};

/** Stops a run and everything under it at once. The steps are saved, so nothing needs to shut down gently. */
const killTree = (pid: number) => {
  const table = spawnSync("ps", ["-Ao", "pid=,ppid="], { encoding: "utf8" }).stdout ?? "";
  for (const target of [pid, ...descendants(table, pid)]) {
    try {
      process.kill(target, "SIGKILL");
    } catch {
      // It has already exited.
    }
  }
};

/** Runs generate.ts as a separate process, so its log and its lifetime are its own. */
export const launchGenerate =
  (root: string): Launch =>
  (args, logFile, onExit) => {
    const log = openSync(logFile, "a");
    const child = spawn(process.execPath, ["--import", "tsx", "scripts/generate.ts", ...args], { cwd: root, stdio: ["ignore", log, log], detached: process.platform !== "win32" });
    closeSync(log);
    let finished = false;
    const finish = (code: number | null) => {
      if (!finished) onExit(code);
      finished = true;
    };
    child.on("exit", finish);
    child.on("error", () => finish(1));
    return () => {
      if (!child.pid) return;
      if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"]);
      else killTree(child.pid);
    };
  };

type SpecLike = { title?: string; palette?: unknown };

export const createRuns = (options: { root: string; launch: Launch; fixture?: string }) => {
  const { root, launch, fixture } = options;
  let current: { slug: string; stop: () => void; stopping: boolean } | undefined;
  const failures = new Map<string, string>();

  const dir = (slug: string, ...parts: string[]) => path.join(root, "videos", slug, ...parts);
  const logFile = (slug: string) => path.join(pipelineDir(root, slug), "run.log");
  const mp4 = (slug: string) => dir(slug, "output", `${slug}.mp4`);

  const slugs = () => {
    const videos = path.join(root, "videos");
    return existsSync(videos) ? readdirSync(videos).filter((name) => SLUG.test(name) && statSync(path.join(videos, name)).isDirectory()) : [];
  };

  const exists = (slug: string) => existsSync(dir(slug));

  const runningSlug = () => current?.slug ?? slugs().find((slug) => {
    const activity = loadState(root, slug)?.activity;
    return activity !== undefined && isRunning(activity);
  });

  const readSpec = (slug: string): SpecLike => {
    try {
      return JSON.parse(readFileSync(dir(slug, "spec.json"), "utf8")) as SpecLike;
    } catch {
      return {};
    }
  };

  const colors = (spec: SpecLike) => {
    if (typeof spec.palette === "string" && PALETTES[spec.palette]) return [PALETTES[spec.palette].accent, ...PALETTES[spec.palette].series];
    if (typeof spec.palette === "object" && spec.palette !== null) {
      const { accent, series } = spec.palette as { accent?: string; series?: string[] };
      if (accent && series) return [accent, ...series];
    }
    return DEFAULT_COLORS;
  };

  const lastLines = (slug: string, count: number) => {
    if (!existsSync(logFile(slug))) return [];
    return readFileSync(logFile(slug), "utf8").trimEnd().split("\n").slice(-count);
  };

  /** Launches generate.ts for this video. Only one video runs at once, because they share the code checks and the CPU. */
  const run = (slug: string, args: string[] = []) => {
    const busy = runningSlug();
    if (busy) throw new Busy(`"${busy}" is being worked on. Wait for it to finish or stop it first.`);
    mkdirSync(pipelineDir(root, slug), { recursive: true });
    failures.delete(slug);
    const entry = {
      slug,
      stopping: false,
      stop: launch([slug, ...args, ...(fixture ? ["--fixture", fixture] : [])], logFile(slug), (code) => {
        const stopped = entry.stopping;
        current = undefined;
        if (code === 0 || stopped || loadState(root, slug)?.blocked) return;
        failures.set(slug, lastLines(slug, 3).join(" ").slice(-500) || "The run ended without saying why.");
      }),
    };
    current = entry;
  };

  const stop = (slug: string) => {
    if (current?.slug !== slug) return false;
    current.stopping = true;
    current.stop();
    return true;
  };

  const stopAll = () => {
    if (current) stop(current.slug);
  };

  const phaseOf = (slug: string, state: PipelineState): VideoSummary["phase"] => {
    const step = nextStep(state);
    if (current?.slug === slug) return "working";
    if (state.activity && isRunning(state.activity)) return "working";
    if (step.kind === "wait") return "waiting";
    if (step.kind === "blocked") return "blocked";
    if (step.kind === "done") return "done";
    return "paused";
  };

  const stageViews = (state: PipelineState): StageView[] => {
    const step = nextStep(state);
    const blockedStage = state.blocked?.split(":")[0];
    return STAGES.map((id) => {
      if (blockedStage === id) return { id, state: "blocked" };
      if (step.kind === "wait" && step.gate === id) return { id, state: "waiting" };
      if (state.completed[id]) return { id, state: "done" };
      if (step.kind === "run" && step.stage === id) return { id, state: "current" };
      return { id, state: "todo" };
    });
  };

  const summary = (slug: string): VideoSummary | undefined => {
    const state = loadState(root, slug);
    const spec = readSpec(slug);
    const hasVideo = existsSync(mp4(slug));
    if (!state) return hasVideo ? { slug, title: spec.title ?? slug, phase: "done", hasVideo, progress: STAGES.length, colors: colors(spec) } : undefined;
    const step = nextStep(state);
    const progress = STAGES.filter((stage) => state.completed[stage]).length;
    return { slug, title: spec.title ?? state.brief, phase: phaseOf(slug, state), gate: step.kind === "wait" ? step.gate : undefined, hasVideo, progress, colors: colors(spec) };
  };

  const list = (): VideoSummary[] => {
    const rank = { working: 0, waiting: 1, blocked: 2, paused: 3, done: 4 };
    const when = (slug: string) => statSync(dir(slug)).mtimeMs;
    return slugs()
      .flatMap((slug) => summary(slug) ?? [])
      .sort((a, b) => rank[a.phase] - rank[b.phase] || when(b.slug) - when(a.slug));
  };

  const stills = (slug: string) => {
    try {
      return (JSON.parse(readFileSync(path.join(pipelineDir(root, slug), "review.json"), "utf8")) as string[]).map((file) => path.basename(file)).filter((name) => /^still_\d+\.png$/.test(name));
    } catch {
      return [];
    }
  };

  const detail = (slug: string, now = Date.now()): VideoView | undefined => {
    const base = summary(slug);
    if (!base) return undefined;
    const hasAudio = existsSync(dir(slug, "output", "audio.wav"));
    const state = loadState(root, slug);
    if (!state) return { ...base, stages: STAGES.map((id) => ({ id, state: "done" })), canStop: false, costUsd: 0, maxUsd: 0, hasAudio, log: [] };
    const step = nextStep(state);
    const stageName = state.blocked?.split(":")[0] as Stage | undefined;
    const running = base.phase === "working";
    const view: VideoView = {
      ...base,
      brief: state.brief,
      stages: stageViews(state),
      canStop: current?.slug === slug,
      costUsd: totalUsd(state),
      maxUsd: state.maxUsd,
      engine: state.engine,
      hasAudio,
      log: lastLines(slug, LOG_LINES),
    };
    if (running && state.activity) view.activity = { stage: state.activity.stage, detail: state.activity.detail, seconds: Math.max(0, Math.round((now - state.activity.since) / 1000)) };
    else if (running && step.kind === "run") view.activity = { stage: step.stage, detail: "starting", seconds: 0 };
    if (state.blocked && stageName) view.blocked = { stage: stageName, message: state.blocked.slice(stageName.length + 1).trim(), overBudget: /reaches the \$[\d.]+ limit/.test(state.blocked) };
    if (failures.has(slug)) view.failure = failures.get(slug);
    if (base.gate === "facts" && !running) view.facts = JSON.parse(readFileSync(path.join(pipelineDir(root, slug), "facts.json"), "utf8")) as Fact[];
    if (base.gate === "frames" || base.phase === "done") view.stills = stills(slug);
    return view;
  };

  /** Checks an approval is valid before starting a process to record it. */
  const canApprove = (slug: string, gate: Gate) => {
    const state = loadState(root, slug);
    if (!state || !(GATES as readonly string[]).includes(gate)) return false;
    try {
      approve(state, gate);
      return true;
    } catch {
      return false;
    }
  };

  return { exists, slugs, runningSlug, run, stop, stopAll, list, detail, canApprove };
};

export type Runs = ReturnType<typeof createRuns>;
