// The video spec: everything about a video that is data rather than code.
// It is plain JSON, so that a person, a form or an AI can write it, and it is validated every time it loads.
import type { Caption } from "./Captions";
import { validateDiagram, type DiagramSpec } from "./diagrams/spec";
import type { VideoMeta } from "./video";
import { captionFits } from "./layout";
import { validateSongRequest, type SongRequest, type SongSection, type SongStyle } from "./music/plan";
import { DEFAULT_PALETTE, paletteProblems, PALETTES, resolvePalette, type Palette, type PaletteRef } from "./palette";

/** A moment in the video: seconds, or a position on the song's grid plus an offset in seconds. */
export type TimeRef = number | { bar: number; add?: number } | { beat: number; add?: number };

export type Confidence = "primary" | "secondary" | "single-source" | "assumed" | "illustrative";

export type FactValue = number | string | number[];

/** One claim the video relies on. Only assumed and illustrative facts may go without a source. */
export type Fact = { id: string; claim: string; value: FactValue; unit?: string; confidence: Confidence; sources: string[]; note?: string };

/** One shot: a single subject and, optionally, the live diagram shown with it. */
export type Shot = { from: TimeRef; to: TimeRef; subject: string; diagram?: string };

/** Caption text can hold {tokens}, filled from values the video computes from its facts. */
export type SpecCaption = { from: TimeRef; to: TimeRef; lines: string[]; size?: "big" | "small" | "compact"; y?: number };

export type VideoSpec = {
  version: 1;
  slug: string;
  title: string;
  description: string;
  /** The one question the video answers. */
  question: string;
  /** Folder under src/kits that supplies the video's subject-specific models and diagrams. */
  kit: string;
  format: { fps: number; width: number; height: number; durationS: number };
  song: {
    bpm: number;
    beatsPerBar: number;
    bars: number;
    style: string;
    lockedWavSha256?: string;
    /** When set, the song is generated from this rather than written by hand in audio.ts. */
    generator?: { style: SongStyle; seed: number; rootMidi?: number; sections?: SongSection[] };
  };
  /** A preset chosen for the type of video, or a full palette. Leave out for the default. */
  palette?: PaletteRef;
  facts: Fact[];
  shots: Shot[];
  captions: SpecCaption[];
  /** Named general diagrams. A number in one can be written as {"fact": "id"} to read it from the facts. */
  diagrams?: Record<string, unknown>;
};

const SLUG = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const SHA256 = /^[0-9a-f]{64}$/;
const CONFIDENCE: Confidence[] = ["primary", "secondary", "single-source", "assumed", "illustrative"];
const UNSOURCED_OK: Confidence[] = ["assumed", "illustrative"];
const EPSILON = 1e-9;
/** A tempo such as 1800 / 14 can only be written approximately in JSON. */
const FRAME_TOLERANCE = 1e-6;
/** Stands in for a {token} when estimating a caption's width. check-video measures the real text. */
const TOKEN_ESTIMATE = "0000";

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isText = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const isPositive = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;
const isPositiveInt = (v: unknown): v is number => isPositive(v) && Number.isInteger(v);
const isTextList = (v: unknown): v is string[] => Array.isArray(v) && v.every(isText);
const isFactValue = (v: unknown) => (typeof v === "number" && Number.isFinite(v)) || isText(v) || (Array.isArray(v) && v.length > 0 && v.every((n) => typeof n === "number" && Number.isFinite(n)));

const isTimeRef = (v: unknown): v is TimeRef => {
  if (typeof v === "number") return Number.isFinite(v) && v >= 0;
  if (!isRecord(v)) return false;
  const position = "bar" in v ? v.bar : "beat" in v ? v.beat : undefined;
  return typeof position === "number" && Number.isFinite(position) && position >= 0 && (v.add === undefined || (typeof v.add === "number" && Number.isFinite(v.add)));
};

/** Seconds for a time reference. A single division, so grid times match the video's own beat maths exactly. */
export const resolveTime = ({ song }: Pick<VideoSpec, "song">, ref: TimeRef): number => {
  if (typeof ref === "number") return ref;
  const beat = "bar" in ref ? ref.bar * song.beatsPerBar : ref.beat;
  return (beat * 60) / song.bpm + (ref.add ?? 0);
};

type Span = { from: number; to: number; label: string };

/** Checks each window is valid and in the video, and that windows run in order without overlapping. */
const checkSpans = (spans: Span[], durationS: number, errors: string[]) => {
  spans.forEach((s, i) => {
    if (s.from >= s.to) errors.push(`${s.label}: starts at ${s.from}, not before its end at ${s.to}`);
    if (s.from < 0 || s.to > durationS + EPSILON) errors.push(`${s.label}: runs outside the video's ${durationS} s`);
    const next = spans[i + 1];
    if (next && next.from < s.to - EPSILON) errors.push(`${next.label}: starts before ${s.label} ends`);
  });
};

