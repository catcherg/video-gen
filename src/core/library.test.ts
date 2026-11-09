import { describe, expect, it } from "vitest";
import { flowCharsPerLine, timelineCharsPerLine, validateDiagram, type DiagramSpec } from "./diagrams/spec";
import { captionFits, FRAME, rectIsSafe, REGIONS, SAFE, wrapWords } from "./layout";
import { countUp, easeOutBack, fadeWindow, hitPulse, noise, popIn, progress, shake, snap, spring, staggered, track, typedChars } from "./motion";
import { contrastRatio, DEFAULT_PALETTE, paletteProblems, PALETTES, resolvePalette, withAlpha } from "./palette";
import { loadSpec, specDiagram, specPalette, validateSpec, type VideoSpec } from "./spec";

describe("palettes", () => {
  it.each(Object.keys(PALETTES))("%s is readable", (name) => {
    expect(paletteProblems(PALETTES[name])).toEqual([]);
  });

  it("measures contrast", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#123456", "#123456")).toBe(1);
  });

  it("rejects bad colours and unreadable text", () => {
    expect(paletteProblems({ ...DEFAULT_PALETTE, ink: "navy" }).join()).toContain("palette.ink");
    expect(paletteProblems({ ...DEFAULT_PALETTE, text: DEFAULT_PALETTE.ink }).join()).toContain("palette.text");
    expect(paletteProblems({ ...DEFAULT_PALETTE, series: ["#ffffff"] }).join()).toContain("palette.series");
  });

  it("resolves names and full palettes, and keeps the original overlay colour string", () => {
    expect(resolvePalette()).toBe(DEFAULT_PALETTE);
    expect(resolvePalette("history")).toBe(PALETTES.history);
    expect(() => resolvePalette("nope")).toThrow("Unknown");
    expect(withAlpha(DEFAULT_PALETTE.ink, 0.92)).toBe("rgba(13,14,31,0.92)");
  });
});

describe("layout", () => {
  it.each(Object.keys(REGIONS) as (keyof typeof REGIONS)[])("%s is inside the safe zone", (name) => {
    expect(rectIsSafe(REGIONS[name])).toBe(true);
  });

  it("rejects rectangles in the platform overlays", () => {
    expect(rectIsSafe({ x: 120, y: 200, w: 100, h: 100 })).toBe(false);
    expect(rectIsSafe({ x: 120, y: 1200, w: 100, h: 100 })).toBe(false);
    expect(rectIsSafe({ x: 40, y: 500, w: 100, h: 100 })).toBe(false);
    expect(rectIsSafe({ x: 800, y: 900, w: 150, h: 100 })).toBe(false);
    expect(rectIsSafe({ x: 800, y: 500, w: 150, h: 100 })).toBe(true);
  });

  it("keeps regions in order without overlapping", () => {
    const { title, subject, panel, caption } = REGIONS;
    expect(title.y + title.h).toBeLessThanOrEqual(subject.y);
    expect(subject.y + subject.h).toBeLessThanOrEqual(panel.y);
    expect(panel.y + panel.h).toBeLessThanOrEqual(caption.y);
    expect(caption.y + caption.h).toBeLessThanOrEqual(SAFE.bottom);
    expect(SAFE.bottom).toBeLessThan(FRAME.h);
  });

  it("knows which captions fit", () => {
    expect(captionFits(["BLUE LIGHT SCATTERS", "ABOUT FOUR TIMES MORE"])).toBe(true);
    expect(captionFits(["ONE", "TWO", "THREE"])).toBe(false);
    expect(captionFits(["THIS LINE IS FAR TOO LONG TO FIT INSIDE THE CAPTION REGION"])).toBe(false);
  });

  it("wraps words", () => {
    expect(wrapWords("ONE TWO THREE", 7)).toEqual(["ONE TWO", "THREE"]);
    expect(wrapWords("EXTRAORDINARY A", 4)).toEqual(["EXTRAORDINARY", "A"]);
  });
});

