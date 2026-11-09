// Engine dimensions and world placement, shared by the scene and the overlay
// so labels project onto exactly where the parts are drawn. Units: 1 = 10 cm.
// Bore, stroke, bore pitch, crank height and valve sizes are real. Rod length and head
// layout are illustrative, since the papers do not publish them.
import * as THREE from "three";
import { smoothstep } from "../../core/math";
import { VALVE_STACK, type GearDef } from "../../parts/F1Head";
import { OPEN_WHEELER } from "../../parts/cars/OpenWheeler";
import { wristDistance } from "../../parts/PistonRod";
import { barT, beatT, BANK_ANGLE_DEG, BORE_MM, BORE_PITCH_MM, CRANK_HEIGHT_MM, cycleAt, DROP, EXHAUST_LIFT_MM, EXHAUST_VALVE_MM, INTAKE_LIFT_MM, INTAKE_VALVE_MM, isBankA, STROKE_MM } from "./physics";
import { KICKS } from "./song";

export const CRANK_R = STROKE_MM / 200;
export const ROD_L = 1.05;
export const PIN_TO_CROWN = 0.2;
export const PISTON_R = BORE_MM / 200 - 0.03;
export const PISTON_H = 0.32;
export const CYL_SPACING = BORE_PITCH_MM / 100;
export const BANK_SHIFT = 0.22;
export const DECK = CRANK_R + ROD_L + PIN_TO_CROWN + 0.05;

export const INTAKE_HEAD_R = INTAKE_VALVE_MM / 200;
export const EXHAUST_HEAD_R = EXHAUST_VALVE_MM / 200;
export const INTAKE_LIFT = INTAKE_LIFT_MM / 100;
export const EXHAUST_LIFT = EXHAUST_LIFT_MM / 100;
export const VALVE_DX = 0.235;
export const VALVE_TILT = (12 * Math.PI) / 180;
export const CAM_Z = 0.44;

// The gear train, as tooth counts. The cam gear has twice the crank gear's teeth, so cams turn at
// half crank speed. Six meshes keep the cams turning the same way as the crank.
const MODULE_R = 0.17 / 14;
const CRANK_T = 14;
const IDLER_T = 22;
const HEAD_IDLER_T = 14;
const CAM_T = 2 * CRANK_T;
const rOf = (teeth: number) => teeth * MODULE_R;
const IDLERS = 4;
const headIdlerD = rOf(CRANK_T) + 2 * IDLERS * rOf(IDLER_T) + rOf(HEAD_IDLER_T);
export const CAM_DIST = headIdlerD + Math.sqrt((rOf(CAM_T) + rOf(HEAD_IDLER_T)) ** 2 - CAM_Z ** 2);
/** Height of the cam centre above the valve seat, measured along the tilted valve axis. */
export const CAM_U = (CAM_DIST - DECK) / Math.cos(VALVE_TILT);
export const VALVE_Z = CAM_Z - CAM_U * Math.sin(VALVE_TILT);

const AIR_RAIL_U = 0.7;
/** Compressed-air gallery along a bank, in a cylinder's local frame. */
export const AIR_RAIL_Y = DECK + AIR_RAIL_U * Math.cos(VALVE_TILT);
export const AIR_RAIL_Z = VALVE_Z + AIR_RAIL_U * Math.sin(VALVE_TILT) + 0.28;

export const bankAngle = (cyl: number) => ((isBankA(cyl) ? -BANK_ANGLE_DEG / 2 : BANK_ANGLE_DEG / 2) * Math.PI) / 180;
export const bankDir = (cyl: number) => {
  const b = bankAngle(cyl);
  return new THREE.Vector3(0, Math.cos(b), Math.sin(b));
};
export const cylX = (cyl: number) => {
  const a = isBankA(cyl);
  const i = a ? cyl - 1 : cyl - 5;
  return (i - 1.5) * CYL_SPACING + (a ? -BANK_SHIFT / 2 : BANK_SHIFT / 2);
};
export const GEAR_X = cylX(1) - 0.78;

/** One bank's gears in the (y, z) plane of the engine: crank gear first, then idlers, head idler and both cams. */
export const bankGears = (bank: number): GearDef[] => {
  const b = (bank * BANK_ANGLE_DEG * Math.PI) / 360;
  const dir: [number, number] = [Math.cos(b), Math.sin(b)];
  const perp: [number, number] = [-Math.sin(b), Math.cos(b)];
  const gears: GearDef[] = [{ y: 0, z: 0, teeth: CRANK_T, r: rOf(CRANK_T), parent: -1 }];
  let d = rOf(CRANK_T);
  for (let i = 0; i < IDLERS; i++) {
    d += rOf(IDLER_T);
    gears.push({ y: dir[0] * d, z: dir[1] * d, teeth: IDLER_T, r: rOf(IDLER_T), parent: i });
    d += rOf(IDLER_T);
  }
  d += rOf(HEAD_IDLER_T);
  gears.push({ y: dir[0] * d, z: dir[1] * d, teeth: HEAD_IDLER_T, r: rOf(HEAD_IDLER_T), parent: IDLERS });
  const head = IDLERS + 1;
  for (const s of [1, -1]) gears.push({ y: dir[0] * CAM_DIST + perp[0] * s * CAM_Z, z: dir[1] * CAM_DIST + perp[1] * s * CAM_Z, teeth: CAM_T, r: rOf(CAM_T), parent: head });
  return gears;
};

export const wristDist = (c: number) => wristDistance(c, CRANK_R, ROD_L);

/** The cut through the castings sits just behind the front pair of valves. */
export const CASTING = { deck: DECK, top: CAM_DIST + 0.55, boreR: BORE_MM / 200, sumpY: -CRANK_HEIGHT_MM / 100, faceX: -VALVE_DX + 0.07, blockLength: 4.6 };


