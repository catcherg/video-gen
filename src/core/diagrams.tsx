// Live 2D diagrams for the panel under the captions. Each one is a pure function of its props,
// which an episode computes from its physics, so a diagram can never disagree with the 3D scene.
import { C, FONT, STROKE_COLORS, UI } from "./theme";

export const PANEL = { left: 70, top: 1478, width: 940, height: 280 };

export const DiagramPanel: React.FC<{ title: string; fade: number; children: React.ReactNode }> = ({ title, fade, children }) => (
  <div
    style={{
      position: "absolute",
      left: PANEL.left,
      top: PANEL.top,
      width: PANEL.width,
      height: PANEL.height,
      boxSizing: "border-box",
      background: "rgba(13,14,31,0.92)",
      border: `4px solid ${UI.border}`,
      boxShadow: `0 0 0 4px ${UI.ink}`,
      padding: "12px 22px",
      opacity: fade,
      color: UI.cream,
    }}
  >
    <div style={{ fontFamily: FONT.label, fontSize: 22, color: UI.dim, marginBottom: 6 }}>{title}</div>
    <div style={{ display: "flex", alignItems: "center", gap: 26 }}>{children}</div>
  </div>
);

const STROKES = ["BANG", "EXHAUST", "INTAKE", "SQUEEZE"];

const polar = (cx: number, cy: number, r: number, deg: number): [number, number] => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
};

const arcPath = (cx: number, cy: number, r0: number, r1: number, from: number, to: number) => {
  const [ax, ay] = polar(cx, cy, r1, from);
  const [bx, by] = polar(cx, cy, r1, to);
  const [cx0, cy0] = polar(cx, cy, r0, to);
  const [dx, dy] = polar(cx, cy, r0, from);
  return `M${ax} ${ay}A${r1} ${r1} 0 0 1 ${bx} ${by}L${cx0} ${cy0}A${r0} ${r0} 0 0 0 ${dx} ${dy}Z`;
};

/** The four strokes as a dial covering one 720° cycle, with a needle at the cylinder's position. */
export const StrokeWheel: React.FC<{ c: number; size?: number }> = ({ c, size = 196 }) => {
  const cx = size / 2;
  const cy = size / 2;
  const active = Math.floor(c / 180) % 4;
  const [nx, ny] = polar(cx, cy, size * 0.47, c / 2);
  return (
    <svg width={size} height={size} style={{ display: "block", flex: "none" }}>
      {STROKES.map((s, i) => (
        <path key={s} d={arcPath(cx, cy, size * 0.22, size * 0.44, i * 90 + 1.5, (i + 1) * 90 - 1.5)} fill={STROKE_COLORS[s]} opacity={i === active ? 1 : 0.28} />
      ))}
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={UI.cream} strokeWidth={5} />
      <rect x={cx - 7} y={cy - 7} width={14} height={14} fill={UI.cream} />
    </svg>
  );
};

/** Side view of one cylinder, drawn from the same kinematics as the 3D piston. */
export const CylinderSchematic: React.FC<{
  stroke: string;
  crown: number;
  wrist: number;
  pin: [number, number];
  deck: number;
  boreR: number;
  crankR: number;
  inLift: number;
  exLift: number;
  sparking: boolean;
}> = ({ stroke, crown, wrist, pin, deck, boreR, crankR, inLift, exLift, sparking }) => {
  const W = 150;
  const H = 214;
  const s = H / (deck + crankR + 0.75);
  const Y = (u: number) => H - (u + crankR + 0.3) * s;
  const X = (v: number) => W / 2 + v * s;
  const b = boreR * s;
  const valve = (side: number, lift: number, color: string) => {
    const x = X(side * boreR * 0.5);
    const y = Y(deck) + lift * s;
    return (
      <g key={side}>
        <rect x={x - 3} y={y - 34} width={6} height={34} fill={color} />
        <rect x={x - 16} y={y - 2} width={32} height={7} fill={color} />
      </g>
    );
  };
  return (
    <svg width={W} height={H} style={{ display: "block", flex: "none" }}>
      <rect x={X(0) - b} y={Y(deck)} width={b * 2} height={Y(crown) - Y(deck)} fill={STROKE_COLORS[stroke]} opacity={0.75} />
      <rect x={X(0) - b - 6} y={Y(deck) - 2} width={6} height={Y(0.7) - Y(deck)} fill={C.metalDark} />
      <rect x={X(0) + b} y={Y(deck) - 2} width={6} height={Y(0.7) - Y(deck)} fill={C.metalDark} />
      <rect x={X(0) - b - 6} y={Y(deck) - 6} width={b * 2 + 12} height={5} fill={C.valley} />
      {valve(-1, inLift, C.intake)}
      {valve(1, exLift, C.exhaust)}
      {sparking ? <polygon points={`${X(0)},${Y(deck) + 2} ${X(0) + 10},${Y(deck) + 16} ${X(0) + 2},${Y(deck) + 15} ${X(0) + 8},${Y(deck) + 30} ${X(0) - 10},${Y(deck) + 11} ${X(0) - 2},${Y(deck) + 12}`} fill="#ffffff" /> : null}
      <line x1={X(pin[1])} y1={Y(pin[0])} x2={X(0)} y2={Y(wrist)} stroke={C.rodRight} strokeWidth={9} />
      <rect x={X(0) - b + 2} y={Y(crown)} width={b * 2 - 4} height={0.5 * s} fill={C.metalLight} />
      <rect x={X(0) - b + 2} y={Y(crown) + 8} width={b * 2 - 4} height={3} fill={C.metalDark} />
      <circle cx={X(0)} cy={Y(0)} r={crankR * s} fill="none" stroke={C.crankGold} strokeWidth={4} strokeDasharray="5 4" />
      <rect x={X(pin[1]) - 6} y={Y(pin[0]) - 6} width={12} height={12} fill={C.crankGold} />
    </svg>
  );
};

