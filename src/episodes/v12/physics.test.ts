import { describe, expect, it } from "vitest";
import { describeFourStroke } from "../../core/engine/fourStroke.testkit";
import { BANK_ANGLE_DEG, CRANK_PINS, engine, isRightBank, REAL_SPEED_START, REDLINE, SLOW, SLOW_START, toneChecks } from "./physics";

describeFourStroke("v12", {
  engine,
  durationS: 32,
  steadyWindows: [
    { from: 25.0, to: 30.4, rpm: REDLINE, slow: 1 },
    { from: 3.2, to: 11.4, rpm: 1100, slow: SLOW },
    { from: 21.0, to: 22.4, rpm: REDLINE, slow: SLOW },
  ],
  speedChanges: [SLOW_START, REAL_SPEED_START],
  crankPins: CRANK_PINS,
  bankDeg: (cyl) => (isRightBank(cyl) ? -BANK_ANGLE_DEG / 2 : BANK_ANGLE_DEG / 2),
  toneChecks,
});

describe("v12 specifics", () => {
  it("fires cylinder 1 exactly on the 8.0 s beat", () => {
    const c = engine.cycleAt(1, 8.0);
    expect(Math.min(c, 720 - c)).toBeLessThan(1e-6);
  });
  it("reaches 870 Hz at redline", () => {
    expect(engine.bangsPerSecond(REDLINE)).toBe(870);
  });
});
