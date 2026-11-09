import { describe, expect, it } from "vitest";
import { describeFourStroke } from "../../src/kits/engine/fourStroke.testkit";
import { BANGS, BANK_ANGLE_DEG, barT, beatT, BPM, CRANK_PINS, DROP, ENGINE_NOTE_HZ, engine, IDLE, isRightBank, isSlowed, REAL_SPEED_START, REDLINE, SLOW, SLOW_START, SONG_A4_HZ, toneChecks } from "./physics";
import { KICKS } from "./song";

describeFourStroke("v12", {
  engine,
  durationS: 32,
  steadyWindows: [
    { from: 25.7, to: 30.3, rpm: REDLINE, slow: 1 },
    { from: barT(2), to: barT(8), rpm: IDLE, slow: SLOW },
    { from: barT(8), to: barT(10), rpm: IDLE * 2, slow: SLOW },
    { from: barT(10), to: barT(12), rpm: IDLE * 4, slow: SLOW },
    { from: barT(12), to: barT(14), rpm: REDLINE, slow: SLOW },
  ],
  speedChanges: [SLOW_START, REAL_SPEED_START],
  crankPins: CRANK_PINS,
  bankDeg: (cyl) => (isRightBank(cyl) ? -BANK_ANGLE_DEG / 2 : BANK_ANGLE_DEG / 2),
  toneChecks,
});

describe("v12 specifics", () => {
  it("fires cylinder 1 exactly on its downbeat", () => {
    const c = engine.cycleAt(1, barT(5));
    expect(Math.min(c, 720 - c)).toBeLessThan(1e-6);
  });
  it("reaches 870 Hz at redline", () => {
    expect(engine.bangsPerSecond(REDLINE)).toBe(870);
    for (const c of toneChecks) expect(c.expectedHz).toBe(870);
  });
});

describe("v12 song sync", () => {
  const slowed = BANGS.filter((b) => isSlowed(b.t));
  const stepOf = (t: number) => t / beatT(0.125);

  it("derives a 43.5× slowdown and whole-frame beats from 150 BPM", () => {
    expect(BPM).toBe(150);
    expect(SLOW).toBe(43.5);
    expect(beatT(1) * 30).toBeCloseTo(12, 9);
  });
  it("runs at 20 bars for a 32 second video", () => {
    expect(barT(20)).toBeCloseTo(32, 9);
  });
  it("lands every slowed bang on the 32nd-note grid", () => {
    for (const b of slowed) expect(Math.abs(stepOf(b.t) - Math.round(stepOf(b.t)))).toBeLessThan(1e-6);
  });
  it("makes quarter, eighth, sixteenth and 32nd notes from the four speeds", () => {
    const spacing = (from: number, to: number) => {
      const inside = slowed.filter((b) => b.t >= from && b.t < to);
      return inside[1].t - inside[0].t;
    };
    expect(spacing(barT(3), barT(8))).toBeCloseTo(beatT(1), 6);
    expect(spacing(barT(8), barT(10))).toBeCloseTo(beatT(0.5), 6);
    expect(spacing(barT(10), barT(12))).toBeCloseTo(beatT(0.25), 6);
    expect(spacing(barT(12), barT(14))).toBeCloseTo(beatT(0.125), 6);
  });
  it("puts the right bank on the kick and the left bank on the snare", () => {
    for (const b of slowed.filter((x) => x.t < barT(8))) {
      const beat = Math.round(b.t / beatT(1));
      expect(isRightBank(b.cyl)).toBe(beat % 2 === 0);
    }
  });
  it("has a firing event under every slowed kick", () => {
    for (const k of KICKS.filter(isSlowed)) expect(slowed.some((b) => Math.abs(b.t - k) < 1e-6)).toBe(true);
  });
  it("tunes the song to the engine's redline note", () => {
    expect(SONG_A4_HZ * 2).toBe(ENGINE_NOTE_HZ);
  });
  it("starts the chorus on a bar line", () => {
    expect(DROP).toBeCloseTo(barT(16), 9);
  });
});
