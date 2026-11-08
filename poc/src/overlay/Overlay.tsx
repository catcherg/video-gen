import { useEffect, useState } from "react";
import * as THREE from "three";
import { AbsoluteFill, continueRender, delayRender, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { CAMS_LABEL_D, cylPoint, crownWorld, engineOrigin } from "../geometry";
import {
  BANGS,
  bangsPerSecond,
  cycleAt,
  firstBangAfter,
  isSlowed,
  REAL_SPEED_START,
  REDLINE,
  rpmAt,
  SLOW,
  strokeName,
} from "../physics";
import { cameraAt, CAPTIONS, HUD_IN, SHOW_BANK_LABELS, SHOW_CRANK_TAG, SHOW_CYL_NUMBERS, SHOW_STROKE_TAG } from "../timeline";

const INK = "#0d0e1f";
const CREAM = "#f2eedc";
const DIM = "#8c91bf";
const YELLOW = "#ffe45e";
const RED = "#ff4a5c";
const BORDER = "#4a5288";

// ---------- fonts ----------
export const useFonts = () => {
  const [handle] = useState(() => delayRender("fonts"));
  useEffect(() => {
    const faces = [
      new FontFace("VT323", `url(${staticFile("fonts/vt323.woff2")})`),
      new FontFace("Silkscreen", `url(${staticFile("fonts/silkscreen.woff2")})`),
      new FontFace("Silkscreen", `url(${staticFile("fonts/silkscreen-bold.woff2")})`, { weight: "700" }),
    ];
    Promise.all(faces.map((f) => f.load())).then((loaded) => {
      loaded.forEach((f) => document.fonts.add(f));
      continueRender(handle);
    });
  }, [handle]);
};

// ---------- projection ----------
const project = (p: THREE.Vector3, t: number, w: number, h: number) => {
  const cam = cameraAt(t);
  const pc = new THREE.PerspectiveCamera(cam.fov, w / h, 0.5, 600);
  pc.position.copy(cam.pos);
  pc.lookAt(cam.target);
  pc.updateMatrixWorld();
  pc.updateProjectionMatrix();
  const v = p.clone().project(pc);
  return { x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * h, visible: v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1 };
};

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

const noteName = (f: number) => {
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const m = Math.round(12 * Math.log2(f / 440) + 69);
  return { midi: m, name: names[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1) };
};

// ---------- piano ----------
const Piano: React.FC<{ midi: number }> = ({ midi }) => {
  const lo = 45; // A2
  const hi = 84; // C6
  const isBlack = (m: number) => [1, 3, 6, 8, 10].includes(((m % 12) + 12) % 12);
  const whites: number[] = [];
  for (let m = lo; m <= hi; m++) if (!isBlack(m)) whites.push(m);
  const kw = 9;
  return (
    <svg width={whites.length * kw} height={52} style={{ display: "block" }}>
      {whites.map((m, i) => (
        <rect key={m} x={i * kw} y={0} width={kw - 1} height={52} fill={m === midi ? YELLOW : CREAM} />
      ))}
      {whites.map((m, i) =>
        m + 1 <= hi && isBlack(m + 1) ? (
          <rect key={`b${m}`} x={i * kw + kw * 0.62} y={0} width={kw * 0.72} height={31} fill={m + 1 === midi ? YELLOW : INK} />
        ) : null
      )}
    </svg>
  );
};

// ---------- HUD ----------
const Hud: React.FC<{ t: number }> = ({ t }) => {
  const pop = Math.min(1, Math.max(0, (t - HUD_IN) / 0.2));
  if (pop <= 0) return null;
  const rpm = Math.round(rpmAt(t) / 10) * 10;
  const bangs = Math.round(bangsPerSecond(rpm));
  const slowed = isSlowed(t);
  const red = rpm >= 8000;
  const W = 940;
  const stripW = 560;
  const win = 2.0;

  // what you hear: a tick per bang when slowed, a solid tone band at real speed
  const ticks: React.ReactNode[] = [];
  for (let i = firstBangAfter(Math.max(t - win, HUD_IN)); i < BANGS.length && BANGS[i].t <= t; i++) {
    const b = BANGS[i];
    if (!isSlowed(b.t)) break;
    const x = ((b.t - (t - win)) / win) * stripW;
    const age = (t - b.t) / win;
    ticks.push(<rect key={i} x={x - 2} y={12} width={5} height={34} fill={age < 0.06 ? "#ffffff" : YELLOW} opacity={1 - age * 0.75} />);
  }
  let band: string | null = null;
  if (t > REAL_SPEED_START) {
    const pts: string[] = [];
    const a = Math.max(t - win, REAL_SPEED_START);
    const n = 40;
    for (let k = 0; k <= n; k++) {
      const tt = a + ((t - a) * k) / n;
      const x = ((tt - (t - win)) / win) * stripW;
      const h = 6 + 22 * (rpmAt(tt) / REDLINE);
      pts.push(`${x},${29 - h}`);
    }
    for (let k = n; k >= 0; k--) {
      const tt = a + ((t - a) * k) / n;
      const x = ((tt - (t - win)) / win) * stripW;
      const h = 6 + 22 * (rpmAt(tt) / REDLINE);
      pts.push(`${x},${29 + h}`);
    }
    band = pts.join(" ");
  }
  const note = noteName(bangsPerSecond(rpmAt(t)));

  return (
    <div
      style={{
        position: "absolute",
        left: (1080 - W) / 2,
        top: 150,
        width: W,
        background: "rgba(13,14,31,0.92)",
        border: `4px solid ${BORDER}`,
        boxShadow: `0 0 0 4px ${INK}`,
        padding: "18px 28px 20px",
        transform: `scaleY(${pop})`,
        transformOrigin: "top",
        fontFamily: "VT323",
        color: CREAM,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "Silkscreen", fontSize: 24, color: DIM }}>
        <span>RPM</span>
        <span style={{ marginLeft: 210 }}>BANGS / SEC</span>
        <span style={{ color: slowed ? CREAM : YELLOW }}>{slowed ? `SLOWED ${SLOW}×` : "REAL SPEED"}</span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", height: 112, marginTop: -6 }}>
        <span style={{ fontSize: 132, width: 400, color: red ? RED : CREAM, lineHeight: 1 }}>{fmt(rpm)}</span>
        <span style={{ fontSize: 132, color: YELLOW, lineHeight: 1 }}>{fmt(bangs)}</span>
      </div>
      {/* rev bar */}
      <svg width={W - 56} height={26} style={{ display: "block", marginTop: 6 }}>
        <rect x={0} y={8} width={W - 56} height={10} fill="#262848" />
        <rect x={((8000 / 9000) * (W - 56)) | 0} y={8} width={(W - 56) * (1000 / 9000)} height={10} fill="#5a2232" />
        <rect x={0} y={8} width={(Math.min(rpm, 9000) / 9000) * (W - 56)} height={10} fill={red ? RED : CREAM} />
        {Array.from({ length: 10 }, (_, k) => (
          <rect key={k} x={(k / 9) * (W - 60)} y={0} width={4} height={k % 3 === 0 ? 8 : 5} fill={k >= 8 ? RED : DIM} />
        ))}
      </svg>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: 12 }}>
        <div>
          <div style={{ fontFamily: "Silkscreen", fontSize: 22, color: DIM, marginBottom: 4 }}>WHAT YOU HEAR</div>
          <svg width={stripW} height={58} style={{ display: "block" }}>
            <rect x={0} y={28} width={stripW} height={2} fill="#3a3d66" />
            {ticks}
            {band ? <polygon points={band} fill={YELLOW} /> : null}
          </svg>
        </div>
        <div style={{ textAlign: "right" }}>
          {slowed ? (
            <div style={{ fontSize: 46, color: CREAM, lineHeight: 1 }}>
              {(bangs / SLOW).toFixed(1)}
              <span style={{ fontSize: 30, color: DIM }}> CLICKS/S</span>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 40, lineHeight: 1, color: YELLOW, marginBottom: 6 }}>
                {fmt(bangsPerSecond(rpmAt(t)))} HZ · {note.name}
              </div>
              <Piano midi={note.midi} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ---------- captions ----------
const CHARS_PER_S = 42;
const Captions: React.FC<{ t: number }> = ({ t }) => {
  const cap = CAPTIONS.find((c) => t >= c.from && t < c.to);
  if (!cap) return null;
  const big = cap.size === "big";
  let start = cap.from;
  const shown = cap.lines.map((line) => {
    const n = Math.max(0, Math.min(line.length, Math.floor((t - start) * CHARS_PER_S)));
    start += line.length / CHARS_PER_S + 0.18;
    return { line, n };
  });
  const fade = Math.min(1, (cap.to - t) / 0.15, (t - cap.from) / 0.08);
  const allLen = Math.max(...cap.lines.map((l) => l.length));
  return (
    <div
      style={{
        position: "absolute",
        top: cap.y ?? 1290,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        opacity: fade,
      }}
    >
      <div
        style={{
          background: INK,
          border: `4px solid ${CREAM}`,
          boxShadow: `0 0 0 4px ${INK}`,
          padding: big ? "14px 30px 10px" : "10px 26px 6px",
          fontFamily: "VT323",
          fontSize: big ? 84 : 70,
          lineHeight: 1.0,
          color: CREAM,
          textAlign: "center",
          minWidth: `${allLen * 0.5}em`,
          letterSpacing: 2,
        }}
      >
        {shown.map(({ line, n }, i) => (
          <div key={i} style={{ whiteSpace: "pre" }}>
            <span>{line.slice(0, n)}</span>
            <span style={{ opacity: 0 }}>{line.slice(n)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ---------- labels pinned to 3D parts ----------
const Tag: React.FC<{ x: number; y: number; text: string; hot?: boolean; size?: number }> = ({ x, y, text, hot, size = 26 }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      transform: "translate(-50%, -50%)",
      background: hot ? YELLOW : INK,
      color: hot ? INK : CREAM,
      border: `3px solid ${hot ? YELLOW : CREAM}`,
      fontFamily: "Silkscreen",
      fontWeight: 700,
      fontSize: size,
      padding: "2px 8px 0",
      whiteSpace: "nowrap",
    }}
  >
    {text}
  </div>
);

const Labels: React.FC<{ t: number; w: number; h: number }> = ({ t, w, h }) => {
  const out: React.ReactNode[] = [];
  const slowed = isSlowed(t);
  if (SHOW_CYL_NUMBERS(t)) {
    for (let cyl = 1; cyl <= 12; cyl++) {
      const p = project(cylPoint(cyl, CAMS_LABEL_D, t), t, w, h);
      if (!p.visible) continue;
      const hot = slowed ? cycleAt(cyl, t) < 110 : false;
      out.push(<Tag key={`c${cyl}`} x={p.x} y={p.y} text={`${cyl}`} hot={hot} size={24} />);
    }
  }
  if (SHOW_BANK_LABELS(t)) {
    // anchored just outside each bank's exhaust headers, kept on screen
    const r = project(engineOrigin(t).add(new THREE.Vector3(-1.5, -0.5, -3.4)), t, w, h);
    const l = project(engineOrigin(t).add(new THREE.Vector3(-1.5, -0.5, 3.4)), t, w, h);
    const clampX = (x: number) => Math.min(w - 170, Math.max(170, x));
    out.push(<Tag key="rb" x={clampX(r.x)} y={r.y} text="RIGHT BANK" size={30} />);
    out.push(<Tag key="lb" x={clampX(l.x)} y={l.y} text="LEFT BANK" size={30} />);
  }
  if (SHOW_STROKE_TAG(t)) {
    const c = cycleAt(1, t);
    const p = project(crownWorld(1, t), t, w, h);
    const name = strokeName(c);
    out.push(
      <div key="lead" style={{ position: "absolute", left: p.x, top: p.y - 3, width: 150, height: 6, background: CREAM }} />
    );
    out.push(<Tag key="st" x={p.x + 150 + 120} y={p.y} text={`CYL 1: ${name}`} hot={name === "BANG"} size={32} />);
  }
  if (SHOW_CRANK_TAG(t)) {
    const p = project(engineOrigin(t).add(new THREE.Vector3(-0.8, 0, 0)), t, w, h);
    out.push(<div key="ckl" style={{ position: "absolute", left: p.x - 3, top: p.y, width: 6, height: 170, background: CREAM }} />);
    out.push(<Tag key="ck" x={p.x} y={p.y + 190} text="CRANKSHAFT" size={30} />);
  }
  return <>{out}</>;
};

// ---------- flashes on speed changes + end fade ----------
const Flash: React.FC<{ t: number }> = ({ t }) => {
  const f = (at: number) => Math.max(0, 1 - Math.abs(t - at) / 0.12);
  const flash = Math.max(f(3.0), f(REAL_SPEED_START)) * 0.55;
  const end = Math.min(1, Math.max(0, (t - 31.5) / 0.5));
  return (
    <>
      {flash > 0 ? <AbsoluteFill style={{ background: "#ffffff", opacity: flash }} /> : null}
      {end > 0 ? <AbsoluteFill style={{ background: INK, opacity: end }} /> : null}
    </>
  );
};

export const Overlay: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  useFonts();
  return (
    <AbsoluteFill>
      <Labels t={t} w={width} h={height} />
      <Hud t={t} />
      <Captions t={t} />
      <Flash t={t} />
    </AbsoluteFill>
  );
};
