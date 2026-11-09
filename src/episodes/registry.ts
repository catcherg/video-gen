import type { ComponentType } from "react";
import type { EpisodeMeta, EpisodeProps } from "../core/episode";
import { meta as v12 } from "./v12/meta";
import { meta as v8CrossFlat } from "./v8-cross-flat/meta";
import { meta as f1V8 } from "./f1-v8/meta";
// new-episode: imports

export type EpisodeEntry = {
  meta: EpisodeMeta;
  load: () => Promise<{ default: ComponentType<EpisodeProps> }>;
};

// Episodes load lazily, so one episode's physics tables are only built when it is rendered.
export const EPISODES: EpisodeEntry[] = [
  { meta: v12, load: () => import("./v12") },
  { meta: v8CrossFlat, load: () => import("./v8-cross-flat") },
  { meta: f1V8, load: () => import("./f1-v8") },
  // new-episode: entries
];
