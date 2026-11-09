import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { encodeWav } from "../audio";
import { loadSpec, specSongRequest, validateSpec, type VideoSpec } from "../spec";
import { BEATS_PER_BAR, defaultSections, planSong, songHits, STYLE_FRAMES_PER_BEAT, validateSongRequest, type SongRequest, type SongStyle } from "./plan";
import { renderSong } from "./render";

const request = (style: SongStyle, seed = 1, bars = 18): SongRequest => ({ style, seed, fps: 30, framesPerBeat: STYLE_FRAMES_PER_BEAT[style], bars });
const STYLES: SongStyle[] = ["house", "dubstep"];

describe.each(STYLES)("%s song plan", (style) => {
  const plan = planSong(request(style));

  it("puts every beat on a whole video frame", () => {
    expect(plan.beatS * plan.fps).toBeCloseTo(STYLE_FRAMES_PER_BEAT[style], 9);
  });

  it("fills the requested length", () => {
    expect(plan.durationS).toBeCloseTo((18 * BEATS_PER_BAR * STYLE_FRAMES_PER_BEAT[style]) / 30, 9);
    expect(plan.sections.reduce((sum, s) => sum + s.bars, 0)).toBe(18);
  });

  it("keeps every event inside the song", () => {
    const lastBeat = 18 * BEATS_PER_BAR;
    for (const list of [plan.kicks, plan.backbeats, plan.rolls, plan.hats, plan.sub, plan.bass, plan.stabs, plan.lead]) {
      for (const e of list) {
        expect(e.beat).toBeGreaterThanOrEqual(0);
        expect(e.beat).toBeLessThan(lastBeat);
      }
    }
  });

  it("is bass-register: the sub stays low", () => {
    for (const s of plan.sub.filter((x) => x.fromMidi === undefined)) expect(s.midi).toBeLessThanOrEqual(plan.rootMidi + 12);
  });

  it("has an impact at the start of its drop", () => {
    const drop = plan.sections.find((s) => s.kind === "drop");
    expect(plan.impacts).toEqual([(drop?.fromBar ?? -1) * BEATS_PER_BAR]);
  });

  it("leaves silence on the beat before the drop, so the drop lands harder", () => {
    const dropBeat = plan.impacts[0];
    const before = (e: { beat: number }) => e.beat >= dropBeat - 1 && e.beat < dropBeat;
    expect([...plan.rolls.filter(before), ...plan.kicks.filter(before), ...plan.backbeats.filter(before)]).toEqual([]);
  });

  it("gives song-map sorted hits in seconds", () => {
    const { KICKS, STABS, IMPACTS } = songHits(plan);
    expect(KICKS.length).toBeGreaterThan(10);
    expect(STABS.length).toBeGreaterThan(0);
    expect(IMPACTS).toEqual([plan.impacts[0] * plan.beatS]);
    expect(KICKS).toEqual([...KICKS].sort((a, b) => a - b));
    expect(STABS).toEqual([...STABS].sort((a, b) => a - b));
  });

  it("plans the same song from the same seed", () => {
    expect(planSong(request(style))).toEqual(plan);
  });

  it("makes different songs from different seeds", () => {
    const fingerprints = Array.from({ length: 20 }, (_, seed) => {
      const p = planSong(request(style, seed));
      return JSON.stringify([p.rootMidi, p.bass.map((b) => [b.beat, b.midi])]);
    });
    expect(new Set(fingerprints).size).toBeGreaterThanOrEqual(18);
    expect(new Set(Array.from({ length: 20 }, (_, seed) => planSong(request(style, seed)).rootMidi)).size).toBeGreaterThanOrEqual(3);
  });

  it("renders identical samples every time, and different ones for another seed", () => {
    const hash = (seed: number) => createHash("sha256").update(encodeWav(renderSong(planSong(request(style, seed, 8))))).digest("hex");
    expect(hash(5)).toBe(hash(5));
    expect(hash(5)).not.toBe(hash(6));
  });

  it("stays within full scale", () => {
    const audio = renderSong(planSong(request(style, 2, 8)));
    let peak = 0;
    for (let i = 0; i < audio.L.length; i++) peak = Math.max(peak, Math.abs(audio.L[i] * audio.norm), Math.abs(audio.R[i] * audio.norm));
    expect(peak).toBeCloseTo(0.92, 3);
    expect(Number.isFinite(audio.norm)).toBe(true);
  });
});

