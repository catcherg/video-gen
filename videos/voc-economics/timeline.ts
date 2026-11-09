// Camera keys, shot titles, live diagrams and every hit the picture follows.
//
// Bars   Shot                 Subject                        Diagram
//  0-1   Ship at sea          The hook, on the song's stabs  none
//  2-3   Coins and a share    Public money                   none
//  4-5   Ship at sea          The monopoly                   Route map
//  6-7   The Banda Islands    Seized by force                none
//  8     The empty island     The human cost                 Population
//  9     A chest of coins     Dividends                      none
//  10-11 Cargo and coins      Profitless growth              Profit
//  12-13 The drop: war        Ships lost                     none
//  14-15 A falling stack      Net worth to zero              Net worth
//  16-17 A stack of debt      What was left                  none
import * as THREE from "three";
import { makeCameraRig, type CameraFn, type CameraKey, type V3 } from "../../src/core/camera";
import type { Caption } from "../../src/core/Captions";
import type { DiagramSpec } from "../../src/core/diagrams/spec";
import { fmtInt } from "../../src/core/math";
import { hitPulse, shake } from "../../src/core/motion";
import { resolveCaptions, resolveTime } from "../../src/core/spec";
import { meta, spec } from "./meta";
import {
  BANDA_BEFORE,
  BANDA_LOSS_PCT,
  BANDA_SURVIVORS,
  barT,
  CAPITAL_M,
  CHARTER_YEARS,
  DIVIDEND_PCT,
  FINAL_DEBT_FLOOR_M,
  NET_CAPITAL_1780_M,
  OUTBOUND_VOYAGES,
  PROFIT_1630S_M,
  PROFIT_1680S_M,
  WAR_DAMAGE_M,
} from "./physics";
import { SONG_MAP } from "./songMap";

const seconds = (frames: number[]) => frames.map((f) => f / SONG_MAP.fps);

export const KICKS = seconds(SONG_MAP.kickFrames);
export const STABS = seconds(SONG_MAP.stabFrames);
export const IMPACTS = seconds(SONG_MAP.impactFrames ?? []);

export const CAPTIONS: Caption[] = resolveCaptions(spec, {
  capital: CAPITAL_M,
  years: CHARTER_YEARS,
  voyages: fmtInt(OUTBOUND_VOYAGES),
  p: BANDA_LOSS_PCT,
  dividend: DIVIDEND_PCT,
  d: WAR_DAMAGE_M,
  net: NET_CAPITAL_1780_M,
  b: FINAL_DEBT_FLOOR_M,
});

/** Where each set stands in the world, far enough apart that no camera sees another set. */
export const SETS = { sea: 0, money: 150, banda: 300, chest: 450, cargo: 600, war: 750, fall: 900 };

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

const { sea, money, banda, chest, cargo, war, fall } = SETS;
const rig = makeCameraRig([
  ...hold(0, barT(2), [sea - 6, 7, 52], [sea - 3, 6, 46], [sea, 7, 0]),
  ...hold(barT(2), barT(4), [money, 12, 84], [money, 12, 76], [money, 12, 0]),
  ...hold(barT(4), barT(6), [sea + 10, 8, 62], [sea + 6, 8, 56], [sea, 9, 0]),
  ...hold(barT(6), barT(8), [banda, 12, 82], [banda, 11, 72], [banda, 7, 0]),
  ...hold(barT(8), barT(9), [banda, 12, 88], [banda, 12, 82], [banda, 9, 0]),
  ...hold(barT(9), barT(10), [chest, 10, 62], [chest, 9, 56], [chest, 8, 0]),
  ...hold(barT(10), barT(12), [cargo, 12, 76], [cargo, 12, 68], [cargo, 13, 0]),
  ...hold(barT(12), barT(14), [war - 4, 9, 66], [war + 4, 8, 56], [war, 8, 0]),
  ...hold(barT(14), barT(16), [fall, 14, 128], [fall, 14, 118], [fall, 11, 0]),
  ...hold(barT(16), barT(18) + 0.2, [fall, 24, 150], [fall, 24, 138], [fall, 23, 0]),
]);

const KICK_ZOOM_DEG = 1.4;
const IMPACT_SHAKE = 1.4;

/** The keyframed camera, with a punch on every kick and a hard shake on the drop. */
export const cameraAt: CameraFn = (t) => {
  const pose = rig(t);
  pose.fov -= KICK_ZOOM_DEG * hitPulse(t, KICKS);
  pose.pos.add(new THREE.Vector3(shake(t, IMPACTS, IMPACT_SHAKE, 11, 18, 0.4), shake(t, IMPACTS, IMPACT_SHAKE, 12, 18, 0.4), 0));
  return pose;
};

export const TITLES: { from: number; to: number; text: string }[] = [
  { from: barT(2), to: barT(4), text: "THE MONEY" },
  { from: barT(4), to: barT(6), text: "THE MONOPOLY" },
  { from: barT(6), to: barT(8), text: "THE SPICE" },
  { from: barT(8), to: barT(9), text: "THE COST" },
  { from: barT(9), to: barT(10), text: "THE PAYOUT" },
  { from: barT(10), to: barT(12), text: "THE CRACK" },
  { from: barT(12), to: barT(14), text: "THE WAR" },
  { from: barT(14), to: barT(16), text: "THE FALL" },
  { from: barT(16), to: barT(17.5), text: "THE BILL" },
];

/** A schematic map, not a survey: Europe at top left, Africa, Asia, and the islands at bottom right. */
const WORLD = [
  "...#####....######################",
  "..######....######################",
  "...#####...#######################",
  "....##......##..######.##########.",
  "..#######.....#####.....#####.....",
  ".#########.....###.......####.....",
  "..#########......#........##......",
  "....#######..................#.##.",
  ".....#####.................###.##.",
  ".....####.........................",
  "......##..........................",
];

export const DIAGRAMS: Record<string, DiagramSpec> = {
  route: {
    type: "map",
    title: "THE ROUTE (SCHEMATIC MAP)",
    rows: WORLD,
    markers: [
      { col: 6, row: 1, label: "AMSTERDAM" },
      { col: 29, row: 8, label: "BATAVIA" },
    ],
    route: [[6, 1], [2, 3], [0, 6], [3, 10], [11, 9], [22, 9], [29, 8]],
  },
  banda: {
    type: "bar",
    title: "BANDANESE PEOPLE (ESTIMATES)",
    bars: [
      { label: "BEFORE", value: BANDA_BEFORE },
      { label: "SURVIVORS", value: BANDA_SURVIVORS },
    ],
  },
  profit: {
    type: "bar",
    title: "AVERAGE PROFIT PER YEAR",
    unit: "M",
    bars: [
      { label: "1630-70", value: PROFIT_1630S_M },
      { label: "1680-1730", value: PROFIT_1680S_M },
    ],
  },
  net: {
    type: "bar",
    title: "NET WORTH, GUILDERS",
    unit: "M",
    bars: [
      { label: "1780", value: NET_CAPITAL_1780_M },
      { label: "AFTER WAR", value: 0 },
    ],
  },
};

export const SHOT_WINDOWS = spec.shots.map((shot) => ({ from: resolveTime(spec, shot.from), to: resolveTime(spec, shot.to), diagram: shot.diagram }));

export const END_FADE_FROM = meta.durationS - 0.7;