/** A copy of some JSON with every {"fact": "id"} replaced by that fact's value. */
const fillFacts = (spec: VideoSpec, value: unknown): unknown => {
  if (Array.isArray(value)) return value.map((v) => fillFacts(spec, v));
  if (!isRecord(value)) return value;
  const keys = Object.keys(value);
  if (keys.length === 1 && keys[0] === "fact") return findFact(spec, String(value.fact)).value;
  return Object.fromEntries(keys.map((k) => [k, fillFacts(spec, value[k])]));
};

/** Every problem with a candidate spec. An empty list means it is valid. */
export const validateSpec = (raw: unknown): string[] => {
  if (!isRecord(raw)) return ["spec: must be a JSON object"];
  const errors: string[] = [];
  if (raw.version !== 1) errors.push("version: must be 1");
  if (typeof raw.slug !== "string" || !SLUG.test(raw.slug)) errors.push("slug: use lowercase letters, digits and hyphens, starting with a letter");
  for (const key of ["title", "description", "question", "kit"]) if (!isText(raw[key])) errors.push(`${key}: required text`);

  const { format, song } = raw;
  if (!isRecord(format) || !isPositiveInt(format.fps) || !isPositiveInt(format.width) || !isPositiveInt(format.height) || !isPositive(format.durationS)) {
    errors.push("format: needs whole-number fps, width and height, and a positive durationS");
  }
  if (!isRecord(song) || !isPositive(song.bpm) || !isPositiveInt(song.beatsPerBar) || !isPositiveInt(song.bars) || !isText(song.style)) {
    errors.push("song: needs bpm, whole-number beatsPerBar and bars, and a style");
  } else if (song.lockedWavSha256 !== undefined && !(typeof song.lockedWavSha256 === "string" && SHA256.test(song.lockedWavSha256))) {
    errors.push("song.lockedWavSha256: must be a lowercase SHA-256");
  }
  if (!Array.isArray(raw.facts)) errors.push("facts: must be a list");
  if (!Array.isArray(raw.shots) || raw.shots.length === 0) errors.push("shots: needs at least one shot");
  if (!Array.isArray(raw.captions)) errors.push("captions: must be a list");
  if (errors.length > 0) return errors; // the checks below rely on the shape being right

  const spec = raw as unknown as VideoSpec;
  const { fps, durationS } = spec.format;
  const { bpm, beatsPerBar, bars } = spec.song;
  if (!Number.isInteger(durationS * fps)) errors.push("format: durationS must be a whole number of frames");
  if (Math.abs((60 * fps) / bpm - Math.round((60 * fps) / bpm)) > FRAME_TOLERANCE) errors.push(`song: at ${fps} fps, ${bpm} BPM does not put every beat on a whole frame`);
  if (Math.abs((bars * beatsPerBar * 60) / bpm - durationS) > EPSILON) errors.push("song: bars do not add up to format.durationS");

  const seen = new Set<string>();
  spec.facts.forEach((fact, i) => {
    const label = `facts[${i}]`;
    if (!isRecord(fact) || !isText(fact.id)) return void errors.push(`${label}: needs an id`);
    if (seen.has(fact.id)) errors.push(`${label}: duplicate id "${fact.id}"`);
    seen.add(fact.id);
    if (!isText(fact.claim)) errors.push(`${fact.id}: needs a claim`);
    if (!isFactValue(fact.value)) errors.push(`${fact.id}: value must be a number, text or a list of numbers`);
    if (!CONFIDENCE.includes(fact.confidence)) errors.push(`${fact.id}: confidence must be one of ${CONFIDENCE.join(", ")}`);
    if (!isTextList(fact.sources)) errors.push(`${fact.id}: sources must be a list`);
    else if (fact.sources.length === 0 && !UNSOURCED_OK.includes(fact.confidence)) errors.push(`${fact.id}: needs a source, or confidence "assumed" or "illustrative"`);
  });

  if (typeof spec.palette === "string") {
    if (!(spec.palette in PALETTES)) errors.push(`palette: unknown preset "${spec.palette}"; use one of ${Object.keys(PALETTES).join(", ")}, or a full palette`);
  } else if (spec.palette !== undefined) {
    errors.push(...paletteProblems(spec.palette));
  }

  if (spec.song.generator !== undefined) errors.push(...validateSongRequest(specSongRequest(spec)).map((e) => `song.generator.${e}`));

  if (spec.diagrams !== undefined) {
    if (!isRecord(spec.diagrams)) errors.push("diagrams: must be an object of named diagrams");
    else {
      for (const [id, diagram] of Object.entries(spec.diagrams)) {
        try {
          errors.push(...validateDiagram(fillFacts(spec, diagram), `diagrams.${id}`));
        } catch (err) {
          errors.push(`diagrams.${id}: ${(err as Error).message}`);
        }
      }
      spec.shots.forEach((shot, i) => {
        if (shot.diagram !== undefined && !(shot.diagram in (spec.diagrams as object))) errors.push(`shots[${i}]: no diagram named "${shot.diagram}"`);
      });
    }
  }

  const timed = (list: { from: TimeRef; to: TimeRef }[], name: string): Span[] | null => {
    const bad = list.findIndex((item) => !isRecord(item) || !isTimeRef(item.from) || !isTimeRef(item.to));
    if (bad >= 0) {
      errors.push(`${name}[${bad}]: from and to must be seconds, or a bar or beat`);
      return null;
    }
    return list.map((item, i) => ({ from: resolveTime(spec, item.from), to: resolveTime(spec, item.to), label: `${name}[${i}]` }));
  };

  const shotSpans = timed(spec.shots, "shots");
  if (shotSpans) {
    checkSpans(shotSpans, durationS, errors);
    if (Math.abs(shotSpans[0].from) > EPSILON) errors.push("shots: the first shot must start at 0");
    if (Math.abs(shotSpans[shotSpans.length - 1].to - durationS) > EPSILON) errors.push("shots: the last shot must end with the video");
    shotSpans.forEach((s, i) => {
      const next = shotSpans[i + 1];
      if (next && Math.abs(next.from - s.to) > EPSILON) errors.push(`${next.label}: must start where ${s.label} ends`);
    });
    spec.shots.forEach((shot, i) => {
      if (!isText(shot.subject)) errors.push(`shots[${i}]: needs a subject`);
    });
  }

  const captionSpans = timed(spec.captions, "captions");
  if (captionSpans) checkSpans(captionSpans, durationS, errors);
  spec.captions.forEach((caption, i) => {
    if (!isRecord(caption) || !isTextList(caption.lines) || caption.lines.length === 0) errors.push(`captions[${i}]: needs at least one line of text`);
    else if (caption.size === "compact" && !captionFits(caption.lines.map((line) => line.replace(/\{\w+\}/g, TOKEN_ESTIMATE)))) errors.push(`captions[${i}]: too long for the caption region`);
  });
  return errors;
};

