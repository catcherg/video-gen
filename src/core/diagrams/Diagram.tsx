// Draws general diagrams in pixel style. Each is a pure function of its data and a 0-to-1 reveal `progress`.
import { REGIONS, wrapWords, type Rect } from "../layout";
import { clamp01 } from "../math";
import { easeOutCubic, popIn, snap, staggered } from "../motion";
import { usePalette, withAlpha } from "../palette";
import { FONT } from "../theme";
import { flowBoxW, flowCharsPerLine, FLOW_GAP, FLOW_MAX_LINES, LABEL_CHAR_PX, timelineCharsPerLine, TIMELINE_MAX_LINES, type BarDiagram, type ComparisonDiagram, type DiagramSpec, type FlowDiagram, type LineDiagram, type MapDiagram, type TimelineDiagram } from "./spec";

type Size = { w: number; h: number; p: number };

const TITLE_ROW = 36;
const CARD_CHROME = 8 + 24; // border and padding, top and bottom combined
const CARD_SIDE_CHROME = 8 + 40;
const LABEL_PX = 32;
const HEADING_PX = 34;

const Label: React.FC<{ x: number; y: number; color: string; size?: number; anchor?: "start" | "middle" | "end"; children: React.ReactNode }> = ({ x, y, color, size = LABEL_PX, anchor = "start", children }) => (
  <text x={x} y={y} fill={color} fontFamily={FONT.display} fontSize={size} textAnchor={anchor}>
    {children}
  </text>
);

/** Numbers formatted the same on every computer. */
const formatValue = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 2 });
/** Axis positions are often years, which must not gain a comma. */
const formatAxis = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 2, useGrouping: false });

const Bars: React.FC<Size & { d: BarDiagram }> = ({ d, w, h, p }) => {
  const { text, dim, series } = usePalette();
  const max = d.max ?? Math.max(...d.bars.map((b) => b.value));
  const rowH = h / d.bars.length;
  const labelW = 180;
  const valueW = 170;
  const track = w - labelW - valueW;
  const barH = Math.min(36, Math.floor(rowH) - 6);
  return (
    <svg width={w} height={h} shapeRendering="crispEdges" style={{ display: "block" }}>
      {d.bars.map((b, i) => {
        const grow = easeOutCubic(staggered(p, i, d.bars.length));
        const mid = Math.round(i * rowH + rowH / 2);
        return (
          <g key={b.label}>
            <Label x={0} y={mid + 10} color={text}>
              {b.label}
            </Label>
            <rect x={labelW} y={mid - barH / 2} width={track} height={barH} fill={withAlpha(dim, 0.15)} />
            <rect x={labelW} y={mid - barH / 2} width={snap(track * Math.min(1, b.value / max) * grow)} height={barH} fill={series[i % series.length]} />
            <g opacity={grow}>
              <Label x={w} y={mid + 10} color={text} anchor="end">
                {formatValue(b.value)}
                {d.unit ? ` ${d.unit}` : ""}
              </Label>
            </g>
          </g>
        );
      })}
    </svg>
  );
};

const Lines: React.FC<Size & { d: LineDiagram }> = ({ d, w, h, p }) => {
  const { dim, border, series } = usePalette();
  const all = d.series.flatMap((s) => s.points);
  const minX = Math.min(...all.map((q) => q[0]));
  const maxX = Math.max(...all.map((q) => q[0]));
  const minY = Math.min(0, ...all.map((q) => q[1]));
  const maxY = Math.max(...all.map((q) => q[1]));
  const yTop = formatValue(maxY);
  const yBottom = formatValue(minY);
  const left = Math.max(yTop.length, yBottom.length) * LABEL_CHAR_PX + 16;
  const top = 36;
  const bottom = h - 34;
  const right = w - 8;
  const px = (x: number) => Math.round(left + ((x - minX) / (maxX - minX || 1)) * (right - left));
  const py = (y: number) => Math.round(bottom - ((y - minY) / (maxY - minY || 1)) * (bottom - top));
  const cut = minX + clamp01(p) * (maxX - minX);
  const visible = (points: [number, number][]) => {
    const shown: [number, number][] = [];
    for (let i = 0; i < points.length; i++) {
      const [x, y] = points[i];
      if (x <= cut) shown.push([x, y]);
      else {
        if (i > 0) {
          const [x0, y0] = points[i - 1];
          shown.push([cut, y0 + ((y - y0) * (cut - x0)) / (x - x0)]);
        }
        break;
      }
    }
    return shown;
  };
  // The legend has its own row, so it can never sit on top of a line.
  let legendRight = w;
  const legend = d.series.map((s, i) => {
    const entry = { label: s.label, color: series[i % series.length], x: legendRight };
    legendRight -= s.label.length * LABEL_CHAR_PX + 26;
    return entry;
  });
  return (
    <svg width={w} height={h} shapeRendering="crispEdges" style={{ display: "block" }}>
      <rect x={left - 4} y={top} width={4} height={bottom - top + 4} fill={border} />
      <rect x={left - 4} y={bottom} width={right - left + 4} height={4} fill={border} />
      <Label x={left - 12} y={top + 20} color={dim} anchor="end">
        {yTop}
      </Label>
      <Label x={left - 12} y={bottom} color={dim} anchor="end">
        {yBottom}
      </Label>
      <Label x={left} y={h - 2} color={dim}>
        {formatAxis(minX)}
      </Label>
      <Label x={right} y={h - 2} color={dim} anchor="end">
        {formatAxis(maxX)}
      </Label>
      {d.xLabel ? (
        <Label x={(left + right) / 2} y={h - 2} color={dim} anchor="middle">
          {d.xLabel}
        </Label>
      ) : null}
      {d.yLabel ? (
        <Label x={0} y={24} color={dim}>
          {d.yLabel}
        </Label>
      ) : null}
      {d.series.map((s, i) => {
        const points = visible(s.points);
        return points.length < 2 ? null : <polyline key={s.label} points={points.map(([x, y]) => `${px(x)},${py(y)}`).join(" ")} fill="none" stroke={series[i % series.length]} strokeWidth={5} />;
      })}
      {legend.map((entry) => (
        <Label key={entry.label} x={entry.x} y={24} color={entry.color} anchor="end">
          {entry.label}
        </Label>
      ))}
    </svg>
  );
};

