// HUD building blocks, plus EngineHud which assembles them for a four-stroke episode.
import { fmtInt, noteName } from "../../core/math";
import type { FourStroke } from "./fourStroke";
import { FONT, UI } from "./theme";

const HUD_W = 940;
const INNER_W = HUD_W - 56;
const STRIP_W = 560;
const STRIP_WINDOW_S = 2.0;

/** Lowest screen y the HUD panel reaches, including its outline. Labels stay below this. */
export const HUD_BOTTOM = 484;

export const HudPanel: React.FC<{ pop: number; children: React.ReactNode }> = ({ pop, children }) => (
  <div
    style={{
      position: "absolute",
      left: (1080 - HUD_W) / 2,
      top: 150,
      width: HUD_W,
      background: "rgba(13,14,31,0.92)",
      border: `4px solid ${UI.border}`,
      boxShadow: `0 0 0 4px ${UI.ink}`,
      padding: "18px 28px 20px",
      transform: `scaleY(${pop})`,
      transformOrigin: "top",
      fontFamily: FONT.display,
      color: UI.cream,
    }}
  >
    {children}
  </div>
);

export const BigNumbers: React.FC<{ left: string; right: string; leftColor: string; rightColor?: string; leftWidth?: number }> = ({
  left,
  right,
  leftColor,
  rightColor = UI.yellow,
  leftWidth = 400,
}) => (
  <div style={{ display: "flex", alignItems: "baseline", height: 112, marginTop: -6 }}>
    <span style={{ fontSize: 132, width: leftWidth, color: leftColor, lineHeight: 1 }}>{left}</span>
    <span style={{ fontSize: 132, color: rightColor, lineHeight: 1 }}>{right}</span>
  </div>
);

export const RevBar: React.FC<{ rpm: number; max: number; redFrom: number; hot: boolean }> = ({ rpm, max, redFrom, hot }) => {
  const steps = max / 1000;
  return (
    <svg width={INNER_W} height={26} style={{ display: "block", marginTop: 6 }}>
      <rect x={0} y={8} width={INNER_W} height={10} fill="#262848" />
      <rect x={((redFrom / max) * INNER_W) | 0} y={8} width={INNER_W * ((max - redFrom) / max)} height={10} fill="#5a2232" />
      <rect x={0} y={8} width={(Math.min(rpm, max) / max) * INNER_W} height={10} fill={hot ? UI.red : UI.cream} />
      {Array.from({ length: steps + 1 }, (_, k) => (
        <rect key={k} x={(k / steps) * (HUD_W - 60)} y={0} width={4} height={k % 3 === 0 ? 8 : 5} fill={k * 1000 >= redFrom ? UI.red : UI.dim} />
      ))}
    </svg>
  );
};

/** Scrolling strip: one tick per bang while slowed, a solid band once the bangs merge into a tone. */
export const WhatYouHear: React.FC<{ t: number; engine: FourStroke; isSlowed: (t: number) => boolean; hudIn: number; realSpeedStart: number; redline: number }> = ({
  t,
  engine,
  isSlowed,
  hudIn,
  realSpeedStart,
  redline,
}) => {
  const win = STRIP_WINDOW_S;
  const ticks: React.ReactNode[] = [];
  for (let i = engine.firstBangAfter(Math.max(t - win, hudIn)); i < engine.bangs.length && engine.bangs[i].t <= t; i++) {
    const b = engine.bangs[i];
    if (!isSlowed(b.t)) break;
    const x = ((b.t - (t - win)) / win) * STRIP_W;
    const age = (t - b.t) / win;
    ticks.push(<rect key={i} x={x - 2} y={12} width={5} height={34} fill={age < 0.06 ? "#ffffff" : UI.yellow} opacity={1 - age * 0.75} />);
  }
  let band: string | null = null;
  if (t > realSpeedStart) {
    const pts: string[] = [];
    const a = Math.max(t - win, realSpeedStart);
    const n = 40;
    const point = (k: number, sign: number) => {
      const tt = a + ((t - a) * k) / n;
      const x = ((tt - (t - win)) / win) * STRIP_W;
      const h = 6 + 22 * (engine.rpmAt(tt) / redline);
      pts.push(`${x},${29 + sign * h}`);
    };
    for (let k = 0; k <= n; k++) point(k, -1);
    for (let k = n; k >= 0; k--) point(k, 1);
    band = pts.join(" ");
  }
  return (
    <div>
      <div style={{ fontFamily: FONT.label, fontSize: 22, color: UI.dim, marginBottom: 4 }}>WHAT YOU HEAR</div>
      <svg width={STRIP_W} height={58} style={{ display: "block" }}>
        <rect x={0} y={28} width={STRIP_W} height={2} fill="#3a3d66" />
        {ticks}
        {band ? <polygon points={band} fill={UI.yellow} /> : null}
      </svg>
    </div>
  );
};

export const Piano: React.FC<{ midi: number; hi?: number }> = ({ midi, hi = 84 /* C6 */ }) => {
  const lo = 45; // A2
  const isBlack = (m: number) => [1, 3, 6, 8, 10].includes(((m % 12) + 12) % 12);
  const whites: number[] = [];
  for (let m = lo; m <= hi; m++) if (!isBlack(m)) whites.push(m);
  const kw = 9;
  return (
    <svg width={whites.length * kw} height={52} style={{ display: "block" }}>
      {whites.map((m, i) => (
        <rect key={m} x={i * kw} y={0} width={kw - 1} height={52} fill={m === midi ? UI.yellow : UI.cream} />
      ))}
      {whites.map((m, i) =>
        m + 1 <= hi && isBlack(m + 1) ? (
          <rect key={`b${m}`} x={i * kw + kw * 0.62} y={0} width={kw * 0.72} height={31} fill={m + 1 === midi ? UI.yellow : UI.ink} />
        ) : null,
      )}
    </svg>
  );
};

