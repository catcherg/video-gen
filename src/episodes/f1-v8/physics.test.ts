import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { describeFourStroke } from "../../core/engine/fourStroke.testkit";
import { noteName } from "../../core/math";
import { meta } from "./meta";
import { BANGS, BANK_ANGLE_DEG, barT, BARS, beatT, BPM, CRANK_PINS, DISPLACEMENT_CC, DROP, ENGINE_NOTE_HZ, engine, HALF_REV, isBankA, isSlowed, isSlowedBang, QUARTER_REV, REAL_SPEED_START, REDLINE, SLOW, SLOW_START, SONG_A4_HZ, SUB_HZ, toneChecks } from "./physics";
import { KICKS, sectionOfBar, STABS } from "./song";
import { SONG_MAP } from "./songMap";

describeFourStroke("f1-v8", {
  engine,
  durationS: meta.durationS,
  steadyWindows: [
    { from: DROP + 0.1, to: barT(17) - 0.1, rpm: REDLINE, slow: 1 },
    { from: barT(2), to: barT(6), rpm: QUARTER_REV, slow: SLOW },
    { from: barT(6), to: barT(10), rpm: HALF_REV, slow: SLOW },
    { from: barT(10), to: barT(12), rpm: REDLINE, slow: SLOW },
  ],
  speedChanges: [SLOW_START, REAL_SPEED_START],
  crankPins: CRANK_PINS,
  bankDeg: (cyl) => (isBankA(cyl) ? -BANK_ANGLE_DEG / 2 : BANK_ANGLE_DEG / 2),
  toneChecks,
});

describe("f1-v8 specifics", () => {
  it("displaces just under the 2.4 L limit", () => {
    expect(DISPLACEMENT_CC).toBeGreaterThan(2390);
    expect(DISPLACEMENT_CC).toBeLessThanOrEqual(2400);
  });
  it("makes a flat-plane crank: pin angles only 180° apart", () => {
    const pin = (a: number) => (((-45 - engine.fireOffset[a]) % 360) + 360) % 360;
    const angles = new Set(CRANK_PINS.map(([a]) => pin(a)));
    expect([...angles].sort((x, y) => x - y)).toEqual([135, 315]);
  });
  it("alternates banks on every firing event", () => {
    for (let i = 1; i < BANGS.length; i++) expect(isBankA(BANGS[i].cyl)).not.toBe(isBankA(BANGS[i - 1].cyl));
  });
  it("fires cylinder 1 exactly on its downbeat", () => {
    const c = engine.cycleAt(1, barT(4));
    expect(Math.min(c, 720 - c)).toBeLessThan(1e-6);
  });
});

describe("f1-v8 song sync", () => {
  const slowed = BANGS.filter((b) => isSlowedBang(b.t));
  const stepOf = (t: number) => t / beatT(0.25);

  it("has whole-frame beats and a whole number of bars", () => {
    expect(BPM).toBeCloseTo(1800 / 14, 9);
    expect(beatT(1) * 30).toBeCloseTo(14, 9);
    expect(barT(BARS)).toBeCloseTo(meta.durationS, 9);
  });
  it("lands every slowed bang on the 16th-note grid", () => {
    for (const b of slowed) expect(Math.abs(stepOf(b.t) - Math.round(stepOf(b.t)))).toBeLessThan(1e-6);
  });
  it("makes quarter, eighth and sixteenth notes from the three speeds", () => {
    const spacing = (from: number, to: number) => {
      const inside = slowed.filter((b) => b.t >= from && b.t < to);
      return inside[1].t - inside[0].t;
    };
    expect(spacing(barT(3), barT(6))).toBeCloseTo(beatT(1), 6);
    expect(spacing(barT(6), barT(10))).toBeCloseTo(beatT(0.5), 6);
    expect(spacing(barT(10), barT(12))).toBeCloseTo(beatT(0.25), 6);
  });
  it("has a firing event under every slowed kick", () => {
    for (const k of KICKS.filter(isSlowed)) expect(slowed.some((b) => Math.abs(b.t - k) < 1e-6)).toBe(true);
  });
  it("puts bank B on beats 2 and 4 at the lowest speed", () => {
    for (const b of slowed.filter((x) => x.t >= barT(4) - 1e-6 && x.t < barT(6))) {
      const beat = Math.round(b.t / beatT(1));
      expect(isBankA(b.cyl)).toBe(beat % 2 === 0);
    }
  });
  it("makes the sub root the engine's note five octaves down", () => {
    expect(SUB_HZ * 32).toBe(ENGINE_NOTE_HZ);
    expect(noteName(ENGINE_NOTE_HZ).name).toBe("D#6");
    expect(SONG_A4_HZ * 2 ** 1.5).toBeCloseTo(ENGINE_NOTE_HZ, 6);
  });
  it("starts the drop on a bar line", () => {
    expect(DROP).toBeCloseTo(barT(14), 9);
    expect(sectionOfBar(14)).toBe("drop");
  });
});

describe("f1-v8 song map", () => {
  it("has a picture frame for every scheduled hit", () => {
    expect(SONG_MAP.kickFrames.length).toBe(KICKS.length);
    expect(SONG_MAP.stabFrames.length).toBe(STABS.length);
  });
  it("never puts a picture hit before its scheduled sound", () => {
    SONG_MAP.kickFrames.forEach((f, i) => expect(f / SONG_MAP.fps).toBeGreaterThanOrEqual(KICKS[i] - 1e-6));
    SONG_MAP.stabFrames.forEach((f, i) => expect(f / SONG_MAP.fps).toBeGreaterThanOrEqual(STABS[i] - 1e-6));
  });
  it("was measured from the current song", () => {
    const wav = "public/f1-v8/audio.wav";
    if (!existsSync(wav)) return;
    expect(createHash("sha256").update(readFileSync(wav)).digest("hex")).toBe(SONG_MAP.wavSha256);
  });
});