const Timeline: React.FC<Size & { d: TimelineDiagram }> = ({ d, w, h, p }) => {
  const { text, accent, border } = usePalette();
  const n = d.events.length;
  const column = w / n;
  const axis = 46;
  const x = (i: number) => Math.round(column * (i + 0.5));
  const charsPerLine = timelineCharsPerLine(n, w);
  return (
    <svg width={w} height={h} shapeRendering="crispEdges" style={{ display: "block" }}>
      <rect x={0} y={axis - 2} width={w} height={4} fill={border} />
      <rect x={0} y={axis - 2} width={snap(w * clamp01(p))} height={4} fill={accent} />
      {d.events.map((e, i) => (
        <g key={e.when + e.label} opacity={clamp01((p - i / n) * n * 1.5)}>
          <rect x={x(i) - 8} y={axis - 8} width={16} height={16} fill={accent} />
          <Label x={x(i)} y={28} color={accent} anchor="middle" size={HEADING_PX}>
            {e.when}
          </Label>
          {wrapWords(e.label, charsPerLine).map((line, k) => (
            <Label key={k} x={x(i)} y={axis + 40 + k * 30} color={text} anchor="middle">
              {line}
            </Label>
          ))}
        </g>
      ))}
    </svg>
  );
};

const Flow: React.FC<Size & { d: FlowDiagram }> = ({ d, w, h, p }) => {
  const { ink, text, accent, border } = usePalette();
  const n = d.steps.length;
  const boxW = flowBoxW(n, w);
  const boxH = Math.min(150, h - 8);
  const top = Math.round((h - boxH) / 2);
  const active = Math.min(n - 1, Math.floor(clamp01(p) * n));
  const charsPerLine = flowCharsPerLine(n, w);
  return (
    <svg width={w} height={h} shapeRendering="crispEdges" style={{ display: "block" }}>
      {d.steps.map((step, i) => {
        const x = i * (boxW + FLOW_GAP);
        const lit = i === active;
        const lines = wrapWords(step, charsPerLine);
        const firstY = top + boxH / 2 - ((lines.length - 1) * 30) / 2 + 10;
        return (
          <g key={step} opacity={Math.min(1, popIn(p, i / n, 0.5 / n))}>
            <rect x={x} y={top} width={boxW} height={boxH} fill={lit ? accent : ink} stroke={lit ? accent : border} strokeWidth={4} />
            {lines.map((line, k) => (
              <Label key={k} x={x + boxW / 2} y={firstY + k * 30} color={lit ? ink : text} anchor="middle">
                {line}
              </Label>
            ))}
            {i < n - 1 ? <polygon points={`${x + boxW + 6},${top + boxH / 2 - 12} ${x + boxW + FLOW_GAP - 6},${top + boxH / 2} ${x + boxW + 6},${top + boxH / 2 + 12}`} fill={border} /> : null}
          </g>
        );
      })}
    </svg>
  );
};

const Comparison: React.FC<Size & { d: ComparisonDiagram }> = ({ d, w, h, p }) => {
  const { text, dim, border, series } = usePalette();
  const labelW = Math.round(w * 0.28);
  const columnW = (w - labelW) / 2;
  const headerH = 38;
  const rowH = (h - headerH) / d.rows.length;
  const leftX = labelW + columnW / 2;
  const rightX = labelW + columnW * 1.5;
  return (
    <svg width={w} height={h} shapeRendering="crispEdges" style={{ display: "block" }}>
      <Label x={leftX} y={26} color={series[0]} anchor="middle" size={HEADING_PX}>
        {d.left}
      </Label>
      <Label x={rightX} y={26} color={series[1]} anchor="middle" size={HEADING_PX}>
        {d.right}
      </Label>
      <rect x={0} y={headerH - 4} width={w} height={4} fill={border} />
      {d.rows.map((r, i) => {
        const y = Math.round(headerH + i * rowH + rowH / 2 + 10);
        return (
          <g key={r.label} opacity={staggered(p, i, d.rows.length)}>
            <Label x={0} y={y} color={dim}>
              {r.label}
            </Label>
            <Label x={leftX} y={y} color={text} anchor="middle">
              {r.left}
            </Label>
            <Label x={rightX} y={y} color={text} anchor="middle">
              {r.right}
            </Label>
          </g>
        );
      })}
    </svg>
  );
};