export const NoteReadout: React.FC<{ hz: number; pianoHi?: number }> = ({ hz, pianoHi }) => {
  const note = noteName(hz);
  return (
    <div>
      <div style={{ fontSize: 40, lineHeight: 1, color: UI.yellow, marginBottom: 6 }}>
        {fmtInt(hz)} HZ · {note.name}
      </div>
      <Piano midi={note.midi} hi={pianoHi} />
    </div>
  );
};

export type EngineHudConfig = {
  engine: FourStroke;
  isSlowed: (t: number) => boolean;
  slow: number;
  hudIn: number;
  realSpeedStart: number;
  redline: number;
  tachMax: number;
  tachRedFrom: number;
  /** Beat within the bar (0-3). When set, the HUD shows a four-light beat counter. */
  beatAt?: (t: number) => number;
  /** Highest MIDI note on the HUD piano, for engines whose note is above C6. */
  pianoHi?: number;
};

/** RPM, bangs per second, rev bar, what-you-hear strip and note readout. */
export const EngineHud: React.FC<{ t: number; config: EngineHudConfig }> = ({ t, config }) => {
  const { engine, isSlowed, slow, hudIn, realSpeedStart, redline, tachMax, tachRedFrom } = config;
  const pop = Math.min(1, Math.max(0, (t - hudIn) / 0.2));
  if (pop <= 0) return null;
  const rpm = Math.round(engine.rpmAt(t) / 10) * 10;
  const bangs = Math.round(engine.bangsPerSecond(rpm));
  const slowed = isSlowed(t);
  const hot = rpm >= tachRedFrom;
  return (
    <HudPanel pop={pop}>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: FONT.label, fontSize: 24, color: UI.dim }}>
        <span>RPM</span>
        <span style={{ marginLeft: 210 }}>BANGS / SEC</span>
        <span style={{ color: slowed ? UI.cream : UI.yellow }}>{slowed ? `SLOWED ${Math.round(slow * 10) / 10}×` : "REAL SPEED"}</span>
      </div>
      <BigNumbers left={fmtInt(rpm)} right={fmtInt(bangs)} leftColor={hot ? UI.red : UI.cream} />
      {config.beatAt ? (
        <div style={{ position: "absolute", right: 28, top: 84, display: "flex", gap: 10 }}>
          {[0, 1, 2, 3].map((b) => (
            <div key={b} style={{ width: 26, height: 26, background: b === config.beatAt?.(t) ? UI.yellow : "#262848" }} />
          ))}
        </div>
      ) : null}
      <RevBar rpm={rpm} max={tachMax} redFrom={tachRedFrom} hot={hot} />
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: 12 }}>
        <WhatYouHear t={t} engine={engine} isSlowed={isSlowed} hudIn={hudIn} realSpeedStart={realSpeedStart} redline={redline} />
        <div style={{ textAlign: "right" }}>
          {slowed ? (
            <div style={{ fontSize: 46, color: UI.cream, lineHeight: 1 }}>
              {(bangs / slow).toFixed(1)}
              <span style={{ fontSize: 30, color: UI.dim }}> CLICKS/S</span>
            </div>
          ) : (
            <NoteReadout hz={engine.bangsPerSecond(engine.rpmAt(t))} pianoHi={config.pianoHi} />
          )}
        </div>
      </div>
    </HudPanel>
  );
};

/** Lowest screen y the compact HUD reaches. */
export const MINI_HUD_BOTTOM = 316;

/** A one-row HUD for close-ups: RPM, bangs per second and the rev bar, leaving more of the frame to the subject. */
export const MiniHud: React.FC<{ t: number; config: EngineHudConfig }> = ({ t, config }) => {
  const { engine, isSlowed, slow, tachMax, tachRedFrom } = config;
  const rpm = Math.round(engine.rpmAt(t) / 10) * 10;
  const hot = rpm >= tachRedFrom;
  return (
    <HudPanel pop={1}>
      <div style={{ display: "flex", alignItems: "center", height: 84 }}>
        <span style={{ fontSize: 92, width: 300, lineHeight: 1, color: hot ? UI.red : UI.cream }}>{fmtInt(rpm)}</span>
        <span style={{ fontFamily: FONT.label, fontSize: 18, color: UI.dim, width: 66, lineHeight: 1.05 }}>RPM</span>
        <span style={{ fontSize: 92, width: 214, lineHeight: 1, color: UI.yellow }}>{fmtInt(Math.round(engine.bangsPerSecond(rpm)))}</span>
        <span style={{ fontFamily: FONT.label, fontSize: 18, color: UI.dim, width: 96, lineHeight: 1.05 }}>BANGS / SEC</span>
        <div style={{ marginLeft: "auto", textAlign: "right" }}>
          <div style={{ fontFamily: FONT.label, fontSize: 19, color: UI.cream }}>{isSlowed(t) ? `${Math.round(slow * 10) / 10}× SLOW` : "REAL"}</div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
            {[0, 1, 2, 3].map((b) => (
              <div key={b} style={{ width: 20, height: 20, background: b === config.beatAt?.(t) ? UI.yellow : "#262848" }} />
            ))}
          </div>
        </div>
      </div>
      <RevBar rpm={rpm} max={tachMax} redFrom={tachRedFrom} hot={hot} />
    </HudPanel>
  );
};
