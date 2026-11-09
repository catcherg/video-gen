// The pipeline's position, saved after every step so a run can stop for approval and resume later.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export const STAGES = ["facts", "story", "song", "scene", "frames", "render"] as const;
export type Stage = (typeof STAGES)[number];

/** A person must approve these before the next stage runs. */
export const GATES = ["facts", "song", "frames"] as const;
export type Gate = (typeof GATES)[number];

export type Engine = "api" | "claude-code";

export type UsageRecord = { stage: Stage; model: string; inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number; webSearches: number; costUsd: number; seconds: number };

export type PipelineState = {
  slug: string;
  brief: string;
  uploads: string[];
  completed: Partial<Record<Stage, true>>;
  approved: Partial<Record<Gate, true>>;
  /** What a person asked to change when sending a stage back. */
  notes: Partial<Record<Stage, string>>;
  /** Set when the pipeline gave up, with the reason. Revising a stage clears it. */
  blocked?: string;
  usage: UsageRecord[];
  maxUsd: number;
  /** "api" bills an API key. "claude-code" uses the signed-in Claude plan. */
  engine?: Engine;
  /** What the pipeline is doing right now. Only present while a stage is in progress. */
  activity?: Activity;
};

export type Activity = { stage: Stage; detail: string; since: number; pid: number };

/** Whether the process that recorded this activity is still alive. */
export const isRunning = (activity: Activity) => {
  try {
    process.kill(activity.pid, 0);
    return true;
  } catch {
    return false;
  }
};

export type NextStep = { kind: "run"; stage: Stage } | { kind: "wait"; gate: Gate } | { kind: "blocked"; reason: string } | { kind: "done" };

const isGate = (stage: Stage): stage is Gate => (GATES as readonly string[]).includes(stage);

/** What should happen next, from the saved state alone. */
export const nextStep = (state: PipelineState): NextStep => {
  if (state.blocked) return { kind: "blocked", reason: state.blocked };
  for (const stage of STAGES) {
    if (!state.completed[stage]) return { kind: "run", stage };
    if (isGate(stage) && !state.approved[stage]) return { kind: "wait", gate: stage };
  }
  return { kind: "done" };
};

export const newState = (slug: string, brief: string, uploads: string[], maxUsd: number): PipelineState => ({ slug, brief, uploads, completed: {}, approved: {}, notes: {}, usage: [], maxUsd });

/** Records an approval. Only the stage currently waiting can be approved. */
export const approve = (state: PipelineState, gate: Gate): PipelineState => {
  const step = nextStep(state);
  if (step.kind !== "wait" || step.gate !== gate) throw new Error(`"${gate}" isn't waiting for approval`);
  return { ...state, approved: { ...state.approved, [gate]: true } };
};

/** Sends a stage back to be redone, clearing it and everything after it. */
export const revise = (state: PipelineState, stage: Stage, note: string): PipelineState => {
  const from = STAGES.indexOf(stage);
  const completed = { ...state.completed };
  const approved = { ...state.approved };
  for (const later of STAGES.slice(from)) {
    delete completed[later];
    if (isGate(later)) delete approved[later];
  }
  const { blocked: _cleared, ...rest } = state;
  return { ...rest, completed, approved, notes: { ...state.notes, [stage]: note } };
};

export const totalUsd = (state: PipelineState) => state.usage.reduce((sum, u) => sum + u.costUsd, 0);

export const pipelineDir = (root: string, slug: string) => path.join(root, "videos", slug, "output", "pipeline");
const statePath = (root: string, slug: string) => path.join(pipelineDir(root, slug), "state.json");

export const loadState = (root: string, slug: string): PipelineState | undefined => (existsSync(statePath(root, slug)) ? (JSON.parse(readFileSync(statePath(root, slug), "utf8")) as PipelineState) : undefined);

export const saveState = (root: string, state: PipelineState) => {
  mkdirSync(pipelineDir(root, state.slug), { recursive: true });
  writeFileSync(statePath(root, state.slug), `${JSON.stringify(state, null, 2)}\n`);
};
