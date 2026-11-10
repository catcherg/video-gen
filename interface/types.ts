// What the server tells the page. Nothing here may ever carry a key, an email address or a sign-in detail.
import type { Fact } from "../src/core/spec";
import type { Engine, Gate, Stage } from "../scripts/pipeline/state";

export type { Engine, Fact, Gate, Stage };

export type Phase = "working" | "paused" | "waiting" | "blocked" | "done";

export type StageView = { id: Stage; state: "done" | "current" | "waiting" | "blocked" | "todo" };

export type VideoSummary = {
  slug: string;
  title: string;
  phase: Phase;
  gate?: Gate;
  hasVideo: boolean;
  /** How far along the stages are, from 0 to 6. */
  progress: number;
  colors: string[];
};

export type VideoView = VideoSummary & {
  brief?: string;
  stages: StageView[];
  activity?: { stage: Stage; detail: string; seconds: number };
  blocked?: { stage: Stage; message: string; overBudget: boolean };
  /** Why the last run ended early, when it wasn't a failure the pipeline recorded itself. */
  failure?: string;
  canStop: boolean;
  costUsd: number;
  maxUsd: number;
  engine?: Engine;
  facts?: Fact[];
  stills?: string[];
  hasAudio: boolean;
  log: string[];
};

export type Graphics = { state: "checking" } | { state: "ready"; mode: "gpu" | "software" } | { state: "failed"; message: string };

export type Setup = {
  plan: "signed-in" | "signed-out" | "not-installed";
  hasKey: boolean;
  graphics: Graphics;
  runningSlug?: string;
};