/** Validates raw JSON and returns it as a spec, or throws with every problem listed. */
export const loadSpec = (raw: unknown): VideoSpec => {
  const errors = validateSpec(raw);
  if (errors.length > 0) throw new Error(`Invalid video spec:\n  ${errors.join("\n  ")}`);
  return raw as VideoSpec;
};

export const specToMeta = ({ slug, title, description, format }: VideoSpec): VideoMeta => ({ slug, title, description, ...format });

const findFact = (spec: VideoSpec, id: string): Fact => {
  const fact = spec.facts.find((f) => f.id === id);
  if (!fact) throw new Error(`Spec "${spec.slug}" has no fact "${id}"`);
  return fact;
};

/** The song generator's request, with its tempo and length taken from the spec. Only valid when the spec has a generator. */
export const specSongRequest = (spec: VideoSpec): SongRequest => {
  const { generator, bpm, bars } = spec.song;
  if (!generator) throw new Error(`Spec "${spec.slug}" has no song generator`);
  return { ...generator, fps: spec.format.fps, framesPerBeat: Math.round((60 * spec.format.fps) / bpm), bars };
};

/** The video's palette. */
export const specPalette = (spec: VideoSpec): Palette => (spec.palette === undefined ? DEFAULT_PALETTE : resolvePalette(spec.palette));

/** A named diagram with its facts filled in. */
export const specDiagram = (spec: VideoSpec, id: string): DiagramSpec => {
  const diagram = spec.diagrams?.[id];
  if (diagram === undefined) throw new Error(`Spec "${spec.slug}" has no diagram "${id}"`);
  return fillFacts(spec, diagram) as DiagramSpec;
};

export const numberFact = (spec: VideoSpec, id: string): number => {
  const { value } = findFact(spec, id);
  if (typeof value !== "number") throw new Error(`Fact "${id}" is not a number`);
  return value;
};

export const listFact = (spec: VideoSpec, id: string): number[] => {
  const { value } = findFact(spec, id);
  if (!Array.isArray(value)) throw new Error(`Fact "${id}" is not a list of numbers`);
  return value;
};

/** Timed captions with every {token} filled in. Throws on a missing or unused value, so text can't silently go wrong. */
export const resolveCaptions = (spec: VideoSpec, values: Record<string, string | number>, time: (ref: TimeRef) => number = (ref) => resolveTime(spec, ref)): Caption[] => {
  const used = new Set<string>();
  const fill = (line: string) =>
    line.replace(/\{(\w+)\}/g, (_, token: string) => {
      if (!(token in values)) throw new Error(`Spec "${spec.slug}": caption token {${token}} has no value`);
      used.add(token);
      return String(values[token]);
    });
  const captions = spec.captions.map(({ from, to, lines, size, y }) => ({
    from: time(from),
    to: time(to),
    lines: lines.map(fill),
    ...(size === undefined ? {} : { size }),
    ...(y === undefined ? {} : { y }),
  }));
  const unused = Object.keys(values).filter((token) => !used.has(token));
  if (unused.length > 0) throw new Error(`Spec "${spec.slug}": values never used in a caption: ${unused.join(", ")}`);
  return captions;
};
