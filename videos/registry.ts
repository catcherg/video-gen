import type { ComponentType } from "react";
import type { VideoMeta, VideoProps } from "../src/core/video";
import { meta as v12 } from "./v12/meta";
import { meta as v8CrossFlat } from "./v8-cross-flat/meta";
import { meta as f1V8 } from "./f1-v8/meta";
import { meta as skyBlue } from "./sky-blue/meta";
import { meta as vocEconomics } from "./voc-economics/meta";
import { meta as whyCatsPurr } from "./why-cats-purr/meta";
// new-video: imports

export type VideoEntry = {
  meta: VideoMeta;
  load: () => Promise<{ default: ComponentType<VideoProps> }>;
};

// Videos load lazily, so one video's physics tables are only built when it is rendered.
export const VIDEOS: VideoEntry[] = [
  { meta: v12, load: () => import("./v12") },
  { meta: v8CrossFlat, load: () => import("./v8-cross-flat") },
  { meta: f1V8, load: () => import("./f1-v8") },
  { meta: skyBlue, load: () => import("./sky-blue") },
  { meta: vocEconomics, load: () => import("./voc-economics") },
  { meta: whyCatsPurr, load: () => import("./why-cats-purr") },
  // new-video: entries
];
