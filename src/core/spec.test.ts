import { describe, expect, it } from "vitest";
import { listFact, loadSpec, numberFact, resolveCaptions, resolveTime, specToMeta, validateSpec, type VideoSpec } from "./spec";

const valid = (): VideoSpec => ({
  version: 1,
  slug: "demo-video",
  title: "Demo",
  description: "A demo.",
  question: "Does it work?",
  kit: "demo",
  format: { fps: 30, width: 1080, height: 1920, durationS: 8 },
  song: { bpm: 150, beatsPerBar: 4, bars: 5, style: "Test" },
  facts: [
    { id: "count", claim: "A count", value: 3, confidence: "primary", sources: ["https://example.com/a"] },
    { id: "order", claim: "An order", value: [1, 2], confidence: "assumed", sources: [] },
  ],
  shots: [
    { from: 0, to: { bar: 2 }, subject: "First" },
    { from: { bar: 2 }, to: { bar: 5 }, subject: "Second", diagram: "chart" },
  ],
  captions: [
    { from: 0.25, to: { bar: 1, add: -0.1 }, lines: ["{count} THINGS"], size: "big", y: 300 },
    { from: { beat: 4 }, to: { bar: 2 }, lines: ["NO TOKENS"] },
  ],
});

const errorsAfter = (change: (spec: VideoSpec) => void) => {
  const spec = valid();
  change(spec);
  return validateSpec(spec).join("\n");
};

describe("validateSpec", () => {
  it("accepts a valid spec, and survives a JSON round trip", () => {
    expect(validateSpec(valid())).toEqual([]);
    expect(validateSpec(JSON.parse(JSON.stringify(valid())))).toEqual([]);
  });

  it("rejects things that are not specs", () => {
    expect(validateSpec(null)).not.toEqual([]);
    expect(validateSpec([])).not.toEqual([]);
    expect(validateSpec({})).not.toEqual([]);
  });

  it("requires a tempo that lands on whole frames", () => {
    expect(errorsAfter((s) => void (s.song.bpm = 140))).toContain("whole frame");
  });

  it("requires the bars to fill the video", () => {
    expect(errorsAfter((s) => void (s.song.bars = 4))).toContain("add up");
  });

  it("requires a source unless a fact is marked assumed or illustrative", () => {
    expect(errorsAfter((s) => void (s.facts[0].sources = []))).toContain("needs a source");
    const unsourced = errorsAfter((s) => {
      s.facts[0].sources = [];
      s.facts[0].confidence = "illustrative";
    });
    expect(unsourced).toBe("");
  });

  it("rejects duplicate facts and unknown confidence levels", () => {
    expect(errorsAfter((s) => void (s.facts[1].id = "count"))).toContain("duplicate");
    expect(errorsAfter((s) => void (s.facts[0].confidence = "vibes" as "primary"))).toContain("confidence");
  });

  it("requires shots to cover the whole video without gaps", () => {
    expect(errorsAfter((s) => void (s.shots[1].from = { bar: 3 }))).toContain("must start where");
    expect(errorsAfter((s) => void (s.shots[1].to = { bar: 4 }))).toContain("must end with the video");
    expect(errorsAfter((s) => void (s.shots[0].from = 1))).toContain("must start at 0");
  });

  it("rejects overlapping and out-of-range captions", () => {
    expect(errorsAfter((s) => void (s.captions[1].from = 0.5))).toContain("starts before");
    expect(errorsAfter((s) => void (s.captions[1].to = 99))).toContain("outside");
  });

  it("rejects bad time references and empty captions", () => {
    expect(errorsAfter((s) => void (s.captions[0].from = { bar: -1 }))).toContain("from and to");
    expect(errorsAfter((s) => void (s.captions[0].lines = []))).toContain("at least one line");
  });
});

describe("spec helpers", () => {
  it("resolves seconds, bars, beats and offsets", () => {
    const spec = valid();
    expect(resolveTime(spec, 1.5)).toBe(1.5);
    expect(resolveTime(spec, { bar: 2 })).toBe(3.2);
    expect(resolveTime(spec, { beat: 5 })).toBe(2);
    expect(resolveTime(spec, { bar: 1, add: -0.1 })).toBe(1.6 - 0.1);
  });

  it("derives metadata from the spec", () => {
    expect(specToMeta(valid())).toEqual({ slug: "demo-video", title: "Demo", description: "A demo.", fps: 30, durationS: 8, width: 1080, height: 1920 });
  });

  it("reads facts by type and refuses the wrong type", () => {
    const spec = valid();
    expect(numberFact(spec, "count")).toBe(3);
    expect(listFact(spec, "order")).toEqual([1, 2]);
    expect(() => numberFact(spec, "order")).toThrow("not a number");
    expect(() => listFact(spec, "count")).toThrow("not a list");
    expect(() => numberFact(spec, "missing")).toThrow("no fact");
  });

  it("fills caption tokens, and leaves out unset optional fields", () => {
    const [first, second] = resolveCaptions(valid(), { count: 3 });
    expect(first).toEqual({ from: 0.25, to: 1.6 - 0.1, lines: ["3 THINGS"], size: "big", y: 300 });
    expect(Object.keys(second)).toEqual(["from", "to", "lines"]);
  });

  it("throws on missing and unused caption values", () => {
    expect(() => resolveCaptions(valid(), {})).toThrow("{count}");
    expect(() => resolveCaptions(valid(), { count: 3, extra: 1 })).toThrow("extra");
  });

  it("loadSpec lists every problem", () => {
    const bad = valid();
    bad.title = "";
    bad.song.style = "";
    expect(() => loadSpec(bad)).toThrow(/title[\s\S]*song/);
  });
});
