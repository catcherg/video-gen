// The checks that replace reviewing frames by eye. Each is a pure function over measurements, so it can be tested.
// They can't judge whether a shot explains its idea, or whether a label points at the right thing. A person still does that.
import type { Caption } from "../../src/core/Captions";
import { typingSeconds } from "../../src/core/Captions";
import { rectIsSafe, SAFE } from "../../src/core/layout";
import type { VideoSpec } from "../../src/core/spec";

export type Severity = "error" | "warning";
export type Finding = { check: string; severity: Severity; frame?: number; message: string };

export type AuditBox = { kind: string; text: string; x: number; y: number; w: number; h: number };
export type AuditText = AuditBox & { card: number };
export type AuditLeader = { x1: number; y1: number; x2: number; y2: number };
export type AuditReport = { frame: number; width: number; height: number; fontsReady: boolean; boxes: AuditBox[]; texts: AuditText[]; leaders: AuditLeader[] };

/** Overlaps shallower than this are rounding, not a collision. */
const MIN_OVERLAP_DEPTH_PX = 2;
const EDGE_TOLERANCE_PX = 1;
/** The safe zones are estimates from conflicting guides, so a couple of pixels over isn't a failure. */
const SAFE_TOLERANCE_PX = 2;
/** Boxes that must keep clear of the platform's buttons and captions. */
const SAFE_KINDS = new Set(["caption", "headline", "diagram", "label"]);
/** Seconds a caption must stay complete after it finishes typing. A few words need less than two full lines. */
export const minCaptionHoldS = (chars: number) => Math.min(0.3, 0.1 + 0.01 * chars);

const overlaps = (a: AuditBox, b: AuditBox) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > MIN_OVERLAP_DEPTH_PX && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > MIN_OVERLAP_DEPTH_PX;

const inside = (inner: AuditBox, outer: AuditBox) =>
  inner.x >= outer.x - EDGE_TOLERANCE_PX && inner.y >= outer.y - EDGE_TOLERANCE_PX && inner.x + inner.w <= outer.x + outer.w + EDGE_TOLERANCE_PX && inner.y + inner.h <= outer.y + outer.h + EDGE_TOLERANCE_PX;

const shrink = (b: AuditBox, px: number): AuditBox => ({ ...b, x: b.x + px, y: b.y + px, w: b.w - 2 * px, h: b.h - 2 * px });

const describe = (b: AuditBox) => `${b.kind} "${b.text.slice(0, 32)}"`;

/** True when the segment touches the rectangle. */
const segmentHitsBox = ({ x1, y1, x2, y2 }: AuditLeader, b: AuditBox) => {
  let t0 = 0;
  let t1 = 1;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const clip = (p: number, q: number) => {
    if (p === 0) return q >= 0;
    const r = q / p;
    if (p < 0) {
      if (r > t1) return false;
      t0 = Math.max(t0, r);
    } else {
      if (r < t0) return false;
      t1 = Math.min(t1, r);
    }
    return true;
  };
  return clip(-dx, x1 - b.x) && clip(dx, b.x + b.w - x1) && clip(-dy, y1 - b.y) && clip(dy, b.y + b.h - y1);
};

const segmentsCross = (a: AuditLeader, b: AuditLeader) => {
  const side = (px: number, py: number, s: AuditLeader) => (s.x2 - s.x1) * (py - s.y1) - (s.y2 - s.y1) * (px - s.x1);
  return side(a.x1, a.y1, b) * side(a.x2, a.y2, b) < 0 && side(b.x1, b.y1, a) * side(b.x2, b.y2, a) < 0;
};