describe("motion", () => {
  it("clamps progress and fades windows", () => {
    expect(progress(-1, 0, 1)).toBe(0);
    expect(progress(2, 0, 1)).toBe(1);
    expect(fadeWindow(1, 0, 2)).toBe(1);
    expect(fadeWindow(0, 0, 2)).toBe(0);
  });

  it("pops in and settles", () => {
    expect(popIn(0.9, 1)).toBe(0);
    expect(easeOutBack(1)).toBeCloseTo(1, 9);
    expect(popIn(5, 1)).toBeCloseTo(1, 9);
  });

  it("staggers items in order and finishes them all", () => {
    expect(staggered(0.3, 0, 3)).toBeGreaterThan(staggered(0.3, 2, 3));
    expect(staggered(1, 2, 3)).toBe(1);
    expect(staggered(1, 0, 1)).toBe(1);
  });

  it("punches on the latest hit and only after it", () => {
    expect(hitPulse(0.5, [1, 2])).toBe(0);
    expect(hitPulse(1, [1, 2])).toBe(1);
    expect(hitPulse(1.5, [1, 2])).toBeLessThan(hitPulse(1.1, [1, 2]));
    expect(hitPulse(2, [1, 2])).toBe(1);
  });

  it("settles a spring at 1", () => {
    expect(spring(0, 1)).toBe(0);
    expect(spring(20, 1)).toBeCloseTo(1, 6);
  });

  it("follows and holds a track", () => {
    const keys = [{ t: 1, v: 10 }, { t: 2, v: 20 }];
    expect(track(0, keys)).toBe(10);
    expect(track(1.5, keys)).toBeCloseTo(15, 9);
    expect(track(3, keys)).toBe(20);
  });

  it("is repeatable", () => {
    expect(noise(3.3, 7)).toBe(noise(3.3, 7));
    expect(noise(3.3, 7)).not.toBe(noise(3.3, 8));
    expect(Math.abs(noise(3.3, 7))).toBeLessThanOrEqual(1);
    expect(shake(1.05, [1], 10, 3)).toBe(shake(1.05, [1], 10, 3));
    expect(shake(0.5, [1], 10, 3)).toBe(0);
  });

  it("counts, types and snaps", () => {
    expect(countUp(5, 0, 1, 0, 100)).toBe(100);
    expect(typedChars("ABC", 0, 1)).toBe(0);
    expect(typedChars("ABC", 9, 1)).toBe(3);
    expect(snap(9)).toBe(8);
  });
});

