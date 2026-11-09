// Render settings shared by remotion.config.ts (CLI renders) and scripts/stills.ts (API renders).

// `angle` drives the Mac's GPU. Use `swangle` only on a machine with no GPU.
export const GL = "angle" as const;
export const JPEG_QUALITY = 92;
// One tab is the most repeatable. More tabs are faster but a few frames differ by ~0.05% of pixels.
export const FINAL_CONCURRENCY = 1;
export const PREVIEW_CONCURRENCY = 4;
