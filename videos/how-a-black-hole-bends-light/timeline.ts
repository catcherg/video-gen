// Camera keys, shot titles, live diagrams and every hit the picture follows.
//
// Bars         Shot                 Subject                          Diagram
//  0-2         Black hole           A beam loops around it           none
//  2-4.5       The Sun              Starlight grazes the rim         True and seen star
//  4.5-5.75    Eclipse              Telescopes and reported shifts   none
//  5.75-8.25   A mass               Closer rays bend more            Bend against distance
//  8.25-10.75  Black hole           Light orbiting                   Photon sphere
//  10.75-12    Black hole           True rays near critical          Captured or looping
//  12-13.25    Disk (the drop)      Far side folds over the hole     Far disk light
//  13.25-14.5  Disk, closer         Thin photon rings                none
//  14.5-15.75  Shadow               Grows past the horizon           Horizon inside shadow
//  15.75-18    Sagittarius A*       Ring and the predicted size      none
import * as THREE from "three";
import { makeCameraRig, type CameraFn, type CameraKey, type V3 } from "../../src/core/camera";
import type { Caption } from "../../src/core/Captions";
import type { DiagramSpec } from "../../src/core/diagrams/spec";
import { hitPulse, shake } from "../../src/core/motion";
import { resolveCaptions, resolveTime } from "../../src/core/spec";
import { meta, spec } from "./meta";
import { barT, einsteinBend, PHOTON_SPHERE, SHADOW_DRAWN_RATIO, SUN_DEFLECTION } from "./physics";
import { SONG_MAP } from "./songMap";

const seconds = (frames: number[]) => frames.map((f) => f / SONG_MAP.fps);

export const KICKS = seconds(SONG_MAP.kickFrames);
export const STABS = seconds(SONG_MAP.stabFrames);
export const IMPACTS = seconds(SONG_MAP.impactFrames ?? []);

export const CAPTIONS: Caption[] = resolveCaptions(spec, {
  sunDeflection: SUN_DEFLECTION,
  photonSphere: PHOTON_SPHERE,
});

/** Where each set stands in the world, far enough apart that no camera sees another set. */
export const SETS = { hole: 0, sun: 150, eclipse: 300, mass: 450, orbit: 600, critical: 750, disk: 900, shadow: 1050, sgr: 1200 };

const CUT = 1 / 30;
/** Share of the camera distance to aim below a subject, which lifts it into the top half of the frame, above the captions. */
const LIFT = 0.13;

const hold = (from: number, to: number, pos0: V3, pos1: V3, subject: V3): CameraKey[] => {
  const aim = (pos: V3): V3 => [subject[0], subject[1] - LIFT * Math.hypot(pos[0] - subject[0], pos[1] - subject[1], pos[2] - subject[2]), subject[2]];
  return [
    { t: from, pos: pos0, target: aim(pos0), fov: 40 },
    { t: to - CUT, pos: pos1, target: aim(pos1), fov: 40 },
  ];
};

const { hole, sun, eclipse, mass, orbit, critical, disk, shadow, sgr } = SETS;
const rig = makeCameraRig([
  ...hold(0, barT(2), [hole, 0.65, 66], [hole, 0.65, 58], [hole, 0.65, 0]),
  ...hold(barT(2), barT(4.5), [sun, 1.1, 86], [sun, 1.1, 81], [sun, 1.1, 0]),
  ...hold(barT(4.5), barT(5.75), [eclipse, 1.3, 62], [eclipse, 1.3, 57], [eclipse, 1.05, 0]),
  ...hold(barT(5.75), barT(8.25), [mass, 0, 72], [mass, 0, 66], [mass, 0, 0]),
  ...hold(barT(8.25), barT(10.75), [orbit, 0, 90], [orbit, 0, 82], [orbit, 0, 0]),
  ...hold(barT(10.75), barT(12), [critical, 0, 75], [critical, 0, 70], [critical, 0, 0]),
  ...hold(barT(12), barT(13.25), [disk, 2, 74], [disk, 2, 68], [disk, 0, 0]),
  ...hold(barT(13.25), barT(14.5), [disk, 1, 66], [disk, 1, 60], [disk, 0, 0]),
  ...hold(barT(14.5), barT(15.75), [shadow, 0, 80], [shadow, 0, 74], [shadow, 0, 0]),
  ...hold(barT(15.75), barT(18) + 0.2, [sgr, 0, 92], [sgr, 0, 80], [sgr, 0, 0]),
]);

const KICK_ZOOM_DEG = 1.2;
const IMPACT_SHAKE = 0.9;

/** The keyframed camera, with a punch on every kick and a shake on the drop. */
export const cameraAt: CameraFn = (t) => {
  const pose = rig(t);
  pose.fov -= KICK_ZOOM_DEG * hitPulse(t, KICKS);
  pose.pos.add(new THREE.Vector3(shake(t, IMPACTS, IMPACT_SHAKE, 11, 18, 0.35), shake(t, IMPACTS, IMPACT_SHAKE, 12, 18, 0.35), 0));
  return pose;
};