describe("diagrams", () => {
  const good: DiagramSpec[] = [
    { type: "bar", title: "A", bars: [{ label: "X", value: 1 }] },
    { type: "line", title: "A", series: [{ label: "X", points: [[0, 1], [1, 2]] }] },
    { type: "timeline", title: "A", events: [{ when: "1", label: "X" }, { when: "2", label: "Y" }] },
    { type: "flow", title: "A", steps: ["X", "Y"] },
    { type: "comparison", title: "A", left: "L", right: "R", rows: [{ label: "X", left: "1", right: "2" }] },
    { type: "map", title: "A", rows: ["##", ".."], markers: [{ col: 0, row: 0, label: "M" }], route: [[0, 0], [1, 1]] },
  ];
  it.each(good.map((d) => [d.type, d] as const))("accepts %s", (_, d) => {
    expect(validateDiagram(d)).toEqual([]);
  });

  const bad: [string, unknown, string][] = [
    ["unknown type", { type: "pie", title: "A" }, "type"],
    ["missing title", { type: "flow", steps: ["X", "Y"] }, "title"],
    ["too many bars", { type: "bar", title: "A", bars: Array(6).fill({ label: "X", value: 1 }) }, "bars"],
    ["negative value", { type: "bar", title: "A", bars: [{ label: "X", value: -1 }] }, "value"],
    ["all-zero bars", { type: "bar", title: "A", bars: [{ label: "X", value: 0 }] }, "above zero"],
    ["long label", { type: "bar", title: "A", bars: [{ label: "A VERY LONG BAR LABEL", value: 1 }] }, "longer"],
    ["x going backwards", { type: "line", title: "A", series: [{ label: "X", points: [[1, 1], [0, 2]] }] }, "increase"],
    ["one step", { type: "flow", title: "A", steps: ["X"] }, "steps"],
    ["a word too long for a step", { type: "flow", title: "A", steps: ["ONE", "TWO", "THREE", "FOUR", "PHOTOSYNTHESIS"] }, "word longer"],
    ["ragged map", { type: "map", title: "A", rows: ["##", "#"] }, "same length"],
    ["marker off the map", { type: "map", title: "A", rows: ["##", ".."], markers: [{ col: 9, row: 0, label: "M" }] }, "off the map"],
    ["route off the map", { type: "map", title: "A", rows: ["##", ".."], route: [[0, 0], [5, 5]] }, "off the map"],
  ];
  it.each(bad)("rejects %s", (_, raw, message) => {
    expect(validateDiagram(raw).join("\n")).toContain(message);
  });

  it("narrows wrapped columns as items are added", () => {
    expect(flowCharsPerLine(5)).toBeLessThan(flowCharsPerLine(2));
    expect(timelineCharsPerLine(5)).toBeLessThan(timelineCharsPerLine(2));
  });
});

describe("spec palettes and diagrams", () => {
  const base = (): VideoSpec => ({
    version: 1,
    slug: "demo",
    title: "D",
    description: "D",
    question: "Q",
    kit: "demo",
    format: { fps: 30, width: 1080, height: 1920, durationS: 8 },
    song: { bpm: 150, beatsPerBar: 4, bars: 5, style: "S" },
    facts: [{ id: "n", claim: "N", value: 3, confidence: "primary", sources: ["a"] }],
    shots: [{ from: 0, to: 8, subject: "S", diagram: "chart" }],
    captions: [],
    diagrams: { chart: { type: "bar", title: "T", bars: [{ label: "X", value: { fact: "n" } }] } },
  });

  it("fills diagram numbers from the facts", () => {
    const diagram = specDiagram(loadSpec(base()), "chart");
    expect(diagram.type === "bar" && diagram.bars[0].value).toBe(3);
  });

  it("reports a diagram that names a missing fact", () => {
    const spec = base();
    spec.diagrams = { chart: { type: "bar", title: "T", bars: [{ label: "X", value: { fact: "missing" } }] } };
    expect(validateSpec(spec).join("\n")).toContain("missing");
  });

  it("reports an invalid diagram and a shot naming an unknown one", () => {
    const spec = base();
    spec.diagrams = { other: { type: "pie", title: "T" } };
    const errors = validateSpec(spec).join("\n");
    expect(errors).toContain("diagrams.other");
    expect(errors).toContain('no diagram named "chart"');
  });

  it("picks a palette by name or in full, and rejects bad ones", () => {
    const spec = base();
    expect(specPalette(spec)).toBe(DEFAULT_PALETTE);
    spec.palette = "space";
    expect(specPalette(spec)).toBe(PALETTES.space);
    spec.palette = "nope";
    expect(validateSpec(spec).join()).toContain("unknown preset");
    spec.palette = { ...PALETTES.space, text: PALETTES.space.ink };
    expect(validateSpec(spec).join()).toContain("palette.text");
  });

  it("rejects a compact caption too long for its region", () => {
    const spec = base();
    spec.captions = [{ from: 0, to: 1, lines: ["THIS LINE IS FAR TOO LONG TO FIT INSIDE THE CAPTION REGION"], size: "compact" }];
    expect(validateSpec(spec).join()).toContain("too long");
  });
});
