// Camera keys, captions and label windows. Numbers in captions come from physics.
import { makeCameraRig, type CameraKey } from "../../core/camera";
import type { Caption } from "../../core/Captions";
import { fmtInt } from "../../core/math";
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

export const CAPTIONS: Caption[] = [
  { from: 0.3, to: 2.9, lines: ["SAME 8 CYLINDERS.", `SAME ${BANGS_TXT} BANGS A SECOND.`], size: "big", y: 300 },
  { from: 3.2, to: 5.9, lines: ["SO WHY DOES THIS ONE", "SOUND SO DIFFERENT?"], size: "big", y: 300 },
  { from: 6.4, to: 9.2, lines: [`SLOWED DOWN ${SLOW}×`, `${CROSS.label} CRANK`] },
  { from: 9.2, to: 12.4, lines: [`CRANK PINS ${pinSpacingDeg(CROSS)}° APART`, "EACH BANK FIRES UNEVENLY"] },
  { from: 12.8, to: 15.6, lines: [`${FLAT.label} CRANK`, `CRANK PINS ${pinSpacingDeg(FLAT)}° APART`] },
  { from: 15.6, to: 18.8, lines: ["THE BANKS TAKE TURNS:", `EACH FIRES EVERY ${flatGap}°`] },
  { from: 19.3, to: 21.9, lines: [`${CROSS.label}, REAL SPEED`, `BANK GAPS: ${crossGaps}°`] },
  { from: 21.9, to: 24.4, lines: ["UNEVEN GAPS = BURBLE", `LOUDEST BANK NOTE: ${fmtInt(bankToneHz(CROSS, true, SHOW_RPM))} HZ`] },
  { from: 24.8, to: 27.3, lines: [`${FLAT.label}, REAL SPEED`, `EVEN GAPS: ${flatGap}°`] },
  { from: 27.3, to: 29.4, lines: ["EVEN GAPS = SHRIEK", `LOUDEST BANK NOTE: ${fmtInt(bankToneHz(FLAT, true, SHOW_RPM))} HZ`] },
];

export const SHOW_CRANK_LABEL = (t: number) => (t > 6.9 && t < 12.3) || (t > 13.2 && t < 18.8);
export const HUD_IN = 6.05;
export const END_FADE_FROM = 29.5;
