import type { ComponentType } from "react";
import type { EpisodeMeta, EpisodeProps } from "../core/episode";
import { meta as v12 } from "./v12/meta";

export type EpisodeEntry = {
  meta: EpisodeMeta;
  load: () => Promise<{ default: ComponentType<EpisodeProps> }>;
};

// Episodes load lazily, so one episode's physics tables are only built when it is rendered.
export const EPISODES: EpisodeEntry[] = [
  { meta: v12, load: () => import("./v12") },
];
