import { describe, expect, it } from "vitest";
import { validateDiagram } from "../../src/core/diagrams/spec";
import { validateSpec } from "../../src/core/spec";
import { spec } from "./meta";
import { barT, BLUE_VS_RED, LIGHT_BANDS, scatterRelativeToBlue } from "./physics";
import rawSpec from "./spec.json";
import { CAPTIONS, DIAGRAMS, SHOT_WINDOWS } from "./timeline";

describe("sky-blue", () => {
  it("has a valid spec", () => {
    expect(validateSpec(rawSpec)).toEqual([]);
  });

  it("scatters blue about four times more than red", () => {
    expect(BLUE_VS_RED).toBeCloseTo((650 / 450) ** 4, 9);
    expect(Math.round(BLUE_VS_RED)).toBe(4);
  });

  it("scatters shorter wavelengths more, from violet down to red", () => {
    const strengths = LIGHT_BANDS.map((b) => scatterRelativeToBlue(b.nm));
    expect(strengths).toEqual([...strengths].sort((a, b) => b - a));
    expect(scatterRelativeToBlue(LIGHT_BANDS[0].nm)).toBeGreaterThan(1);
  });

  it("fills every caption token", () => {
    expect(CAPTIONS.flatMap((c) => c.lines).filter((line) => /[{}]/.test(line))).toEqual([]);
  });

  it("has a valid diagram for every shot that names one", () => {
    for (const shot of SHOT_WINDOWS) if (shot.diagram) expect(validateDiagram(DIAGRAMS[shot.diagram], shot.diagram)).toEqual([]);
  });

  it("lands the song's drop on the sunset", () => {
    expect(spec.shots[6].subject).toContain("sunset");
    expect(barT(12)).toBeCloseTo(SHOT_WINDOWS[6].from, 9);
  });
});