/** A section title for each shot from the third bar on. Fifteen characters at most, so that each stays inside the safe zone. */
export const TITLES: { from: number; to: number; text: string }[] = [
  { from: barT(2), to: barT(4.5), text: "STARLIGHT BENDS" },
  { from: barT(4.5), to: barT(5.75), text: "ECLIPSE OF 1919" },
  { from: barT(5.75), to: barT(8.25), text: "BIGGER BENDS" },
  { from: barT(8.25), to: barT(10.75), text: "PHOTON SPHERE" },
  { from: barT(10.75), to: barT(12), text: "CRITICAL EDGE" },
  { from: barT(12), to: barT(13.25), text: "THE WARPED DISK" },
  { from: barT(13.25), to: barT(14.5), text: "RING SKETCH" },
  { from: barT(14.5), to: barT(15.75), text: "SHADOW SIZE" },
  { from: barT(15.75), to: barT(18), text: "SGR A* SKETCH" },
];

const tileRows = (cols: number, rows: number, tile: (col: number, row: number) => string) =>
  Array.from({ length: rows }, (_, row) => Array.from({ length: cols }, (_, col) => tile(col, row)).join(""));

/** The Sun low in the middle, the true star and Earth either side, and dots along the line of sight back to where the star seems to be. */
const STARLIGHT_ROWS = tileRows(36, 12, (col, row) => {
  if (Math.hypot(col - 18, row - 9) <= 3.6) return "S";
  if (col === 2 && row === 7) return "T";
  if (col === 34 && row === 9) return "E";
  return col <= 14 && col % 4 === 2 && row === (col + 2) / 4 ? "a" : ".";
});

const DISC_COLS = 41;
const DISC_ROWS = 15;
const discRadius = (col: number, row: number) => Math.hypot(col - (DISC_COLS - 1) / 2, row - (DISC_ROWS - 1) / 2);

const SPHERE_HORIZON_TILES = 4;
const PHOTON_SPHERE_ROWS = tileRows(DISC_COLS, DISC_ROWS, (col, row) => {
  const d = discRadius(col, row);
  if (d <= SPHERE_HORIZON_TILES) return "H";
  return Math.abs(d - SPHERE_HORIZON_TILES * PHOTON_SPHERE) < 0.5 ? "P" : ".";
});

const SHADOW_HORIZON_TILES = 3;
const SHADOW_ROWS = tileRows(DISC_COLS, DISC_ROWS, (col, row) => {
  const d = discRadius(col, row);
  if (d <= SHADOW_HORIZON_TILES) return "H";
  return d <= SHADOW_HORIZON_TILES * SHADOW_DRAWN_RATIO + 0.01 ? "S" : ".";
});

const PASS_DISTANCES = Array.from({ length: 11 }, (_, i) => 1 + i * 0.5);

export const DIAGRAMS: Record<string, DiagramSpec> = {
  "Starlight path bending past the Sun, with the star's true and apparent positions": {
    type: "map",
    title: "TRUE VS SEEN STAR (BEND EXAGGERATED)",
    rows: STARLIGHT_ROWS,
    markers: [
      { col: 2, row: 1, label: "SEEN" },
      { col: 2, row: 7, label: "TRUE" },
      { col: 18, row: 9, label: "SUN" },
      { col: 34, row: 9, label: "EARTH" },
    ],
    route: [
      [2, 7],
      [10, 6],
      [18, 5],
      [22, 6],
      [26, 7],
      [30, 8],
      [34, 9],
    ],
  },
  "Light rays bending more as they pass closer to a mass": {
    type: "line",
    title: "BEND FAR FROM A MASS (NOT TO SCALE)",
    xLabel: "PASS DISTANCE",
    series: [{ label: "BEND ANGLE", points: PASS_DISTANCES.map((b): [number, number] => [b, einsteinBend(b)]) }],
  },
  "Event horizon with the photon sphere at 1.5 times its radius": {
    type: "map",
    title: `PHOTON SPHERE: ${PHOTON_SPHERE}× HORIZON RADIUS`,
    rows: PHOTON_SPHERE_ROWS,
    markers: [
      { col: 20, row: 7, label: "HORIZON" },
      { col: 23, row: 2, label: "PHOTON ORBIT" },
    ],
  },
  "Rays near the critical distance: some captured, some looping around and escaping": {
    type: "comparison",
    title: "RAYS NEAR THE CRITICAL DISTANCE",
    left: "JUST INSIDE",
    right: "JUST OUTSIDE",
    rows: [
      { label: "RAY PATH", left: "SPIRALS IN", right: "LOOPS AROUND" },
      { label: "RESULT", left: "CAPTURED", right: "ESCAPES" },
    ],
  },
  "Light from the far side of the disk bending over the hole toward the viewer": {
    type: "flow",
    title: "FAR DISK LIGHT BENDS OVER (SCHEMATIC)",
    steps: ["FAR DISK", "BENDS OVER", "YOUR EYE"],
  },
  "Event horizon drawn inside a shadow more than twice as wide": {
    type: "map",
    title: "SHADOW: MORE THAN TWICE THE HORIZON",
    rows: SHADOW_ROWS,
    markers: [
      { col: 20, row: 7, label: "HORIZON" },
      { col: 20, row: 2, label: "SHADOW" },
    ],
  },
};

/** Which diagram is showing, from the shot list in the spec. */
export const SHOT_WINDOWS = spec.shots.map((shot) => ({ from: resolveTime(spec, shot.from), to: resolveTime(spec, shot.to), diagram: shot.diagram }));

/** A short fade over the last few frames, so that the finished ring stays on screen almost to the end. */
const END_FADE_FRAMES = 5;
export const END_FADE_FROM = meta.durationS - END_FADE_FRAMES / spec.format.fps;