/** Everything wrong with where things landed on one frame. Videos that predate the safe zones only get warnings for it. */
export const auditLayout = (report: AuditReport, strict: boolean): Finding[] => {
  const findings: Finding[] = [];
  const { frame, width, height, boxes, texts, leaders } = report;
  const layoutSeverity: Severity = strict ? "error" : "warning";
  const add = (check: string, severity: Severity, message: string) => findings.push({ check, severity, frame, message });

  if (!report.fontsReady) add("fonts", "error", "the pixel fonts had not loaded when the frame was measured");
  for (const b of boxes) {
    if (b.x < -EDGE_TOLERANCE_PX || b.y < -EDGE_TOLERANCE_PX || b.x + b.w > width + EDGE_TOLERANCE_PX || b.y + b.h > height + EDGE_TOLERANCE_PX) add("off-frame", "error", `${describe(b)} runs off the frame`);
    else if (SAFE_KINDS.has(b.kind) && !rectIsSafe({ x: Math.ceil(b.x) + SAFE_TOLERANCE_PX, y: Math.ceil(b.y) + SAFE_TOLERANCE_PX, w: Math.floor(b.w) - 2 * SAFE_TOLERANCE_PX, h: Math.floor(b.h) - 2 * SAFE_TOLERANCE_PX })) add("safe-zone", layoutSeverity, `${describe(b)} is outside the safe zone`);
  }
  boxes.forEach((a, i) =>
    boxes.slice(i + 1).forEach((b) => {
      if (overlaps(a, b)) add("overlap", layoutSeverity, `${describe(a)} overlaps ${describe(b)}`);
    }),
  );
  texts.forEach((t, i) => {
    const card = boxes[t.card];
    if (card && !inside(t, card)) add("clipped-text", layoutSeverity, `"${t.text}" spills out of its diagram`);
    texts.slice(i + 1).forEach((o) => {
      if (o.card === t.card && overlaps(t, o)) add("text-collision", layoutSeverity, `"${t.text}" collides with "${o.text}"`);
    });
  });
  leaders.forEach((l, i) => {
    if (l.y2 <= SAFE.top || l.x2 < 0 || l.x2 > width || l.y2 > height) add("leader-target", layoutSeverity, "a leader line ends at the edge of the safe zone, so its target is probably off screen");
    for (const b of boxes) {
      const ownLabel = b.kind === "label" && Math.hypot(Math.max(b.x - l.x1, 0, l.x1 - b.x - b.w), Math.max(b.y - l.y1, 0, l.y1 - b.y - b.h)) <= 2;
      if (!ownLabel && segmentHitsBox(l, shrink(b, 2))) add("leader-crossing", layoutSeverity, `a leader line crosses ${describe(b)}`);
    }
    leaders.slice(i + 1).forEach((o) => {
      if (segmentsCross(l, o)) add("leader-crossing", layoutSeverity, "two leader lines cross");
    });
  });
  return findings;
};

/** Captions that finish typing too late to be read. */
export const checkCaptionTiming = (captions: Caption[], strict: boolean): Finding[] =>
  captions.flatMap((c) => {
    const hold = c.to - c.from - typingSeconds(c.lines);
    return hold >= minCaptionHoldS(c.lines.join("").length) ? [] : [{ check: "caption-time", severity: strict ? ("error" as const) : ("warning" as const), message: `"${c.lines.join(" / ")}" is only complete for ${hold.toFixed(2)} s` }];
  });

const NUMBER = /\d[\d,]*(?:\.\d+)?/g;

/** Every number typed into a caption must match a fact. Numbers that arrive through {tokens} are computed, so they're fine. */
export const checkCaptionNumbers = (spec: VideoSpec, strict: boolean): Finding[] => {
  const known = spec.facts.flatMap((f) => (typeof f.value === "number" ? [f.value] : Array.isArray(f.value) ? f.value : []));
  const matches = (n: number) => known.includes(n) || (n < 100 && known.some((k) => k >= 1000 && k % 100 === n));
  return spec.captions.flatMap((c) =>
    c.lines.flatMap((line) =>
      (line.replace(/\{\w+\}/g, "").match(NUMBER) ?? [])
        .filter((text) => !matches(Number(text.replaceAll(",", ""))))
        .map((text) => ({ check: "caption-number", severity: strict ? ("error" as const) : ("warning" as const), message: `"${text}" in "${line}" isn't one of the facts` })),
    ),
  );
};

/** One frame near the end of each caption, once it is fully typed, and the middle of each shot. */
export const pickFrames = (durationFrames: number, fps: number, captions: Caption[], shots: { from: number; to: number }[], uniform = 12, limit = 40) => {
  const times = [...captions.map((c) => c.to - 0.2), ...shots.map((s) => (s.from + s.to) / 2)];
  const fallback = Array.from({ length: uniform }, (_, i) => (((i + 0.5) / uniform) * durationFrames) / fps);
  const frames = [...new Set((times.length > 0 ? times : fallback).map((t) => Math.max(0, Math.min(durationFrames - 1, Math.round(t * fps)))))].sort((a, b) => a - b);
  if (frames.length <= limit) return frames;
  return Array.from({ length: limit }, (_, i) => frames[Math.floor((i * frames.length) / limit)]);
};

/** Hits whose picture lands before the sound, or more than a frame and a half after it. */
export const checkHitSync = (hits: number[], frames: number[], delayOf: (t: number) => number, fps: number, name: string): Finding[] => {
  if (hits.length !== frames.length) return [{ check: "sync", severity: "error", message: `${name}: ${hits.length} hits but ${frames.length} frames in the song map` }];
  const findings: Finding[] = [];
  hits.forEach((t, i) => {
    const audible = t + delayOf(t);
    const picture = frames[i] / fps;
    if (picture < t - 0.002) findings.push({ check: "sync", severity: "error", frame: frames[i], message: `${name} ${i} shows ${((t - picture) * 1000).toFixed(0)} ms before its sound` });
    else if (picture > audible + 1.5 / fps) findings.push({ check: "sync", severity: "error", frame: frames[i], message: `${name} ${i} shows ${((picture - audible) * 1000).toFixed(0)} ms after its sound` });
  });
  return findings;
};
