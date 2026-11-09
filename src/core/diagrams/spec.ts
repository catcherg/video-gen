// General diagrams as plain data, so a spec can describe them. Limits exist so that every label fits its space.
import { wrapWords } from "../layout";

export type BarDiagram = { type: "bar"; title: string; unit?: string; max?: number; bars: { label: string; value: number }[] };
export type LineDiagram = { type: "line"; title: string; xLabel?: string; yLabel?: string; series: { label: string; points: [number, number][] }[] };
export type TimelineDiagram = { type: "timeline"; title: string; events: { when: string; label: string }[] };
export type FlowDiagram = { type: "flow"; title: string; steps: string[] };
export type ComparisonDiagram = { type: "comparison"; title: string; left: string; right: string; rows: { label: string; left: string; right: string }[] };
/** A tile map: each character of `rows` is one tile, "." is empty, and any other character picks a series colour by its order of first use. */
export type MapDiagram = { type: "map"; title: string; rows: string[]; markers?: { col: number; row: number; label: string }[]; route?: [number, number][] };

export type DiagramSpec = BarDiagram | LineDiagram | TimelineDiagram | FlowDiagram | ComparisonDiagram | MapDiagram;

export const LIMITS = {
  title: 40,
  barLabel: 12,
  bars: 5,
  value: 9,
  series: 3,
  seriesLabel: 10,
  axisLabel: 14,
  minPoints: 2,
  events: 5,
  when: 8,
  eventLabel: 20,
  steps: 5,
  stepLabel: 20,
  columnHeading: 14,
  rows: 4,
  rowLabel: 12,
  cell: 14,
  mapRows: 24,
  mapCols: 60,
  markers: 4,
  markerLabel: 12,
};

/** Width of one label character, and the drawing width of a diagram in the standard panel. */
export const LABEL_CHAR_PX = 13.6;
const PANEL_INNER_W = 732;
export const FLOW_GAP = 26;
export const FLOW_MAX_LINES = 4;
export const TIMELINE_MAX_LINES = 3;

