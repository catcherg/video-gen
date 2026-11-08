// Engine geometry and world placement, shared by the 3D scene and the 2D overlay
// (so labels can be projected onto exactly where the parts are drawn).
import * as THREE from "three";
import { cycleAt } from "./physics";

// Units: 1 = 10 cm.
export const CRANK_R = 0.382; // half the 76.4 mm stroke
export const ROD_L = 1.5;
export const PIN_TO_CROWN = 0.32;
export const PISTON_R = 0.44;
export const PISTON_H = 0.5;
export const CYL_SPACING = 1.12;
export const BANK_SHIFT = 0.28; // left bank is offset along the crank so rods share pins
export const DECK = CRANK_R + ROD_L + PIN_TO_CROWN + 0.08; // distance crank -> head face
export const CAM_DIST = DECK + 1.25;

// Bank axes, angle about +x. Right bank (cyl 1-6) at -30°, left (7-12) at +30°.
export const bankAngle = (cyl: number) => ((cyl <= 6 ? -30 : 30) * Math.PI) / 180;
export const bankDir = (cyl: number) => {
  const b = bankAngle(cyl);
  return new THREE.Vector3(0, Math.cos(b), Math.sin(b));
};
export const cylX = (cyl: number) => {
  const i = cyl <= 6 ? cyl - 1 : cyl - 7;
  return (i - 2.5) * CYL_SPACING + (cyl <= 6 ? -BANK_SHIFT / 2 : BANK_SHIFT / 2);
};

/** Distance from crank centre to wrist pin for a piston at cycle angle c (deg). */
export const wristDist = (c: number) => {
  const th = (c * Math.PI) / 180;
  const s = Math.sin(th);
  return CRANK_R * Math.cos(th) + Math.sqrt(ROD_L * ROD_L - CRANK_R * CRANK_R * s * s);
};

// ---- world placement ----
export const ENGINE_X = 11;
export const ENGINE_REST_Y = 4.6;
export const LIFT = 9.5;

const smooth = (x: number) => {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
};
export const liftAt = (t: number) => {
  if (t < 3.0) return 0;
  if (t < 4.6) return LIFT * smooth((t - 3.0) / 1.6);
  if (t < 24.0) return LIFT;
  if (t < 26.4) return LIFT * (1 - smooth((t - 24.0) / 2.4));
  return 0;
};
export const coverAngleAt = (t: number) => (liftAt(t) / LIFT) * 1.15; // radians

export const engineOrigin = (t: number) => new THREE.Vector3(ENGINE_X, ENGINE_REST_Y + liftAt(t), 0);

/** World position of a point on cylinder `cyl`'s axis at distance d from the crank. */
export const cylPoint = (cyl: number, d: number, t: number) =>
  engineOrigin(t).add(new THREE.Vector3(cylX(cyl), 0, 0)).add(bankDir(cyl).multiplyScalar(d));

export const crownWorld = (cyl: number, t: number) =>
  cylPoint(cyl, wristDist(cycleAt(cyl, t) % 360) + PIN_TO_CROWN, t);

/** Distance along a cylinder axis where its number label sits (just above the coil pack). */
export const CAMS_LABEL_D = CAM_DIST + 1.0;
