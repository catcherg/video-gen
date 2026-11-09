// Camera keys, captions and label windows. Numbers in captions come from physics.
import { makeCameraRig, type CameraKey } from "../../src/core/camera";
import type { Caption } from "../../src/core/Captions";
import { fmtInt } from "../../src/core/math";
import { resolveCaptions } from "../../src/core/spec";
import { spec } from "./meta";
import { bangsPerSecond, bankGapsDeg, bankToneHz, CROSS, FLAT, pinSpacingDeg, SHOW_RPM, SLOW } from "./physics";

const TARGET: [number, number, number] = [0, 3.2, 0];

const KEYS: CameraKey[] = [
  // hook: wide three-quarter view of each engine
  { t: 0, pos: [10, 7, 12], target: TARGET, fov: 40 },
  { t: 5.9, pos: [8, 7, 13.5], target: TARGET, fov: 40 },
  // end-on down the crank, where the pin layout is visible: cross-plane, then flat-plane
  { t: 6.9, pos: [-13, 4.5, 2.5], target: TARGET, fov: 40, via: [-6, 10, 12] },
  { t: 12.4, pos: [-13, 4.5, 1.5], target: TARGET, fov: 40 },
  { t: 13.2, pos: [-13, 4.5, -1.5], target: TARGET, fov: 40 },
  { t: 18.9, pos: [-13, 4.5, -2.5], target: TARGET, fov: 40 },
  // back to real speed, each engine again
  { t: 20, pos: [10, 7, -12], target: TARGET, fov: 40, via: [-6, 10, -12] },
  { t: 24.4, pos: [10, 7, -13], target: TARGET, fov: 40 },
  { t: 25.2, pos: [10, 7, 13], target: TARGET, fov: 40 },
  { t: 30, pos: [8, 8, 13], target: TARGET, fov: 40 },
];

export const cameraAt = makeCameraRig(KEYS);

const BANGS_TXT = fmtInt(bangsPerSecond(SHOW_RPM));
const crossGaps = bankGapsDeg(CROSS, true).join("-");
const flatGap = bankGapsDeg(FLAT, true)[0];

export const CAPTIONS: Caption[] = resolveCaptions(spec, {
  bangs: BANGS_TXT,
  slow: SLOW,
  crossLabel: CROSS.label,
  flatLabel: FLAT.label,
  crossPins: pinSpacingDeg(CROSS),
  flatPins: pinSpacingDeg(FLAT),
  flatGap,
  crossGaps,
  crossTone: fmtInt(bankToneHz(CROSS, true, SHOW_RPM)),
  flatTone: fmtInt(bankToneHz(FLAT, true, SHOW_RPM)),
});

export const SHOW_CRANK_LABEL = (t: number) => (t > 6.9 && t < 12.3) || (t > 13.2 && t < 18.8);
export const HUD_IN = 6.05;
export const END_FADE_FROM = 29.5;
