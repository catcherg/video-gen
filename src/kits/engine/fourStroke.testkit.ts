// Shared physics tests. Each video's physics.test.ts calls describeFourStroke once.
import { describe, expect, it } from "vitest";
import type { ToneCheck } from "../../core/video";
import type { FourStroke } from "./fourStroke";

export type FourStrokeTestConfig = {
  engine: FourStroke;
  durationS: number;
  /** Sections where RPM and slow-motion factor are held constant. */
  steadyWindows: { from: number; to: number; rpm: number; slow: number }[];
  /** On-screen times where the slow-motion factor changes. */
  speedChanges: number[];
  /** Cylinders sharing each crank pin, for engines with paired rods. */
  crankPins?: [number, number][];
  bankDeg?: (cyl: number) => number;
  toneChecks?: ToneCheck[];
};

const mod360 = (x: number) => ((x % 360) + 360) % 360;

export const describeFourStroke = (name: string, cfg: FourStrokeTestConfig) => {
  const { engine, durationS, steadyWindows, speedChanges } = cfg;
  const { bangs, cylinders, firingOrder } = engine;

  describe(`${name}: four-stroke physics`, () => {
    it("computes bangs/sec = RPM/60 × cylinders/2", () => {
      for (const rpm of [800, 1100, 4400, 8700]) expect(engine.bangsPerSecond(rpm)).toBeCloseTo((rpm / 60) * (cylinders / 2), 9);
    });

    it("counts that many bangs in every steady section", () => {
      for (const w of steadyWindows) {
        const count = bangs.filter((b) => b.t >= w.from && b.t < w.to).length;
        const expected = (engine.bangsPerSecond(w.rpm) / w.slow) * (w.to - w.from);
        expect(Math.abs(count - expected)).toBeLessThanOrEqual(1);
      }
    });

    it("lists every cylinder exactly once in the firing order", () => {
      expect([...firingOrder].sort((a, b) => a - b)).toEqual(Array.from({ length: cylinders }, (_, i) => i + 1));
    });

    it("fires every cylinder once per 720° of crank rotation", () => {
      for (let i = 0; i + cylinders <= bangs.length; i++) {
        const slice = bangs.slice(i, i + cylinders);
        expect(new Set(slice.map((b) => b.cyl)).size).toBe(cylinders);
        if (i + cylinders < bangs.length) {
          const span = engine.crankAt(bangs[i + cylinders].t) - engine.crankAt(bangs[i].t);
          expect(Math.abs(span - 720)).toBeLessThan(1e-3);
        }
      }
    });

    it("keeps crank angle continuous and increasing across speed changes", () => {
      const dt = 1 / 2400;
      const rate = (t: number) => (360 * engine.rpmAt(Math.max(0, t))) / 60 / engine.slowAt(Math.max(0, t));
      for (let t = 0; t + dt <= durationS; t += dt) {
        const delta = engine.crankAt(t + dt) - engine.crankAt(t);
        expect(delta).toBeGreaterThan(0);
        expect(delta).toBeLessThanOrEqual(Math.max(rate(t - dt), rate(t), rate(t + dt)) * dt * 1.01);
      }
      for (const at of speedChanges) {
        expect(Math.abs(engine.crankAt(at + 1e-7) - engine.crankAt(at - 1e-7))).toBeLessThan(0.1);
      }
    });

    it("has strictly increasing bang timestamps inside the video", () => {
      for (let i = 1; i < bangs.length; i++) expect(bangs[i].t).toBeGreaterThan(bangs[i - 1].t);
      expect(bangs[0].t).toBeGreaterThanOrEqual(0);
      expect(bangs[bangs.length - 1].t).toBeLessThanOrEqual(durationS + 1);
    });

    if (cfg.crankPins && cfg.bankDeg) {
      const { crankPins, bankDeg } = cfg;
      it("gives rods sharing a crank pin the same pin angle", () => {
        for (const [a, b] of crankPins) {
          const pinA = mod360(bankDeg(a) - engine.fireOffset[a]);
          const pinB = mod360(bankDeg(b) - engine.fireOffset[b]);
          expect(pinA).toBeCloseTo(pinB, 9);
        }
      });
    }

    if (cfg.toneChecks) {
      const checks = cfg.toneChecks;
      it("holds real speed and steady RPM throughout each audio check window", () => {
        for (const c of checks) {
          const rpm = engine.rpmAt(c.from);
          for (let t = c.from; t <= c.to; t += 0.02) {
            expect(engine.slowAt(t)).toBe(1);
            expect(Math.abs(engine.rpmAt(t) - rpm) / rpm).toBeLessThan(0.001);
          }
        }
      });
    }
  });
};
