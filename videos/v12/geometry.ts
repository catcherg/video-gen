// Engine dimensions and world placement, shared by the scene and the overlay
// so labels project onto exactly where the parts are drawn. Units: 1 = 10 cm.
import * as THREE from "three";
import { smoothstep } from "../../src/core/math";
import { wristDistance } from "../../src/kits/engine/parts/PistonRod";
import { barT, beatT, BANK_ANGLE_DEG, cycleAt, isRightBank, SLOW_START, STROKE_MM } from "./physics";

export const CRANK_R = STROKE_MM / 200;
export const ROD_L = 1.5;
export const PIN_TO_CROWN = 0.32;
export const PISTON_R = 0.44; // slightly under the real 47.5 mm so the piston clears the deck frame
export const PISTON_H = 0.5;
export const CYL_SPACING = 1.12;
export const BANK_SHIFT = 0.28; // left bank is offset along the crank so rods share pins
export const DECK = CRANK_R + ROD_L + PIN_TO_CROWN + 0.08; // crank centre to head face
export const CAM_DIST = DECK + 1.25;
/** Distance along a cylinder axis where its number label sits, just above the coil pack. */
export const CAMS_LABEL_D = CAM_DIST + 1.0;

// Bank axes, angle about +x. Right bank (cyl 1-6) negative, left (7-12) positive.
export const bankAngle = (cyl: number) => (((isRightBank(cyl) ? -BANK_ANGLE_DEG / 2 : BANK_ANGLE_DEG / 2) * Math.PI) / 180);
export const bankDir = (cyl: number) => {
  const b = bankAngle(cyl);
  return new THREE.Vector3(0, Math.cos(b), Math.sin(b));
};
export const cylX = (cyl: number) => {
  const right = isRightBank(cyl);
  const i = right ? cyl - 1 : cyl - 7;
  return (i - 2.5) * CYL_SPACING + (right ? -BANK_SHIFT / 2 : BANK_SHIFT / 2);
};

export const wristDist = (c: number) => wristDistance(c, CRANK_R, ROD_L);

// ---- world placement ----
export const ENGINE_X = 11;
export const ENGINE_REST_Y = 4.6;
export const LIFT = 9.5;
// The engine rises during one bar and drops back during another.
const LIFT_S = barT(1);
const LOWER_FROM = beatT(60);

export const liftAt = (t: number) => {
  if (t < SLOW_START) return 0;
  if (t < SLOW_START + LIFT_S) return LIFT * smoothstep((t - SLOW_START) / LIFT_S);
  if (t < LOWER_FROM) return LIFT;
  if (t < LOWER_FROM + LIFT_S) return LIFT * (1 - smoothstep((t - LOWER_FROM) / LIFT_S));
  return 0;
};
/** The split engine cover folds outward about its hinges, radians. */
export const coverAngleAt = (t: number) => (liftAt(t) / LIFT) * 3.1;

export const engineOrigin = (t: number) => new THREE.Vector3(ENGINE_X, ENGINE_REST_Y + liftAt(t), 0);

/** World position of a point on a cylinder's axis at distance d from the crank. */
export const cylPoint = (cyl: number, d: number, t: number) =>
  engineOrigin(t).add(new THREE.Vector3(cylX(cyl), 0, 0)).add(bankDir(cyl).multiplyScalar(d));

/** World position of a point given in a cylinder's own frame: along the crank, up the bore, across the bore. */
export const cylLocal = (cyl: number, dx: number, y: number, z: number, t: number) => {
  const b = bankAngle(cyl);
  return engineOrigin(t)
    .add(new THREE.Vector3(cylX(cyl) + dx, 0, 0))
    .add(new THREE.Vector3(0, Math.cos(b), Math.sin(b)).multiplyScalar(y))
    .add(new THREE.Vector3(0, -Math.sin(b), Math.cos(b)).multiplyScalar(z));
};

export const crownWorld = (cyl: number, t: number) => cylPoint(cyl, wristDist(cycleAt(cyl, t) % 360) + PIN_TO_CROWN, t);
