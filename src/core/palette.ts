// Colours for one video. The palette changes with the type of video; 8-bit is only the rendering style.
import { createContext, useContext } from "react";
import { C, UI } from "./theme";

export type Palette = {
  /** 3D backdrop, floor and contact shadow. */
  background: string;
  floor: string;
  shadow: string;
  /** Colour that out-of-focus models fade towards. */
  fade: string;
  /** Dark fill behind text, and the text and marks drawn on it. */
  ink: string;
  text: string;
  dim: string;
  accent: string;
  alert: string;
  border: string;
  /** Colours for data series, in order of use. */
  series: string[];
};

export const PALETTES: Record<string, Palette> = {
  machines: {
    background: C.bg,
    floor: C.floor,
    shadow: C.shadow,
    fade: "#23254a",
    ink: UI.ink,
    text: UI.cream,
    dim: UI.dim,
    accent: UI.yellow,
    alert: UI.red,
    border: UI.border,
    series: ["#ffe45e", "#4fc3ff", "#ff6a4d", "#6ee7b0", "#a78bff"],
  },
  science: {
    background: "#0b1e3a",
    floor: "#12305a",
    shadow: "#071428",
    fade: "#16365f",
    ink: "#071428",
    text: "#e8f4ff",
    dim: "#8fb3d9",
    accent: "#5ce1ff",
    alert: "#ff7a90",
    border: "#2f6aa8",
    series: ["#5ce1ff", "#ffd166", "#9b8cff", "#7dffb3", "#ff9f6b"],
  },
  nature: {
    background: "#12281c",
    floor: "#1d3d2a",
    shadow: "#0b1a12",
    fade: "#21412e",
    ink: "#0a1710",
    text: "#eef7e4",
    dim: "#93b893",
    accent: "#b7f36b",
    alert: "#ff8a5c",
    border: "#3f7a52",
    series: ["#b7f36b", "#ffd166", "#5cd6c0", "#ff9f6b", "#d9b3ff"],
  },
  history: {
    background: "#2a1c12",
    floor: "#3d2a1b",
    shadow: "#1a110a",
    fade: "#43301f",
    ink: "#1a110a",
    text: "#f5e8d0",
    dim: "#bfa57f",
    accent: "#f2b84b",
    alert: "#e8674f",
    border: "#7a5a36",
    series: ["#f2b84b", "#e8674f", "#8fc1b5", "#d9b38c", "#b79cd9"],
  },
  finance: {
    background: "#0f2420",
    floor: "#173a32",
    shadow: "#08150f",
    fade: "#1b4037",
    ink: "#08151a",
    text: "#eafaf1",
    dim: "#8ab8a6",
    accent: "#4de8a0",
    alert: "#ff6b6b",
    border: "#2e7a62",
    series: ["#4de8a0", "#ff6b6b", "#ffd166", "#5cc8ff", "#c9a6ff"],
  },
  health: {
    background: "#2b1a30",
    floor: "#3f2747",
    shadow: "#190f1d",
    fade: "#452c4d",
    ink: "#160d1a",
    text: "#fdeef4",
    dim: "#c49ab5",
    accent: "#ff8fb8",
    alert: "#ffd166",
    border: "#8a4f7a",
    series: ["#ff8fb8", "#6ee7d8", "#ffd166", "#a9a2ff", "#ff9f6b"],
  },
  space: {
    background: "#0a0820",
    floor: "#1a1440",
    shadow: "#05040f",
    fade: "#1d1745",
    ink: "#05040f",
    text: "#f0ecff",
    dim: "#9d95d6",
    accent: "#c08bff",
    alert: "#ff6ba9",
    border: "#4f3f99",
    series: ["#c08bff", "#5ce1ff", "#ffd166", "#ff6ba9", "#7dffb3"],
  },
};

export const DEFAULT_PALETTE = PALETTES.machines;

export const PaletteContext = createContext<Palette>(DEFAULT_PALETTE);
export const usePalette = () => useContext(PaletteContext);

/** A preset's name, or a full palette. */
export type PaletteRef = string | Palette;

export const resolvePalette = (ref?: PaletteRef): Palette => {
  if (ref === undefined) return DEFAULT_PALETTE;
  if (typeof ref !== "string") return ref;
  const preset = PALETTES[ref];
  if (!preset) throw new Error(`Unknown palette "${ref}"`);
  return preset;
};

const HEX = /^#[0-9a-f]{6}$/i;

const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** "#0d0e1f" at 0.92 -> "rgba(13,14,31,0.92)". */
export const withAlpha = (hex: string, alpha: number) => `rgba(${channels(hex).join(",")},${alpha})`;

const luminance = (hex: string) => {
  const [r, g, b] = channels(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** WCAG contrast ratio, 1 to 21. */
export const contrastRatio = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const MIN_TEXT = 7;
const MIN_LABEL = 4.5;
const MIN_MARK = 3;
const SOLID_KEYS = ["background", "floor", "shadow", "fade", "ink", "text", "dim", "accent", "alert", "border"] as const;

/** Every reason a candidate palette can't be used: bad colours, or text and marks that would be hard to read. */
export const paletteProblems = (raw: unknown): string[] => {
  if (typeof raw !== "object" || raw === null) return ["palette: must be a preset name or a full palette"];
  const p = raw as Palette;
  const problems = SOLID_KEYS.filter((key) => typeof p[key] !== "string" || !HEX.test(p[key])).map((key) => `palette.${key}: must be a colour like #12ab34`);
  if (!Array.isArray(p.series) || p.series.length < 4 || !p.series.every((c) => typeof c === "string" && HEX.test(c))) problems.push("palette.series: needs at least 4 colours like #12ab34");
  if (problems.length > 0) return problems;
  const need = (name: string, color: string, min: number) => {
    if (contrastRatio(color, p.ink) < min) problems.push(`palette.${name}: too little contrast against ink (needs ${min}:1)`);
  };
  need("text", p.text, MIN_TEXT);
  need("dim", p.dim, MIN_LABEL);
  need("accent", p.accent, MIN_LABEL);
  need("alert", p.alert, MIN_MARK);
  p.series.forEach((c, i) => need(`series[${i}]`, c, MIN_MARK));
  return problems;
};