describe("structure", () => {
  it("adds up at any supported length", () => {
    for (let bars = 8; bars <= 40; bars++) {
      expect(defaultSections(bars).reduce((sum, s) => sum + s.bars, 0)).toBe(bars);
      expect(defaultSections(bars).every((s) => s.bars > 0)).toBe(true);
    }
  });

  it("lets a video place its own drop", () => {
    const plan = planSong({ ...request("dubstep", 1, 12), sections: [{ kind: "groove", bars: 6 }, { kind: "build", bars: 2 }, { kind: "drop", bars: 4 }] });
    expect(plan.impacts).toEqual([8 * BEATS_PER_BAR]);
  });

  const bad: [string, Partial<SongRequest>, string][] = [
    ["unknown style", { ...request("house"), style: "polka" as SongStyle }, "style"],
    ["too short", request("house", 1, 4), "bars"],
    ["fractional seed", { ...request("house"), seed: 1.5 }, "seed"],
    ["root out of range", { ...request("house"), rootMidi: 60 }, "rootMidi"],
    ["sections that don't add up", { ...request("house", 1, 12), sections: [{ kind: "drop", bars: 4 }] }, "add up"],
    ["no drop", { ...request("house", 1, 8), sections: [{ kind: "groove", bars: 8 }] }, "needs a drop"],
    ["ending on a build", { ...request("house", 1, 8), sections: [{ kind: "drop", bars: 6 }, { kind: "build", bars: 2 }] }, "end on a build"],
    ["unknown section", { ...request("house", 1, 8), sections: [{ kind: "chorus" as "drop", bars: 8 }] }, "kind"],
  ];
  it.each(bad)("rejects %s", (_, r, message) => {
    expect(validateSongRequest(r).join("\n")).toContain(message);
    expect(() => planSong(r as SongRequest)).toThrow();
  });
});

describe("generated songs in a spec", () => {
  const spec = (): VideoSpec => ({
    version: 1,
    slug: "demo",
    title: "D",
    description: "D",
    question: "Q",
    kit: "demo",
    format: { fps: 30, width: 1080, height: 1920, durationS: 33.6 },
    song: { bpm: (60 * 30) / 14, beatsPerBar: 4, bars: 18, style: "Deep bass house", generator: { style: "house", seed: 4 } },
    facts: [],
    shots: [{ from: 0, to: 33.6, subject: "S" }],
    captions: [],
  });

  it("accepts a tempo written out from whole frames", () => {
    expect(validateSpec(spec())).toEqual([]);
  });

  it("derives the request from the spec's own format and tempo", () => {
    expect(specSongRequest(loadSpec(spec()))).toEqual({ style: "house", seed: 4, fps: 30, framesPerBeat: 14, bars: 18 });
  });

  it("passes through a chosen key and structure", () => {
    const s = spec();
    s.song.generator = { style: "house", seed: 4, rootMidi: 27, sections: defaultSections(18) };
    expect(specSongRequest(loadSpec(s))).toMatchObject({ rootMidi: 27, sections: defaultSections(18) });
  });

  it("reports a bad generator", () => {
    const s = spec();
    s.song.generator = { style: "polka" as SongStyle, seed: 4 };
    expect(validateSpec(s).join()).toContain("song.generator");
  });

  it("still rejects a tempo off the frame grid", () => {
    const s = spec();
    s.song.bpm = 140;
    expect(validateSpec(s).join()).toContain("whole frame");
  });
});
