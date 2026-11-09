// Turns the model's answers into the framework's own formats, and checks them before anything is built.
import { STYLE_FRAMES_PER_BEAT, type SongStyle } from "../../src/core/music/plan";
import { validateSpec, type Fact, type VideoSpec } from "../../src/core/spec";
import { checkCaptionNumbers, checkCaptionTiming } from "../lib/videoChecks";

export const BARS = 18;
const FPS = 30;
const BEATS_PER_BAR = 4;
const HOOK_Y = 290;
const TOKEN_ESTIMATE = "0000";

export type RawFact = { id: string; claim: string; value: number | string | number[]; unit: string | null; confidence: Fact["confidence"]; sources: string[]; note: string | null };

export type Story = {
  title: string;
  description: string;
  question: string;
  palette: string;
  songStyle: SongStyle;
  seed: number;
  shots: { fromBar: number; toBar: number; subject: string; diagram: string | null }[];
  captions: { fromBar: number; toBar: number; big: boolean; lines: string[] }[];
};

export const toFact = ({ unit, note, ...rest }: RawFact): Fact => ({ ...rest, ...(unit ? { unit } : {}), ...(note ? { note } : {}) });

export const assembleSpec = (slug: string, story: Story, facts: Fact[]): VideoSpec => {
  const framesPerBeat = STYLE_FRAMES_PER_BEAT[story.songStyle];
  return {
    version: 1,
    slug,
    title: story.title,
    description: story.description,
    question: story.question,
    kit: "none",
    palette: story.palette,
    format: { fps: FPS, width: 1080, height: 1920, durationS: (BARS * BEATS_PER_BAR * framesPerBeat) / FPS },
    song: { bpm: (60 * FPS) / framesPerBeat, beatsPerBar: BEATS_PER_BAR, bars: BARS, style: story.songStyle === "house" ? "Deep bass house" : "Dubstep", generator: { style: story.songStyle, seed: story.seed } },
    facts,
    shots: story.shots.map((s) => ({ from: { bar: s.fromBar }, to: { bar: s.toBar }, subject: s.subject, ...(s.diagram ? { diagram: s.diagram } : {}) })),
    captions: story.captions.map((c) => ({ from: { bar: c.fromBar }, to: { bar: c.toBar }, lines: c.lines, size: c.big ? ("big" as const) : ("compact" as const), ...(c.big ? { y: HOOK_Y } : {}) })),
  };
};

const placeholderStory = (facts: Fact[]): VideoSpec => ({
  ...assembleSpec("placeholder", { title: "T", description: "D", question: "Q", palette: "science", songStyle: "house", seed: 1, shots: [{ fromBar: 0, toBar: BARS, subject: "S", diagram: null }], captions: [] }, facts),
});

/** Everything wrong with a set of facts, including sources the model never actually saw. */
export const factProblems = (raw: RawFact[], uploads: string[], seenUrls: string[]): string[] => {
  const problems = raw.length < 3 ? ["give at least 3 facts"] : [];
  const facts = raw.map(toFact);
  problems.push(...validateSpec(placeholderStory(facts)).filter((e) => !e.startsWith("shots")));
  const seen = new Set(seenUrls);
  for (const fact of facts) {
    for (const source of fact.sources) {
      if (source.startsWith("upload:")) {
        if (!uploads.includes(source.slice("upload:".length))) problems.push(`${fact.id}: "${source}" isn't one of the uploaded documents`);
      } else if (!seen.has(source)) problems.push(`${fact.id}: "${source}" wasn't returned by a search in this conversation`);
    }
  }
  return problems;
};

/** Everything wrong with a story, in the words the model needs to fix it. */
export const storyProblems = (spec: VideoSpec): string[] => {
  const errors = validateSpec(spec);
  if (errors.length > 0) return errors;
  const beatS = 60 / spec.song.bpm;
  const seconds = (ref: VideoSpec["captions"][number]["from"]) => (typeof ref === "number" ? ref : "bar" in ref ? ref.bar * BEATS_PER_BAR * beatS + (ref.add ?? 0) : ref.beat * beatS + (ref.add ?? 0));
  const estimated = spec.captions.map((c) => ({ from: seconds(c.from), to: seconds(c.to), lines: c.lines.map((l) => l.replace(/\{\w+\}/g, TOKEN_ESTIMATE)) }));
  return [...checkCaptionTiming(estimated, true), ...checkCaptionNumbers(spec, true)].map((f) => f.message);
};
