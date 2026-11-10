// Render settings shared by remotion.config.ts (CLI renders) and scripts/stills.ts (API renders).

import { readFileSync } from "node:fs";
import path from "node:path";

type GlMode = "angle" | "swangle";

// `angle` drives this computer's GPU. `swangle` draws in software, for a computer with no usable GPU.
// `npm start` tests which one works and saves the answer. VIDEO_GEN_GL overrides it.
const chooseGl = (): GlMode => {
  const forced = process.env.VIDEO_GEN_GL;
  if (forced === "angle" || forced === "swangle") return forced;
  try {
    const saved = JSON.parse(readFileSync(path.join(process.cwd(), "out/graphics.json"), "utf8")) as { platform?: string; gl?: GlMode };
    if (saved.platform === process.platform && (saved.gl === "angle" || saved.gl === "swangle")) return saved.gl;
  } catch {
    // Not checked on this computer yet.
  }
  return process.platform === "linux" ? "swangle" : "angle";
};

export const GL = chooseGl();
export const JPEG_QUALITY = 92;
// One tab is the most repeatable. More tabs are faster but a few frames differ by ~0.05% of pixels.
export const FINAL_CONCURRENCY = 1;
export const PREVIEW_CONCURRENCY = 4;