const TileMap: React.FC<Size & { d: MapDiagram }> = ({ d, w, h, p }) => {
  const { text, ink, accent, series } = usePalette();
  const cols = d.rows[0].length;
  const tile = Math.max(2, Math.floor(Math.min(w / cols, h / d.rows.length)));
  const left = Math.round((w - tile * cols) / 2);
  const top = Math.round((h - tile * d.rows.length) / 2);
  const codes = [...new Set(d.rows.join("").replaceAll(".", ""))];
  const centre = (col: number, row: number) => ({ x: left + (col + 0.5) * tile, y: top + (row + 0.5) * tile });
  const route = d.route ?? [];
  const shownSegments = clamp01(p) * Math.max(0, route.length - 1);
  const routePoints: string[] = [];
  for (let i = 0; i < route.length && i <= Math.ceil(shownSegments); i++) {
    const here = centre(route[i][0], route[i][1]);
    if (i > shownSegments && i > 0) {
      const before = centre(route[i - 1][0], route[i - 1][1]);
      const u = shownSegments - (i - 1);
      routePoints.push(`${before.x + (here.x - before.x) * u},${before.y + (here.y - before.y) * u}`);
    } else routePoints.push(`${here.x},${here.y}`);
  }
  return (
    <svg width={w} height={h} shapeRendering="crispEdges" style={{ display: "block" }}>
      {d.rows.flatMap((row, r) =>
        [...row].map((code, c) => (code === "." ? null : <rect key={`${r}-${c}`} x={left + c * tile} y={top + r * tile} width={tile} height={tile} fill={series[codes.indexOf(code) % series.length]} opacity={0.75} />)),
      )}
      {routePoints.length > 1 ? <polyline points={routePoints.join(" ")} fill="none" stroke={text} strokeWidth={4} /> : null}
      {(d.markers ?? []).map((m, i) => {
        const at = centre(m.col, m.row);
        const labelW = m.label.length * LABEL_CHAR_PX + 10;
        const onRight = at.x + 12 + labelW <= w;
        return (
          <g key={m.label} opacity={staggered(p, i, d.markers?.length ?? 1)}>
            <rect x={at.x - 7} y={at.y - 7} width={14} height={14} fill={accent} stroke={ink} strokeWidth={2} />
            <rect x={onRight ? at.x + 12 : at.x - 12 - labelW} y={at.y - 16} width={labelW} height={32} fill={ink} />
            <Label x={onRight ? at.x + 17 : at.x - 17} y={at.y + 10} color={text} anchor={onRight ? "start" : "end"}>
              {m.label}
            </Label>
          </g>
        );
      })}
    </svg>
  );
};

/** A diagram in its card, at a layout region. `progress` reveals it from 0 to 1; `fade` is its overall opacity. */
export const Diagram: React.FC<{ spec: DiagramSpec; progress: number; fade?: number; region?: Rect }> = ({ spec, progress, fade = 1, region = REGIONS.panel }) => {
  const { ink, text, dim, border } = usePalette();
  const inner = { w: region.w - CARD_SIDE_CHROME, h: region.h - CARD_CHROME - TITLE_ROW, p: progress };
  return (
    <div
      style={{
        position: "absolute",
        left: region.x,
        top: region.y,
        width: region.w,
        height: region.h,
        boxSizing: "border-box",
        background: withAlpha(ink, 0.92),
        border: `4px solid ${border}`,
        boxShadow: `0 0 0 4px ${ink}`,
        padding: "12px 20px",
        opacity: fade,
        color: text,
      }}
    >
      <div style={{ fontFamily: FONT.label, fontSize: 22, lineHeight: `${TITLE_ROW - 6}px`, height: TITLE_ROW, color: dim, whiteSpace: "nowrap" }}>{spec.title}</div>
      {spec.type === "bar" ? <Bars d={spec} {...inner} /> : null}
      {spec.type === "line" ? <Lines d={spec} {...inner} /> : null}
      {spec.type === "timeline" ? <Timeline d={spec} {...inner} /> : null}
      {spec.type === "flow" ? <Flow d={spec} {...inner} /> : null}
      {spec.type === "comparison" ? <Comparison d={spec} {...inner} /> : null}
      {spec.type === "map" ? <TileMap d={spec} {...inner} /> : null}
    </div>
  );
};