export const flowBoxW = (steps: number, width = PANEL_INNER_W) => Math.floor((width - FLOW_GAP * (steps - 1)) / steps);
export const flowCharsPerLine = (steps: number, width = PANEL_INNER_W) => Math.floor((flowBoxW(steps, width) - 16) / LABEL_CHAR_PX);
export const timelineCharsPerLine = (events: number, width = PANEL_INNER_W) => Math.floor((width / events - 6) / LABEL_CHAR_PX);

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Every problem with a candidate diagram, after any facts have been filled in. */
export const validateDiagram = (raw: unknown, name = "diagram"): string[] => {
  if (!isRecord(raw)) return [`${name}: must be an object`];
  const errors: string[] = [];
  const text = (v: unknown, max: number, label: string) => {
    if (typeof v !== "string" || v.trim().length === 0) errors.push(`${name}.${label}: required text`);
    else if (v.length > max) errors.push(`${name}.${label}: "${v}" is longer than ${max} characters`);
  };
  const optionalText = (v: unknown, max: number, label: string) => {
    if (v !== undefined) text(v, max, label);
  };
  /** Returns the list if it is an array of the right length, and reports it otherwise. */
  const list = (v: unknown, min: number, max: number, label: string): unknown[] => {
    if (!Array.isArray(v) || v.length < min || v.length > max) {
      errors.push(`${name}.${label}: needs ${min} to ${max} entries`);
      return [];
    }
    return v;
  };
  text(raw.title, LIMITS.title, "title");
  /** Reports label text that would not fit once wrapped into a narrow column. */
  const wrapped = (v: unknown, charsPerLine: number, maxLines: number, label: string) => {
    if (typeof v !== "string") return;
    const lines = wrapWords(v, charsPerLine);
    if (lines.some((line) => line.length > charsPerLine)) errors.push(`${name}.${label}: "${v}" has a word longer than ${charsPerLine} characters`);
    else if (lines.length > maxLines) errors.push(`${name}.${label}: "${v}" needs more than ${maxLines} lines`);
  };

  switch (raw.type) {
    case "bar": {
      optionalText(raw.unit, LIMITS.value, "unit");
      if (raw.max !== undefined && !(isNumber(raw.max) && raw.max > 0)) errors.push(`${name}.max: must be a positive number`);
      const bars = list(raw.bars, 1, LIMITS.bars, "bars") as Record<string, unknown>[];
      bars.forEach((b, i) => {
        text(b?.label, LIMITS.barLabel, `bars[${i}].label`);
        if (!isNumber(b?.value) || b.value < 0) errors.push(`${name}.bars[${i}].value: must be zero or more`);
      });
      if (bars.length > 0 && raw.max === undefined && bars.every((b) => b?.value === 0)) errors.push(`${name}.bars: at least one value must be above zero`);
      break;
    }
    case "line": {
      optionalText(raw.xLabel, LIMITS.axisLabel, "xLabel");
      optionalText(raw.yLabel, LIMITS.axisLabel, "yLabel");
      (list(raw.series, 1, LIMITS.series, "series") as Record<string, unknown>[]).forEach((s, i) => {
        text(s?.label, LIMITS.seriesLabel, `series[${i}].label`);
        const points = list(s?.points, LIMITS.minPoints, 200, `series[${i}].points`);
        if (!points.every((p) => Array.isArray(p) && p.length === 2 && isNumber(p[0]) && isNumber(p[1]))) errors.push(`${name}.series[${i}].points: each must be [x, y]`);
        else if (points.some((p, k) => k > 0 && (p as number[])[0] <= (points[k - 1] as number[])[0])) errors.push(`${name}.series[${i}].points: x must increase`);
      });
      break;
    }
    case "timeline":
      (list(raw.events, 2, LIMITS.events, "events") as Record<string, unknown>[]).forEach((e, i, events) => {
        text(e?.when, LIMITS.when, `events[${i}].when`);
        text(e?.label, LIMITS.eventLabel, `events[${i}].label`);
        wrapped(e?.label, timelineCharsPerLine(events.length), TIMELINE_MAX_LINES, `events[${i}].label`);
      });
      break;
    case "flow":
      list(raw.steps, 2, LIMITS.steps, "steps").forEach((s, i, steps) => {
        text(s, LIMITS.stepLabel, `steps[${i}]`);
        wrapped(s, flowCharsPerLine(steps.length), FLOW_MAX_LINES, `steps[${i}]`);
      });
      break;
    case "comparison":
      text(raw.left, LIMITS.columnHeading, "left");
      text(raw.right, LIMITS.columnHeading, "right");
      (list(raw.rows, 1, LIMITS.rows, "rows") as Record<string, unknown>[]).forEach((r, i) => {
        text(r?.label, LIMITS.rowLabel, `rows[${i}].label`);
        text(r?.left, LIMITS.cell, `rows[${i}].left`);
        text(r?.right, LIMITS.cell, `rows[${i}].right`);
      });
      break;
    case "map": {
      const rows = list(raw.rows, 2, LIMITS.mapRows, "rows");
      if (!rows.every((r) => typeof r === "string" && r.length > 0 && r.length === (rows[0] as string).length)) errors.push(`${name}.rows: every row must be text of the same length`);
      else if (rows.length > 0 && (rows[0] as string).length > LIMITS.mapCols) errors.push(`${name}.rows: wider than ${LIMITS.mapCols} tiles`);
      const cols = typeof rows[0] === "string" ? rows[0].length : 0;
      const onMap = (col: unknown, row: unknown) => isNumber(col) && isNumber(row) && col >= 0 && row >= 0 && col < cols && row < rows.length;
      if (raw.markers !== undefined) {
        (list(raw.markers, 0, LIMITS.markers, "markers") as Record<string, unknown>[]).forEach((m, i) => {
          text(m?.label, LIMITS.markerLabel, `markers[${i}].label`);
          if (!onMap(m?.col, m?.row)) errors.push(`${name}.markers[${i}]: is off the map`);
        });
      }
      if (raw.route !== undefined) {
        list(raw.route, 2, 64, "route").forEach((p, i) => {
          if (!Array.isArray(p) || !onMap(p[0], p[1])) errors.push(`${name}.route[${i}]: is off the map`);
        });
      }
      break;
    }
    default:
      errors.push(`${name}.type: must be bar, line, timeline, flow, comparison or map`);
  }
  return errors;
};