// ---- world placement ----
export const ENGINE_X = (OPEN_WHEELER.bayFront + OPEN_WHEELER.bayRear) / 2;
/** The crank sits at its real height above the bottom of the engine. */
export const ENGINE_REST_Y = OPEN_WHEELER.plankTop + CRANK_HEIGHT_MM / 100;
export const LIFT = 11;

/** 0..1 in `count` eased steps, one on each beat from `firstBeat`, so a move hits with the kicks. */
const beatSteps = (t: number, firstBeat: number, count: number) => {
  let sum = 0;
  for (let i = 0; i < count; i++) sum += smoothstep((t - beatT(firstBeat + i)) / beatT(0.45));
  return sum / count;
};

/** The engine rises one notch per kick through bar 2, and drops back the same way through bar 12. */
export const liftAt = (t: number) => (t < barT(12) ? LIFT * beatSteps(t, 8, 4) : LIFT * (1 - beatSteps(t, 48, 4)));

/** The cover pops off on the downbeat of bar 2, and lands just before the engine has finished dropping in. */
export const coverLiftAt = (t: number) => {
  const up = smoothstep((t - barT(2)) / beatT(1));
  const down = smoothstep((t - beatT(50)) / beatT(1.5));
  return 70 * up * (1 - down);
};

// ---- the race start ----
/** The scene moves from the garage to the track on this beat, the top of the climax. */
export const TRACK_FROM = barT(13);
export const HERO_Z = -14;
const LAUNCH_KICKS = KICKS.filter((k) => k >= DROP - 1e-9);
const V_MAX = 900; // units/s, about 325 km/h
const V_TAU_KICKS = 14;
const SURGE_S = beatT(0.55);

/**
 * Distance travelled since lights-out. Every kick adds a surge of speed, so the car accelerates to
 * the beat. Each surge ramps in linearly, which keeps this a closed form of t with no stored state.
 */
export const heroS = (t: number) => {
  let s = 0;
  LAUNCH_KICKS.forEach((k, n) => {
    const age = t - k;
    if (age <= 0) return;
    const dv = V_MAX * (Math.exp(-n / V_TAU_KICKS) - Math.exp(-(n + 1) / V_TAU_KICKS));
    s += age < SURGE_S ? (dv * age * age) / (2 * SURGE_S) : dv * (age - SURGE_S / 2);
  });
  return s;
};

export const heroV = (t: number) => {
  let v = 0;
  LAUNCH_KICKS.forEach((k, n) => {
    const age = t - k;
    if (age > 0) v += V_MAX * (Math.exp(-n / V_TAU_KICKS) - Math.exp(-(n + 1) / V_TAU_KICKS)) * Math.min(1, age / SURGE_S);
  });
  return v;
};

/** Height above the grid box. The car comes down in two drops, on beats 53 and 54, landing on the second. */
export const heroDropY = (t: number) => {
  if (t < TRACK_FROM) return 0;
  const start = 18;
  const halfway = 9;
  const first = smoothstep((t - beatT(52.6)) / beatT(0.4));
  const second = smoothstep((t - beatT(53.6)) / beatT(0.4));
  return start + (halfway - start) * first - halfway * second;
};

/** 1 at the touchdown on beat 54, decaying: the suspension takes the landing. */
export const landingPulse = (t: number) => (t >= beatT(54) && t < DROP ? Math.exp(-(t - beatT(54)) / 0.14) : 0);

/** Beats on which the five start lights come on, tightening with the snare roll. All go out on the drop. */
export const LIGHT_BEATS = [52, 53, 54, 54.5, 55];
export const lightsOnAt = (t: number) => (t >= DROP ? 0 : LIGHT_BEATS.filter((b) => t >= beatT(b)).length);

/** Rivals, by grid slot behind the hero. Each reacts a little later and pulls a little less. */
export const GRID_SPACING = 52;
export const GRID_SLOTS = 11;
export const gridSlot = (p: number) => ({ x: p * GRID_SPACING, z: p % 2 === 0 ? HERO_Z : -HERO_Z });
export const rivalS = (p: number, t: number) => heroS(t - 0.05 - p * 0.03) * (1 - 0.012 * p);

export const engineOrigin = (t: number) => new THREE.Vector3(ENGINE_X, ENGINE_REST_Y + liftAt(t), 0);

/** World position of a point on a cylinder's axis at distance d from the crank. */
export const cylPoint = (cyl: number, d: number, t: number) => engineOrigin(t).add(new THREE.Vector3(cylX(cyl), 0, 0)).add(bankDir(cyl).multiplyScalar(d));

/** World position of a point in a cylinder's own frame: along the crank, up the bore, across the bore. */
export const cylLocal = (cyl: number, dx: number, y: number, z: number, t: number) => {
  const b = bankAngle(cyl);
  return engineOrigin(t)
    .add(new THREE.Vector3(cylX(cyl) + dx, 0, 0))
    .add(new THREE.Vector3(0, Math.cos(b), Math.sin(b)).multiplyScalar(y))
    .add(new THREE.Vector3(0, -Math.sin(b), Math.cos(b)).multiplyScalar(z));
};

/** World position of a point on a valve's axis, u above its seat. `side` +1 is the intake row on bank A. */
export const valvePoint = (cyl: number, dxSign: number, rowSide: number, u: number, t: number) =>
  cylLocal(cyl, dxSign * VALVE_DX, DECK + u * Math.cos(VALVE_TILT), rowSide * (VALVE_Z + u * Math.sin(VALVE_TILT)), t);

export const crownWorld = (cyl: number, t: number) => cylPoint(cyl, wristDist(cycleAt(cyl, t) % 360) + PIN_TO_CROWN, t);

export { VALVE_STACK };