export const StrokeReadout: React.FC<{ cylinder: number; stroke: string; text: string }> = ({ cylinder, stroke, text }) => (
  <div style={{ flex: 1, fontFamily: FONT.display }}>
    <div style={{ fontFamily: FONT.label, fontWeight: 700, fontSize: 38, color: STROKE_COLORS[stroke], lineHeight: 1.1 }}>{stroke}</div>
    <div style={{ fontSize: 36, lineHeight: 1.05, marginTop: 8 }}>{text}</div>
    <div style={{ fontFamily: FONT.label, fontSize: 20, color: UI.dim, marginTop: 10 }}>CYLINDER {cylinder}</div>
  </div>
);

/** End-on view of the crank: an arm for each distinct pin angle, and the V of the two banks. */
export const CrankEndView: React.FC<{ arms: number[]; bankHalfDeg: number; spinDeg: number; hotArm: number; size?: number }> = ({ arms, bankHalfDeg, spinDeg, hotArm, size = 210 }) => {
  const cx = size / 2;
  const cy = size * 0.62;
  const R = size * 0.27;
  return (
    <svg width={size} height={size} style={{ display: "block", flex: "none" }}>
      {[-bankHalfDeg, bankHalfDeg].map((d) => {
        const [x0, y0] = polar(cx, cy, R * 1.5, d);
        const [x1, y1] = polar(cx, cy, size * 0.62, d);
        return <line key={d} x1={x0} y1={y0} x2={x1} y2={y1} stroke={d < 0 ? C.rodRight : C.rodLeft} strokeWidth={16} opacity={0.5} />;
      })}
      <circle cx={cx} cy={cy} r={R} fill="none" stroke={UI.border} strokeWidth={3} />
      {arms.map((a, i) => {
        const [x, y] = polar(cx, cy, R, a + spinDeg);
        const hot = i === hotArm;
        return (
          <g key={i}>
            <line x1={cx} y1={cy} x2={x} y2={y} stroke={C.crankGold} strokeWidth={hot ? 12 : 8} />
            <circle cx={x} cy={y} r={hot ? 15 : 11} fill={hot ? "#ffffff" : C.crankGold} />
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r={10} fill={UI.cream} />
    </svg>
  );
};

/** A 720° strip showing when each valve set is open, with a playhead at the cylinder's position. */
export const ValveTimingStrip: React.FC<{ c: number; intake: [number, number]; exhaust: [number, number]; width?: number }> = ({ c, intake, exhaust, width = 880 }) => {
  const H = 196;
  const X = (deg: number) => (deg / 720) * width;
  const track = (label: string, y: number, [a, b]: [number, number], color: string, open: boolean) => (
    <g>
      <rect x={0} y={y} width={width} height={36} fill="#262848" />
      <rect x={X(a)} y={y} width={X(b) - X(a)} height={36} fill={color} opacity={open ? 1 : 0.55} />
      <text x={X(a) + 10} y={y + 26} fontFamily={FONT.label} fontWeight={700} fontSize={22} fill={UI.ink}>
        {label}
      </text>
    </g>
  );
  return (
    <svg width={width} height={H} style={{ display: "block" }}>
      {STROKES.map((s, i) => (
        <g key={s}>
          <rect x={X(i * 180) + 2} y={0} width={X(180) - 4} height={38} fill={STROKE_COLORS[s]} opacity={Math.floor(c / 180) % 4 === i ? 1 : 0.3} />
          <text x={X(i * 180) + 12} y={28} fontFamily={FONT.label} fontWeight={700} fontSize={22} fill={UI.ink}>
            {s}
          </text>
        </g>
      ))}
      {track("EXHAUST VALVES", 58, exhaust, C.exhaust, c > exhaust[0] && c < exhaust[1])}
      {track("INTAKE VALVES", 112, intake, C.intake, c > intake[0] && c < intake[1])}
      <rect x={X(c) - 3} y={0} width={6} height={172} fill={UI.cream} />
    </svg>
  );
};

/** Top-down map of the two banks with the current cylinder lit, and the firing order beneath. */
export const FiringMap: React.FC<{ rightBank: number[]; leftBank: number[]; order: number[]; activeIndex: number; note: string; width?: number }> = ({
  rightBank,
  leftBank,
  order,
  activeIndex,
  note,
  width = 880,
}) => {
  const active = order[activeIndex];
  const cell = (cyl: number, x: number, y: number, tint: string) => (
    <g key={cyl}>
      <rect x={x} y={y} width={64} height={48} fill={cyl === active ? UI.yellow : "#262848"} stroke={tint} strokeWidth={3} />
      <text x={x + 32} y={y + 34} textAnchor="middle" fontFamily={FONT.label} fontWeight={700} fontSize={26} fill={cyl === active ? UI.ink : UI.cream}>
        {cyl}
      </text>
    </g>
  );
  const stepW = width / order.length;
  return (
    <svg width={width} height={198} style={{ display: "block" }}>
      <text x={0} y={36} fontFamily={FONT.label} fontSize={20} fill={C.rodRight}>RIGHT</text>
      <text x={0} y={96} fontFamily={FONT.label} fontSize={20} fill={C.rodLeft}>LEFT</text>
      {rightBank.map((cyl, i) => cell(cyl, 96 + i * 74, 2, C.rodRight))}
      {leftBank.map((cyl, i) => cell(cyl, 96 + i * 74, 62, C.rodLeft))}
      <text x={width} y={40} textAnchor="end" fontFamily={FONT.display} fontSize={40} fill={UI.yellow}>{note}</text>
      {order.map((cyl, i) => (
        <g key={i}>
          <rect x={i * stepW + 2} y={134} width={stepW - 4} height={46} fill={i === activeIndex ? UI.yellow : "#1a1c38"} />
          <text x={i * stepW + stepW / 2} y={167} textAnchor="middle" fontFamily={FONT.label} fontWeight={700} fontSize={24} fill={i === activeIndex ? UI.ink : UI.dim}>
            {cyl}
          </text>
        </g>
      ))}
    </svg>
  );
};

/** A short slice of the exhaust pulse train: the bangs bunch up until they blur into a tone. */
export const PulseTrain: React.FC<{ hz: number; windowMs: number; width?: number }> = ({ hz, windowMs, width = 620 }) => {
  const H = 166;
  const spacing = (1000 / hz / windowMs) * width;
  const pts: string[] = [`0,${H - 8}`];
  const count = Math.ceil(width / spacing);
  for (let i = 0; i < count; i++) {
    const x0 = i * spacing;
    pts.push(`${x0},${H - 8}`, `${x0 + 2},12`, `${x0 + Math.min(spacing * 0.75, 34)},${H - 8}`);
  }
  return (
    <svg width={width} height={H} style={{ display: "block", flex: "none" }}>
      <rect x={0} y={H - 9} width={width} height={2} fill="#3a3d66" />
      <polyline points={pts.join(" ")} fill="none" stroke={UI.yellow} strokeWidth={3} />
    </svg>
  );
};

/** Section through one pneumatic valve spring: the valve opens downward and squeezes the air beneath its piston. */
export const AirSpringSection: React.FC<{ lift01: number; liftUnits: number; color: string }> = ({ lift01, liftUnits, color }) => {
  const W = 190;
  const H = 214;
  const CHAMBER_TOP = 44;
  const CHAMBER_FLOOR = 142;
  const TRAVEL = (liftUnits / 0.14) * 44;
  const headY = 160 + lift01 * TRAVEL;
  const pistonY = CHAMBER_TOP + lift01 * TRAVEL;
  const cx = W / 2;
  return (
    <svg width={W} height={H} style={{ display: "block", flex: "none" }}>
      <rect x={cx - 52} y={CHAMBER_TOP - 26} width={8} height={CHAMBER_FLOOR - CHAMBER_TOP + 34} fill={C.metalDark} />
      <rect x={cx + 44} y={CHAMBER_TOP - 26} width={8} height={CHAMBER_FLOOR - CHAMBER_TOP + 34} fill={C.metalDark} />
      <rect x={cx - 52} y={CHAMBER_FLOOR} width={104} height={8} fill={C.metalDark} />
      <rect x={cx - 44} y={pistonY + 12} width={88} height={CHAMBER_FLOOR - pistonY - 12} fill={C.air} opacity={0.3 + 0.65 * lift01} />
      <rect x={cx - 44} y={pistonY} width={88} height={12} fill={C.metalLight} />
      <rect x={cx - 5} y={pistonY - 24} width={10} height={24} fill={color} />
      <rect x={cx - 5} y={pistonY + 12} width={10} height={headY - pistonY - 12} fill={color} />
      <rect x={cx - 34} y={headY} width={68} height={10} fill={color} />
    </svg>
  );
};
