import { describe, expect, it } from "vitest";
import { describeFourStroke } from "../../src/kits/engine/fourStroke.testkit";
import { meta } from "./meta";
import {
  bangsPerSecond,
  bankDeg,
  bankGapsDeg,
  bankToneHz,
  CROSS,
  crossToneChecks,
  engineAt,
  FLAT,
  flatToneChecks,
  pinAnglesDeg,
  pinSpacingDeg,
  REAL_SPEED_START,
  SHOW_RPM,
  SLOW,
  SLOW_RPM,
  SLOW_START,
  type V8,
} from "./physics";

const steady = [
  { from: 19.5, to: 29, rpm: SHOW_RPM, slow: 1 },
  { from: 6.5, to: 18.5, rpm: SLOW_RPM, slow: SLOW },
];
const shared = (v8: V8) => ({
  engine: v8.engine,
  durationS: meta.durationS,
  steadyWindows: steady,
  speedChanges: [SLOW_START, REAL_SPEED_START],
  crankPins: v8.pins,
  bankDeg: (cyl: number) => bankDeg(v8, cyl),
});

describeFourStroke("cross-plane V8", { ...shared(CROSS), toneChecks: crossToneChecks });
describeFourStroke("flat-plane V8", { ...shared(FLAT), toneChecks: flatToneChecks });

const bankSequence = (v8: V8) => v8.firingOrder.map((cyl) => (v8.isRight(cyl) ? "R" : "L")).join("");

describe("crank layouts", () => {
  it("gives both engines the same firing rate", () => {
    expect(bangsPerSecond(SHOW_RPM)).toBe(400);
    expect(CROSS.engine.bangsPerSecond(SHOW_RPM)).toBe(FLAT.engine.bangsPerSecond(SHOW_RPM));
  });
  it("places cross-plane pins 90° apart and flat-plane pins 180° apart", () => {
    expect(pinSpacingDeg(CROSS)).toBe(90);
    expect(pinSpacingDeg(FLAT)).toBe(180);
    expect(new Set(pinAnglesDeg(CROSS)).size).toBe(4);
    expect(new Set(pinAnglesDeg(FLAT)).size).toBe(2);
  });
  it("puts flat-plane pins in the usual 0-180-180-0 pattern", () => {
    const a = pinAnglesDeg(FLAT);
    expect(a[0]).toBe(a[3]);
    expect(a[1]).toBe(a[2]);
    expect(Math.abs(a[1] - a[0])).toBe(180);
  });
  it("fires cross-plane banks unevenly, 180-90-180-270 on one bank", () => {
    expect(bankGapsDeg(CROSS, true)).toEqual([180, 90, 180, 270]);
    expect([...bankGapsDeg(CROSS, false)].sort((a, b) => a - b)).toEqual([90, 180, 180, 270]);
  });
  it("fires flat-plane banks evenly and alternately", () => {
    expect(bankGapsDeg(FLAT, true)).toEqual([180, 180, 180, 180]);
    expect(bankGapsDeg(FLAT, false)).toEqual([180, 180, 180, 180]);
    expect(bankSequence(FLAT)).toBe("RLRLRLRL");
  });
  it("does not alternate banks on the cross-plane", () => {
    expect(bankSequence(CROSS)).not.toBe("RLRLRLRL");
    expect(bankSequence(CROSS)).not.toBe("LRLRLRLR");
  });
  it("predicts a different loudest bank note for each crank", () => {
    expect(bankToneHz(FLAT, true, SHOW_RPM)).toBe(200);
    expect(bankToneHz(CROSS, true, SHOW_RPM)).not.toBe(bankToneHz(FLAT, true, SHOW_RPM));
  });
  it("swaps engines at the planned times", () => {
    expect(engineAt(1)).toBe(CROSS);
    expect(engineAt(4)).toBe(FLAT);
    expect(engineAt(8)).toBe(CROSS);
    expect(engineAt(15)).toBe(FLAT);
    expect(engineAt(20)).toBe(CROSS);
    expect(engineAt(26)).toBe(FLAT);
  });
});
