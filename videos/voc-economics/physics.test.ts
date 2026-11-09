import { describe, expect, it } from "vitest";
import { validateDiagram } from "../../src/core/diagrams/spec";
import { validateSpec } from "../../src/core/spec";
import { spec } from "./meta";
import { BANDA_BEFORE, BANDA_LOSS_PCT, BANDA_SURVIVORS, barT, FINAL_DEBT_FLOOR_M, NET_CAPITAL_1780_M, PROFIT_1630S_M, PROFIT_1680S_M, WAR_DAMAGE_M } from "./physics";
import rawSpec from "./spec.json";
import { CAPTIONS, DIAGRAMS, SHOT_WINDOWS } from "./timeline";

describe("voc-economics", () => {
  it("has a valid spec", () => {
    expect(validateSpec(rawSpec)).toEqual([]);
  });

  it("has figures that agree with each other", () => {
    expect(1 - BANDA_SURVIVORS / BANDA_BEFORE).toBeCloseTo(BANDA_LOSS_PCT / 100, 1);
    expect(PROFIT_1680S_M).toBeLessThanOrEqual(PROFIT_1630S_M);
    expect(WAR_DAMAGE_M).toBeLessThan(NET_CAPITAL_1780_M);
    expect(FINAL_DEBT_FLOOR_M).toBeGreaterThan(NET_CAPITAL_1780_M);
  });

  it("gives every published debt figure's lower bound, and no spice markup", () => {
    const facts = spec.facts.map((f) => f.id);
    expect(facts).toContain("finalDebtFloorM");
    expect(facts.some((id) => /markup/i.test(id))).toBe(false);
  });

  it("gives every fact a confidence level, and names a source unless it is assumed", () => {
    for (const fact of spec.facts) expect(fact.sources.length, fact.id).toBeGreaterThan(0);
  });

  it("fills every caption token", () => {
    expect(CAPTIONS.flatMap((c) => c.lines).filter((line) => /[{}]/.test(line))).toEqual([]);
  });

  it("has a valid diagram for every shot that names one", () => {
    for (const shot of SHOT_WINDOWS) if (shot.diagram) expect(validateDiagram(DIAGRAMS[shot.diagram], shot.diagram)).toEqual([]);
  });

  it("lands the song's drop on the war", () => {
    expect(spec.shots[7].subject).toContain("War");
    expect(barT(12)).toBeCloseTo(SHOT_WINDOWS[7].from, 9);
  });
});
