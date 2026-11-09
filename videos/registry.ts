import type { ComponentType } from "react";
import type { EpisodeMeta, EpisodeProps } from "../src/core/episode";
import { meta as v12 } from "./v12/meta";
import { meta as v8CrossFlat } from "./v8-cross-flat/meta";
import { meta as f1V8 } from "./f1-v8/meta";
import { meta as skyBlue } from "./sky-blue/meta";
import { meta as vocEconomics } from "./voc-economics/meta";
import { meta as whyCatsPurr } from "./why-cats-purr/meta";
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
  { meta: skyBlue, load: () => import("./sky-blue") },
  { meta: vocEconomics, load: () => import("./voc-economics") },
  { meta: whyCatsPurr, load: () => import("./why-cats-purr") },
  // new-episode: entries
];
