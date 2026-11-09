// The 3D sets, built only from the framework's general shapes. Everything is a pure function of the time.
// The larynx model, the X-ray and the ratings meter are illustrations, and their titles say so.
import * as THREE from "three";
import { useCurrentFrame, useVideoConfig } from "remotion";
import type { V3 } from "../../src/core/camera";
import { hash } from "../../src/core/math";
import { easeOutCubic, hitPulse, lerp, noise, popIn, progress, staggered, track } from "../../src/core/motion";
import { PixelStage } from "../../src/core/PixelStage";
import { Arrow3D, Ball, Bar, Block, Cone, Particles, Ring, Tube } from "../../src/core/shapes";
import { barT, beatT, CRY_HIGH_HZ, CRY_LOW_HZ, LARYNX_COUNT, spectroHeight, VOCAL_PAD_MM } from "./physics";
import { cameraAt, KICKS, SETS, SPECTRO_COLS, SPECTRO_ROWS, SPECTROGRAM, STABS } from "./timeline";

const CRY = "#5ff2e6";
const RUMBLE = "#ff9a3d";
const SPARK = "#ffd27a";
const AIR = "#8fe8ff";
const SKIN = "#e0a67c";
const NOSE = "#e9757f";
const INNER_EAR = "#f2a6a0";

const mix = (a: string, b: string, u: number) => `#${new THREE.Color(a).lerp(new THREE.Color(b), u).getHexString()}`;
const within = (t: number, from: number, to: number) => t >= from - 0.05 && t < to + 0.05;
const frac = (v: number) => v - Math.floor(v);

// ---- Shared pieces ----
const WALL_Z = -16;

const Room: React.FC<{ wall: string; floor: string; dots?: string }> = ({ wall, floor, dots }) => (
  <>
    <Block position={[0, 30, WALL_Z - 0.5]} size={[130, 130, 1]} color={wall} glow={0.3} />
    <Block position={[0, -20, WALL_Z + 70]} size={[130, 40, 140]} color={floor} />
    {dots
      ? Array.from({ length: 56 }, (_, i) => {
          const row = Math.floor(i / 8);
          return <Block key={i} position={[((i % 8) - 3.5) * 7 + (row % 2) * 3.5, 3 + row * 7, WALL_Z + 0.1]} size={[1.2, 1.2, 0.1]} color={dots} glow={0.3} />;
        })
      : null}
  </>
);

/** Flat pixel art: each character in `rows` is one cube, and "." is empty. Centred on its position. */
const Sprite: React.FC<{ rows: string[]; cell: number; colors: Record<string, string>; glow?: number; position: V3 }> = ({ rows, cell, colors, glow, position }) => (
  <group position={position}>
    {rows.flatMap((row, y) =>
      row.split("").map((ch, x) => (ch === "." ? null : <Block key={`${x}-${y}`} position={[(x - (row.length - 1) / 2) * cell, ((rows.length - 1) / 2 - y) * cell, 0]} size={[cell, cell, cell]} color={colors[ch]} glow={glow} />)),
    )}
  </group>
);

const BOLT = ["...yy", "..yy.", ".yy..", "yyyy.", "..yy.", ".yy..", ".y..."];
const CROSS = ["r.....r", ".r...r.", "..r.r..", "...r...", "..r.r..", ".r...r.", "r.....r"];
const QUESTION = [".qqq.", "q...q", "....q", "...q.", "..q..", ".....", "..q.."];

/** Comic vibration marks either side of a purring cat, kicked outward on the beat. */
const PurrMarks: React.FC<{ t: number; position: V3; spread: number; height: number; color: string; size?: number }> = ({ t, position, spread, height, color, size = 0.5 }) => {
  const kick = hitPulse(t, KICKS, 0.28);
  return (
    <group position={position}>
      {[-1, 1].flatMap((side) =>
        [-1, 0, 1].map((row) => (
          <Block
            key={`${side}${row}`}
            position={[side * (spread + (row === 0 ? size * 0.9 : 0) + kick * size * 2), row * height, 0]}
            size={[size * 0.7, size * (row === 0 ? 2.4 : 1.7) * (0.5 + kick), size * 0.7]}
            color={color}
            glow={0.9}
          />
        )),
      )}
    </group>
  );
};

const Plant: React.FC<{ t: number; position: V3; seed: number; scale: number }> = ({ t, position, seed, scale }) => (
  <group position={position} scale={scale}>
    <Block position={[0, 1.2, 0]} size={[2.6, 2.4, 2.6]} color="#b5603c" />
    {Array.from({ length: 7 }, (_, i) => {
      const angle = (i / 7) * Math.PI * 2 + seed;
      const tilt = 0.35 + hash(i, seed) * 0.5 + noise(t * 0.6, i + seed) * 0.05;
      return <Cone key={i} position={[Math.cos(angle) * 1.2, 4.2, Math.sin(angle) * 1.2]} rotation={[Math.sin(angle) * tilt, 0, -Math.cos(angle) * tilt]} radius={0.9} height={5} sides={5} color={i % 2 ? "#3f8f55" : "#2f7a4a"} />;
    })}
  </group>
);

// ---- Cats ----
type Coat = { fur: string; dark: string; cream: string; eye: string; glow?: number };

const GINGER: Coat = { fur: "#e8923a", dark: "#a8561e", cream: "#fff0dc", eye: "#a5e04a" };
const SMOKE: Coat = { fur: "#7d8a94", dark: "#4d5862", cream: "#eef2f2", eye: "#6fd0e0" };
const CREAM: Coat = { fur: "#f0d2a0", dark: "#c89a62", cream: "#fff6e8", eye: "#6fb0e8", glow: 0.4 };
const INK: Coat = { fur: "#3a3446", dark: "#231f2c", cream: "#e8e4f0", eye: "#e8d04a" };

/** A blocky head, 10 wide, centred on the skull and facing +z. `open` runs from shut to wide open. */
const CatHead: React.FC<{ coat: Coat; open: number; lookX?: number; lookY?: number; pupil?: number; earsBack?: number; mouth?: number; whisker?: number }> = ({ coat, open, lookX = 0, lookY = 0, pupil = 1, earsBack = 0, mouth = 0, whisker = 0.07 }) => {
  const { fur, dark, cream, eye, glow } = coat;
  const eyeHeight = 1.5 * open;
  return (
    <group>
      <Block size={[8.4, 5, 6]} color={fur} glow={glow} />
      <Block position={[0, -0.85, 0.2]} size={[10, 2.6, 5]} color={fur} glow={glow} />
      {[-1.3, 0, 1.3].map((x) => (
        <Block key={x} position={[x, x === 0 ? 1.7 : 1.55, 3.03]} size={[0.5, 1.5, 0.1]} color={dark} />
      ))}
      {[-1, 1].flatMap((side) =>
        [-0.45, -1.2].map((y) => <Block key={`${side}${y}`} position={[side * 4.45, y, 2.74]} size={[1.1, 0.3, 0.1]} color={dark} />),
      )}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 3, 2.2, -0.4]} rotation={[-0.9 * earsBack, 0, -side * (0.18 + earsBack)]}>
          <Cone position={[0, 1, 0]} rotation={[0, Math.PI / 4, 0]} radius={1.75} height={2.4} sides={4} color={fur} glow={glow} />
          <Cone position={[0, 0.85, 0.62]} rotation={[0, Math.PI / 4, 0]} radius={1.05} height={1.6} sides={4} color={INNER_EAR} glow={0.25} />
        </group>
      ))}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 2.2, 0.25, 3.05]}>
          {open > 0.04 ? (
            <>
              <Block position={[0, eyeHeight / 2, 0]} size={[1.9, eyeHeight, 0.12]} color={eye} glow={0.6} />
              <Block position={[lookX, eyeHeight / 2 + lookY * open, 0.1]} size={[0.5 * pupil, Math.max(0.18, eyeHeight * 0.92), 0.1]} color="#14100c" />
            </>
          ) : null}
          {open > 0.4 ? <Block position={[0.4 + lookX, eyeHeight * 0.72, 0.17]} size={[0.3, 0.3, 0.06]} color="#ffffff" glow={1} /> : null}
          <Block position={[0, eyeHeight + 0.12, 0.1]} size={[2.2, 0.28, 0.16]} color={dark} />
        </group>
      ))}
      <Block position={[0, -1.55, 3.25]} size={[3.6, 1.7, 0.9]} color={cream} glow={0.5} />
      <Block position={[0, -0.75, 3.75]} size={[0.9, 0.55, 0.2]} color={NOSE} glow={0.3} />
      <Block position={[0, -1.25, 3.74]} size={[0.16, 0.5, 0.1]} color={dark} />
      {[-0.55, 0.55].map((x) => (
        <Block key={x} position={[x, -1.55, 3.74]} size={[1, 0.16, 0.1]} color={dark} />
      ))}
      {mouth > 0.05 ? <Block position={[0, -1.72 - mouth * 0.45, 3.76]} size={[1.5, mouth * 0.9, 0.1]} color="#7a2233" /> : null}
      {[-1, 1].flatMap((side) =>
        [-1, 0, 1].map((k) => <Bar key={`${side}${k}`} from={[side * 1.7, -1.5 + k * 0.22, 3.6]} to={[side * 6.4, -1.3 + k * 0.75, 3.1]} radius={whisker} color="#fff8ea" glow={0.6} sides={4} />),
      )}
    </group>
  );
};

const TAIL_SEGMENTS = 7;

const Tail: React.FC<{ t: number; base: V3; side: number; lift: number; length: number; radius: number; color: string; seed: number }> = ({ t, base, side, lift, length, radius, color, seed }) => {
  const point = (i: number): V3 => {
    const u = i / TAIL_SEGMENTS;
    const sway = Math.sin(t * 2.2 + seed + u * 3.2) * u * length * 0.16;
    return [base[0] + side * u * length * (1 - lift) + sway * lift, base[1] + lift * u * length, base[2] + sway * (1 - lift)];
  };
  return (
    <>
      {Array.from({ length: TAIL_SEGMENTS }, (_, i) => (
        <Bar key={i} from={point(i)} to={point(i + 1)} radius={radius} color={color} sides={6} />
      ))}
    </>
  );
};

/** A cat sitting upright, about 7 tall, facing +z with its feet at the origin. */
const SittingCat: React.FC<{ t: number; coat: Coat; open: number; headRot?: V3; lookX?: number; lookY?: number; pupil?: number; mouth?: number; tailSide?: number }> = ({ t, coat, open, headRot = [0, 0, 0], lookX, lookY, pupil, mouth, tailSide = 1 }) => (
  <group>
    <Block position={[0, 1.5, -0.7]} size={[3.6, 3, 3.2]} color={coat.fur} glow={coat.glow} />
    <Block position={[0, 2.4, 0.5]} size={[2.8, 3.2, 1.9]} color={coat.fur} glow={coat.glow} />
    <Block position={[0, 2.3, 1.5]} size={[1.7, 2.2, 0.16]} color={coat.cream} glow={0.5} />
    {[-1, 1].map((side) => (
      <group key={side}>
        <Block position={[side * 0.78, 1.05, 1.15]} size={[0.85, 2.1, 0.85]} color={coat.fur} glow={coat.glow} />
        <Block position={[side * 0.78, 0.25, 1.55]} size={[1.05, 0.5, 1.25]} color={coat.cream} glow={0.5} />
        {[-1.6, -0.6].map((z) => (
          <Block key={z} position={[side * 1.82, 1.8, z]} size={[0.06, 1.6, 0.4]} color={coat.dark} />
        ))}
      </group>
    ))}
    <Tail t={t} base={[tailSide * 1.4, 0.35, -2]} side={tailSide} lift={0.04} length={3.2} radius={0.3} color={coat.dark} seed={2} />
    <group position={[0, 5, 0.8]} rotation={headRot} scale={0.45}>
      <CatHead coat={coat} open={open} lookX={lookX} lookY={lookY} pupil={pupil} mouth={mouth} whisker={0.11} />
    </group>
  </group>
);

/** A cat lying with its paws tucked, facing +z. `crouch` lowers the head and hunches the back. */
const LoafCat: React.FC<{ t: number; coat: Coat; open: number; crouch?: number; earsBack?: number; pupil?: number; lookX?: number }> = ({ t, coat, open, crouch = 0, earsBack = 0, pupil, lookX }) => {
  const haunch = 3.3 + 0.5 * crouch;
  return (
    <group>
      <Block position={[0, 1.4, -1.6]} size={[4.2, 2.8, 6]} color={coat.fur} glow={coat.glow} />
      <Block position={[0, haunch / 2, -3.4]} size={[4.6, haunch, 2.6]} color={coat.fur} glow={coat.glow} />
      <Block position={[0, 1.2, 1.7]} size={[3.2, 2.2, 1.2]} color={coat.cream} glow={0.5} />
      {[-0.8, -1.9, -3].map((z) => (
        <Block key={z} position={[0, z < -2.5 ? haunch + 0.02 : 2.82, z]} size={[4.3, 0.08, 0.5]} color={coat.dark} />
      ))}
      {[-1, 1].map((side) => (
        <Block key={side} position={[side, 0.35, 2.4]} size={[1.2, 0.7, 1.7]} color={coat.cream} glow={0.5} />
      ))}
      <Tail t={t} base={[1.8, 0.5, -4.7]} side={1} lift={0.04} length={4} radius={0.32} color={coat.dark} seed={5} />
      <group position={[0, 3.7 - crouch, 1.8]} scale={0.55}>
        <CatHead coat={coat} open={open} earsBack={earsBack} pupil={pupil} lookX={lookX} whisker={0.1} />
      </group>
    </group>
  );
};

/** Faces -z, so that it nurses against something behind it. */
const Kitten: React.FC<{ t: number; coat: Coat; seed: number; position: V3; turn: number }> = ({ t, coat, seed, position, turn }) => {
  const knead = Math.sin((t / beatT(1)) * Math.PI * 2 + seed);
  const wag = Math.sin(t * 5 + seed) * 0.35;
  return (
    <group position={position} rotation={[0, turn, 0]}>
      <Block position={[0, 0.72 + 0.04 * knead, 0]} size={[1.5, 1.3, 2.3]} color={coat.fur} glow={coat.glow} />
      <Ball position={[0, 1.05, -1.4]} radius={0.95} detail={8} color={coat.fur} glow={coat.glow} />
      {[-1, 1].map((side) => (
        <Cone key={side} position={[side * 0.52, 2, -1.4]} rotation={[0, Math.PI / 4, side * -0.2]} radius={0.42} height={0.8} sides={4} color={coat.dark} />
      ))}
      {[-1, 1].map((side) => (
        <Block key={side} position={[side * 0.55, 0.22 + 0.1 * Math.max(0, knead * side), -1.2]} size={[0.5, 0.44, 0.7]} color={coat.cream} glow={0.5} />
      ))}
      <Bar from={[0, 1.2, 1.1]} to={[wag, 2.9, 1.45]} radius={0.2} color={coat.dark} sides={6} />
    </group>
  );
};

// ---- The hook: a close-up of a purring cat ----
const PortraitSet: React.FC<{ t: number }> = ({ t }) => {
  const stab = hitPulse(t, STABS, 0.22);
  const kick = hitPulse(t, KICKS, 0.16);
  const open = track(t, [
    { t: 0, v: 0.42 },
    { t: barT(1) - beatT(0.5), v: 0.42 },
    { t: barT(1), v: 0.08 },
    { t: barT(1) + beatT(1), v: 0.08 },
    { t: barT(1) + beatT(2), v: 0.46 },
  ]);
  return (
    <group position={[SETS.portrait, 0, 0]}>
      <Room wall="#2f5a48" floor="#6b3f2f" dots="#376650" />
      <Plant t={t} position={[16, 0, -9]} seed={3} scale={1.7} />
      <Plant t={t} position={[-17, 0, -10]} seed={8} scale={2} />
      <Block position={[0, 0.7, 1]} size={[32, 1.4, 20]} color="#b5523c" />
      <Particles t={t} count={24} seed={11} origin={[-18, 2, -4]} box={[36, 26, 10]} velocity={[0.3, 0.5, 0]} size={0.22} colors={["#fff6d8"]} glow={0.9} />
      <group scale={[1, 1 + 0.02 * kick, 1]}>
        <Block position={[0, 3, -1]} size={[14, 6, 9]} color={GINGER.fur} />
        <Block position={[0, 3.2, 3.6]} size={[7, 5, 0.3]} color={GINGER.cream} glow={0.5} />
        {[-1, 1].map((side) => (
          <Block key={side} position={[side * 3.4, 1.9, 4.6]} size={[3.2, 1.6, 3.6]} color={GINGER.cream} glow={0.5} />
        ))}
      </group>
      <group position={[noise(t * 24, 1) * 0.1, 11 + noise(t * 24, 2) * 0.1 + kick * 0.18, 0]} scale={2 * (1 + 0.03 * stab)}>
        <CatHead coat={GINGER} open={open} />
      </group>
      <PurrMarks t={t} position={[0, 4.2, 4]} spread={8.6} height={1.4} color={SPARK} size={0.7} />
    </group>
  );
};

// ---- A slow, deep wave leaves the throat ----
const WAVE_COLS = 34;
const WAVE_STEP = 0.64;
const WAVE_START = -8.6;
const WAVE_LENGTH = 14;
const WAVE_AMP = 3.2;
const WAVE_Y = 5.4;

const WaveSet: React.FC<{ t: number }> = ({ t }) => {
  const kick = hitPulse(t, KICKS, 0.2);
  const reveal = progress(t, barT(2), barT(2) + beatT(2));
  const rollS = beatT(2);
  return (
    <group position={[SETS.wave, 0, 0]}>
      <Room wall="#1f3d3a" floor="#2d5a4a" dots="#264a45" />
      <group position={[-12.5, 0, 0]} rotation={[0, 0.95, 0]} scale={1.35}>
        <SittingCat t={t} coat={GINGER} open={0.45} tailSide={-1} />
      </group>
      <Ball position={[-10.6, WAVE_Y, 1.6]} radius={0.7 + 0.5 * kick} detail={10} color={SPARK} glow={1.2} />
      <Block position={[WAVE_START + (WAVE_COLS * WAVE_STEP) / 2, WAVE_Y, -0.8]} size={[WAVE_COLS * WAVE_STEP + 1, 0.12, 0.2]} color="#7fae98" glow={0.5} />
      {Array.from({ length: WAVE_COLS }, (_, i) => {
        const u = i / (WAVE_COLS - 1);
        if (u > reveal) return null;
        const v = WAVE_AMP * (1 + 0.18 * kick) * Math.sin(((i * WAVE_STEP) / WAVE_LENGTH) * Math.PI * 2 - (t / rollS) * Math.PI * 2);
        const x = WAVE_START + i * WAVE_STEP;
        return (
          <group key={i}>
            <Block position={[x, WAVE_Y + v / 2, 0]} size={[WAVE_STEP * 0.72, Math.max(0.12, Math.abs(v)), 1.1]} color={mix("#ffb347", "#e4572e", u)} glow={0.7} />
            <Block position={[x, WAVE_Y + v, 0.2]} size={[WAVE_STEP * 0.9, 0.4, 1.4]} color="#fff0c0" glow={1} />
          </group>
        );
      })}
    </group>
  );
};

// ---- An illustrated larynx on a bench, with air flowing through a cutaway ----
const TUBE_Y = 5.4;
const TUBE_HALF = 10;
const FOLD_RADIUS = 1.55;
const MODEL_UNITS_PER_MM = 0.4;
const PAD_RADIUS = (VOCAL_PAD_MM * MODEL_UNITS_PER_MM) / 2;
const AIR_PARTICLES = 46;
const TISSUE = "#f2a096";

const LabSet: React.FC<{ t: number }> = ({ t }) => {
  const from = barT(3.25);
  const kick = hitPulse(t, KICKS, 0.2);
  // Far slower than the real 25 to 30 Hz, so that the motion can be seen. The diagram title marks the model as illustrated.
  const flutter = 0.5 + 0.5 * Math.sin((t / beatT(0.5)) * Math.PI * 2);
  const gap = 0.2 + 0.95 * flutter;
  const vials = progress(t, from, from + beatT(4));
  const noNerves = popIn(t, barT(4.75), 0.25);
  const airCrossS = beatT(3);
  return (
    <group position={[SETS.lab, 0, 0]}>
      <Room wall="#234f52" floor="#4a6d56" dots="#2a5a5c" />
      <Block position={[-12.6, 3.5, 0]} size={[4.6, 7, 5]} color="#cfe8df" glow={0.5} />
      <Block position={[-12.6, 5, 2.55]} size={[3, 2, 0.1]} color="#59c8d8" glow={0.8} />
      <Block position={[-10.3, TUBE_Y, 0]} size={[1, 4.4, 3.6]} color="#9fbfb5" />
      <Particles t={t} count={14} seed={31} origin={[-14.6, 7, -1.5]} box={[3.6, 5, 3]} velocity={[0.2, 1.6, 0]} size={0.4} colors={["#e8f8ff", AIR]} glow={0.7} />
      {[-7, 7].map((x) => (
        <Block key={x} position={[x, 0.85, 0]} size={[0.9, 1.7, 2]} color="#6f8a90" />
      ))}
      <Block position={[0, TUBE_Y, -2.4]} size={[TUBE_HALF * 2, 5.4, 0.4]} color="#6a2f3c" glow={0.3} />
      {[-1, 1].map((side) => (
        <group key={side}>
          <Block position={[0, TUBE_Y + side * 3.2, 0]} size={[TUBE_HALF * 2, 1, 5]} color={TISSUE} glow={0.3} />
          <Ball position={[0, TUBE_Y + side * (gap + FOLD_RADIUS), 0]} radius={FOLD_RADIUS} detail={12} color="#ff8f86" glow={0.35} />
          <Ball position={[0, TUBE_Y + side * (gap + 1), 1.4]} radius={PAD_RADIUS} detail={10} color="#ffd9a0" glow={0.5} />
        </group>
      ))}
      {Array.from({ length: AIR_PARTICLES }, (_, i) => {
        const x = -TUBE_HALF + 2 * TUBE_HALF * frac(t / airCrossS + hash(i, 31));
        const open = 1 - Math.exp(-(x * x) / 3);
        const halfHeight = lerp(gap * 0.9, 2.2, open);
        return <Block key={i} position={[x, TUBE_Y + (hash(i, 32) - 0.5) * 2 * halfHeight, 1.2 + (hash(i, 33) - 0.5) * 2]} size={[0.3, 0.3, 0.3]} color={i % 2 ? AIR : "#ffe6b8"} glow={0.9} />;
      })}
      {[0, 1, 2].map((k) => {
        const u = frac(t / beatT(1) + k / 3);
        return <Ring key={k} position={[TUBE_HALF + 0.6 + 3 * u, TUBE_Y, 0]} rotation={[0, Math.PI / 2, 0]} radius={1.6 + 1.2 * u} tube={0.1} color={SPARK} glow={0.9} />;
      })}
      {Array.from({ length: LARYNX_COUNT }, (_, i) => {
        const lit = easeOutCubic(staggered(vials, i, LARYNX_COUNT));
        return (
          <group key={i} position={[(i - (LARYNX_COUNT - 1) / 2) * 2.4, 0, 6.5]}>
            <Block position={[0, 1.05, 0]} size={[1.2, 2.1, 1.2]} color="#bff0e2" glow={0.5} />
            <Block position={[0, 2.3, 0]} size={[1.3, 0.4, 1.3]} color="#2f5f6a" />
            {lit > 0.02 ? <Block position={[0, 0.25 + 0.8 * lit, 0.62]} size={[0.8, 1.6 * lit, 0.06]} color={TISSUE} glow={0.6 + 0.4 * kick} /> : null}
          </group>
        );
      })}
      {t < barT(4.75) ? <Arrow3D from={[-9.4, TUBE_Y, 2.7]} to={[-4.4, TUBE_Y, 2.7]} radius={0.28} color={AIR} glow={0.8} /> : null}
      {noNerves > 0 ? (
        <group position={[-6, TUBE_Y, 3]} scale={Math.max(0.001, noNerves)}>
          <Sprite rows={BOLT} cell={0.5} colors={{ y: "#ffe45e" }} glow={0.9} position={[0, 0, 0]} />
          <Sprite rows={CROSS} cell={0.62} colors={{ r: "#ff4d4d" }} glow={1} position={[0, 0, 0.5]} />
        </group>
      ) : null}
    </group>
  );
};

// ---- Kittens nursing against their mother ----
const LITTER: { coat: Coat; x: number; turn: number }[] = [
  { coat: SMOKE, x: -3.6, turn: 0.35 },
  { coat: GINGER, x: -1.2, turn: 0.1 },
  { coat: CREAM, x: 1.2, turn: -0.12 },
  { coat: INK, x: 3.6, turn: -0.35 },
];

const NurserySet: React.FC<{ t: number }> = ({ t }) => {
  const breath = 1 + 0.03 * Math.sin(t * 2.4);
  return (
    <group position={[SETS.nursery, 0, 0]}>
      <Room wall="#55633a" floor="#a86a4a" dots="#5f6f42" />
      {Array.from({ length: 7 }, (_, i) => (
        <Ball key={i} position={[(i - 3) * 6, 2, -7]} radius={3.2} detail={8} color={i % 2 ? "#c98a5a" : "#b97a4c"} />
      ))}
      <group position={[0, 0, -1]}>
        <group scale={[1, breath, 1]}>
          <Block position={[0, 1.9, 0]} size={[11, 3.8, 4.4]} color={GINGER.fur} />
          <Block position={[0, 1, 2.25]} size={[8.6, 1.6, 0.16]} color={GINGER.cream} glow={0.5} />
          {[-4, -2, 0, 2, 4].map((x) => (
            <group key={x}>
              <Block position={[x, 3.82, 0]} size={[0.7, 0.08, 4.4]} color={GINGER.dark} />
              <Block position={[x, 2.9, 2.22]} size={[0.7, 1.6, 0.1]} color={GINGER.dark} />
            </group>
          ))}
        </group>
        <Block position={[4.6, 0.55, 2.9]} size={[3.2, 1.1, 2]} color={GINGER.fur} />
        <Block position={[3.1, 0.35, 3.6]} size={[1.4, 0.7, 1.2]} color={GINGER.cream} glow={0.5} />
        <Block position={[-4.6, 0.5, 2.6]} size={[2.8, 1, 1.8]} color={GINGER.fur} />
        <Tail t={t} base={[5.5, 0.6, 0]} side={1} lift={0.05} length={4.4} radius={0.36} color={GINGER.dark} seed={1} />
        <group position={[-7, 3.1, 0.9]} rotation={[0.05, 0.55, 0.16]} scale={0.62}>
          <CatHead coat={GINGER} open={0.12} whisker={0.09} />
        </group>
      </group>
      {LITTER.map(({ coat, x, turn }, i) => (
        <group key={x}>
          <Kitten t={t} coat={coat} seed={i * 1.7} position={[x, 0, 3.25]} turn={turn} />
          <PurrMarks t={t} position={[x, 2.9, 3.4]} spread={0.8} height={0.32} color={SPARK} size={0.18} />
        </group>
      ))}
    </group>
  );
};

// ---- A frightened cat on a vet's table, purring anyway ----
const VetSet: React.FC<{ t: number }> = ({ t }) => (
  <group position={[SETS.vet, 0, 0]}>
    <Room wall="#2e4a5c" floor="#3f5b66" dots="#375669" />
    <Block position={[9, 9, WALL_Z + 0.2]} size={[7, 9, 0.2]} color="#5f7f8f" glow={0.25} />
    {[0, 1, 2].map((i) => (
      <Block key={i} position={[9, 11.5 - i * 2, WALL_Z + 0.35]} size={[5, 0.5, 0.1]} color="#2e4a5c" />
    ))}
    <Block position={[0, 5.65, 0]} size={[24, 0.7, 13]} color="#d7e4ea" glow={0.5} />
    {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <Block key={`${sx}${sz}`} position={[sx * 10.5, 2.65, sz * 5]} size={[1.1, 5.3, 1.1]} color="#8fa3ad" />))}
    <Ring position={[-7, 6.12, 3]} rotation={[Math.PI / 2, 0, 0]} radius={1.4} tube={0.12} color="#2b3a44" />
    <group position={[noise(t * 26, 3) * 0.07, 6, 1]} rotation={[0, 0.4, 0]} scale={1.25}>
      <LoafCat t={t} coat={GINGER} open={1} crouch={1} earsBack={1} pupil={1.7} lookX={-0.25} />
    </group>
    <PurrMarks t={t} position={[0, 8.6, 3]} spread={6.4} height={1.1} color="#9fdcff" size={0.42} />
  </group>
);

// ---- An illustrated X-ray of a leg bone ----
const BONE_Y = 3.7;
const BONE = "#eef8ff";
const CRACK = "#0f2a3c";

const XRaySet: React.FC<{ t: number }> = ({ t }) => {
  const from = barT(8.75);
  const kick = hitPulse(t, KICKS, 0.2);
  const mark = popIn(t, from + beatT(1), 0.3);
  const scan = frac((t - from) / beatT(4));
  return (
    <group position={[SETS.xray, 0, 0]}>
      <Room wall="#13222e" floor="#1a3140" />
      <Block position={[0, 6.8, -0.5]} size={[28, 13.6, 1]} color="#2e4352" />
      <Block position={[0, 6.8, 0.1]} size={[26, 11.6, 0.2]} color="#123a52" glow={0.9} />
      <Block position={[-1, BONE_Y, 0.25]} size={[21, 5, 0.1]} color="#1f5f7f" glow={0.8} />
      <Block position={[10.2, BONE_Y - 0.9, 0.25]} size={[3.6, 3, 0.1]} color="#1f5f7f" glow={0.8} />
      <Block position={[-13 + 26 * scan, 6.8, 0.4]} size={[0.3, 11.6, 0.1]} color="#7fe9ff" glow={1} />
      <Bar from={[-9, BONE_Y, 0.6]} to={[9, BONE_Y, 0.6]} radius={0.6} color={BONE} glow={1.1} />
      {[-1, 1].flatMap((side) =>
        [-1, 1].map((k) => <Ball key={`${side}${k}`} position={[side * 9.3, BONE_Y + k * 0.6, 0.6]} radius={1.05} detail={10} color={BONE} glow={1.1} />),
      )}
      <Bar from={[0.6, BONE_Y + 0.7, 1.25]} to={[1.3, BONE_Y + 0.2, 1.25]} radius={0.1} color={CRACK} sides={4} />
      <Bar from={[1.3, BONE_Y + 0.2, 1.25]} to={[0.7, BONE_Y - 0.2, 1.25]} radius={0.1} color={CRACK} sides={4} />
      <Bar from={[0.7, BONE_Y - 0.2, 1.25]} to={[1.4, BONE_Y - 0.7, 1.25]} radius={0.1} color={CRACK} sides={4} />
      {[0, 1, 2].map((k) => (
        <Ring key={k} position={[1, BONE_Y, 0.5]} radius={0.9 + 3.2 * frac(t / beatT(1) + k / 3)} tube={0.07} color="#7fe9ff" glow={0.9} />
      ))}
      {mark > 0 ? (
        <group position={[0, 9.3, 0.8]} scale={Math.max(0.001, mark * (1 + 0.1 * kick))}>
          <Sprite rows={QUESTION} cell={0.62} colors={{ q: "#ffd84a" }} glow={1.1} position={[0, 0, 0]} />
        </group>
      ) : null}
    </group>
  );
};

// ---- A cat, its owner and an empty bowl ----
const SeatedOwner: React.FC<{ nod: number }> = ({ nod }) => {
  const shirt = "#3f7fbf";
  const pants = "#39506e";
  return (
    <group>
      <Block position={[0, 3.3, 0.2]} size={[3.8, 0.6, 3.8]} color="#8a5a3a" />
      {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <Block key={`${sx}${sz}`} position={[sx * 1.5, 1.5, 0.2 + sz * 1.5]} size={[0.4, 3, 0.4]} color="#6a4228" />))}
      <Block position={[0, 6.2, -0.2]} size={[3.8, 4.6, 2.2]} color={shirt} />
      <Block position={[0, 8.8, -0.1]} size={[1.2, 0.6, 1.2]} color={SKIN} />
      {[-1, 1].map((side) => (
        <group key={side}>
          <Block position={[side * 0.85, 4.25, 1.4]} size={[1.3, 1.3, 4]} color={pants} />
          <Block position={[side * 0.85, 1.8, 3.1]} size={[1.2, 3.6, 1.2]} color={pants} />
          <Block position={[side * 0.85, 0.35, 3.5]} size={[1.4, 0.7, 2.2]} color="#2a2430" />
          <Block position={[side * 2.45, 6.6, 0.1]} size={[1, 3.2, 1]} color={shirt} />
          <Block position={[side * 2.4, 5.1, 1.4]} size={[0.95, 0.95, 2.8]} color={shirt} />
          <Block position={[side * 2.4, 5.1, 3]} size={[1, 0.9, 0.9]} color={SKIN} />
        </group>
      ))}
      <group position={[0, 10.3, -0.1]} rotation={[0.35 + 0.05 * nod, 0, 0]}>
        <Block size={[2.9, 3, 2.8]} color={SKIN} />
        <Block position={[0, 1.3, -0.1]} size={[3.1, 0.9, 3]} color="#4a2f20" />
        <Block position={[0, 0.2, -1.4]} size={[3.1, 2, 0.6]} color="#4a2f20" />
        {[-1, 1].map((side) => (
          <Block key={side} position={[side * 0.7, 0.2, 1.42]} size={[0.4, 0.45, 0.1]} color="#1a1420" />
        ))}
        <Block position={[0, -0.8, 1.42]} size={[0.9, 0.16, 0.1]} color="#7a3a34" />
      </group>
    </group>
  );
};

const BOWL: V3 = [7, 0, 3];

const KitchenSet: React.FC<{ t: number }> = ({ t }) => {
  const kick = hitPulse(t, KICKS, 0.2);
  const mew = hitPulse(t, STABS, 0.25);
  const hint = progress(t, barT(11) + beatT(2), barT(12));
  return (
    <group position={[SETS.kitchen, 0, 0]}>
      <Room wall="#6e8a5e" floor="#6f7f5f" />
      {Array.from({ length: 108 }, (_, i) => {
        const col = i % 9;
        const row = Math.floor(i / 9);
        return (col + row) % 2 === 0 ? <Block key={i} position={[(col - 4) * 7, 0.02, row * 7 - 12]} size={[7, 0.04, 7]} color="#8f9f7a" /> : null;
      })}
      <Block position={[0, 4.5, WALL_Z + 2]} size={[60, 9, 4]} color="#3f5f4c" />
      <Block position={[0, 9.4, WALL_Z + 2.2]} size={[60, 0.8, 5]} color="#d9cfb8" glow={0.5} />
      <Block position={[0, 28, WALL_Z + 1.5]} size={[60, 12, 3]} color="#3f5f4c" />
      <Plant t={t} position={[-16, 9.8, WALL_Z + 2.4]} seed={5} scale={1} />
      <group position={[-8.5, 0, 0]} rotation={[0, 0.9, 0]}>
        <SeatedOwner nod={kick} />
      </group>
      <Bar from={BOWL} to={[BOWL[0], 1.1, BOWL[2]]} radius={2} color="#d94f4f" />
      <Bar from={[BOWL[0], 1.1, BOWL[2]]} to={[BOWL[0], 1.14, BOWL[2]]} radius={1.55} color="#6a2a2a" />
      <Ring position={[BOWL[0], 1.12, BOWL[2]]} rotation={[Math.PI / 2, 0, 0]} radius={1.75} tube={0.2} color="#f07a6a" glow={0.3} />
      <group position={[2, 0, 1]} rotation={[0, -0.75, 0]}>
        <SittingCat t={t} coat={GINGER} open={0.95} headRot={[-0.45, -0.15, 0]} lookY={0.2} pupil={1.8} mouth={mew} />
      </group>
      <PurrMarks t={t} position={[1.6, 2.2, 3]} spread={3.4} height={0.7} color={SPARK} size={0.32} />
      {hint > 0
        ? Array.from({ length: 10 }, (_, i) => (i / 9 <= hint ? <Block key={i} position={[3.6 + i * 0.55, 5.6 + Math.sin(i * 1.7 + t * 14) * 0.4, 1.8]} size={[0.34, 0.34, 0.34]} color={CRY} glow={1.1} /> : null))
        : null}
    </group>
  );
};

// ---- The spectrogram, as cubes ----
/** Centred on its group. `cryShown` says how much of the cry shows in a column, from 0 to 1. */
const CellWall: React.FC<{ t: number; cell: number; cryShown: (col: number) => number }> = ({ t, cell, cryShown }) => {
  const kick = hitPulse(t, KICKS, 0.2);
  const tile = cell * 0.86;
  return (
    <>
      {SPECTROGRAM.flatMap((line, row) =>
        line.split("").map((ch, col) => {
          const x = (col - (SPECTRO_COLS - 1) / 2) * cell;
          const y = ((SPECTRO_ROWS - 1) / 2 - row) * cell;
          if (ch === "P") return <Block key={`${row}-${col}`} position={[x, y, kick * cell * 0.5]} size={[tile, tile, cell * 0.6]} color={RUMBLE} glow={0.55 + 0.5 * kick} />;
          if (ch !== "C") return null;
          const shown = cryShown(col);
          if (shown <= 0.01) return null;
          return <Block key={`${row}-${col}`} position={[x, y, shown * cell * 0.7]} size={[tile * shown, tile * shown, cell * 0.6]} color={CRY} glow={0.8 + 0.3 * noise(t * 5, col + row * 40)} />;
        }),
      )}
    </>
  );
};

const CELL = 0.8;
const WALL_W = SPECTRO_COLS * CELL;
const WALL_H = SPECTRO_ROWS * CELL;
const WALL_CENTRE_Y = 6.2;

const SpectrumSet: React.FC<{ t: number }> = ({ t }) => {
  const from = barT(12);
  const reveal = progress(t, from, from + beatT(3));
  const bracket = easeOutCubic(progress(t, barT(13.25), barT(13.25) + beatT(1)));
  return (
    <group position={[SETS.spectrum, 0, 0]}>
      <Room wall="#14262e" floor="#1e3a3a" dots="#1a3039" />
      <group position={[0, WALL_CENTRE_Y, 0]}>
        <Block position={[0, 0, -0.8]} size={[WALL_W + 0.8, WALL_H + 0.8, 0.5]} color="#0d1b22" />
        <CellWall t={t} cell={CELL} cryShown={(col) => easeOutCubic(staggered(reveal, col, SPECTRO_COLS, 0.75))} />
        {bracket > 0.01
          ? [CRY_LOW_HZ, CRY_HIGH_HZ].map((hz) => {
              const y = (spectroHeight(hz) - 0.5) * WALL_H;
              const half = (WALL_W / 2) * bracket;
              return <Bar key={hz} from={[-half, y, 1.1]} to={[half, y, 1.1]} radius={0.12} color="#fff2a8" glow={1.1} sides={6} />;
            })
          : null}
        <group position={[0, -1.45, 1.6]} scale={0.62}>
          <CatHead coat={GINGER} open={0.55} lookY={0.15} whisker={0.09} />
        </group>
        <PurrMarks t={t} position={[0, -2, 2]} spread={4.4} height={0.7} color={SPARK} size={0.35} />
      </group>
    </group>
  );
};

// ---- A listener rates a recorded purr while the cry is erased ----
const HEADBAND: V3[] = Array.from({ length: 9 }, (_, i): V3 => [Math.cos((i / 8) * Math.PI) * 2.3, Math.sin((i / 8) * Math.PI) * 2.3, 0]);

const Listener: React.FC<{ nod: number }> = ({ nod }) => (
  <group>
    <Block position={[0, 2.5, 0]} size={[6.6, 5, 3.4]} color="#b5523c" />
    <Block position={[0, 5.3, 0]} size={[1.6, 0.8, 1.6]} color={SKIN} />
    <group position={[0, 7.2, 0]} rotation={[0.1 * nod, 0.55, 0]}>
      <Block size={[3.6, 3.8, 3.2]} color={SKIN} />
      <Block position={[0, 1.6, -0.1]} size={[3.8, 1.1, 3.5]} color="#2b2230" />
      {[-1, 1].map((side) => (
        <Block key={side} position={[side * 0.85, 0.2, 1.63]} size={[0.5, 0.55, 0.1]} color="#1a1420" />
      ))}
      <Block position={[0, -1, 1.63]} size={[1.1, 0.18, 0.1]} color="#7a3a34" />
      <Tube points={HEADBAND} radius={0.24} color="#20283a" />
      {[-1, 1].map((side) => (
        <Bar key={side} from={[side * 1.85, 0, 0]} to={[side * 2.7, 0, 0]} radius={1.15} color="#e0523f" glow={0.3} />
      ))}
    </group>
  </group>
);

const SCREEN_CELL = 0.34;
const METER_LAMPS = 6;
/** Illustrative levels: the study found that urgency fell, and these lamps show only that direction. */
const METER_WITH_CRY = 5;
const METER_WITHOUT_CRY = 2;

const ListenerSet: React.FC<{ t: number }> = ({ t }) => {
  const from = barT(14.5);
  const eraseFrom = barT(15.75);
  const erase = progress(t, eraseFrom, eraseFrom + beatT(3));
  const sweep = erase * SPECTRO_COLS;
  const kick = hitPulse(t, KICKS, 0.2);
  const level = track(t, [
    { t: from, v: 0 },
    { t: from + beatT(2), v: METER_WITH_CRY },
    { t: eraseFrom, v: METER_WITH_CRY },
    { t: eraseFrom + beatT(3), v: METER_WITHOUT_CRY },
  ]);
  return (
    <group position={[SETS.listener, 0, 0]}>
      <Room wall="#2c4a3e" floor="#5a4632" dots="#335548" />
      <group position={[-9.5, 0, -1.5]}>
        <Listener nod={(1 - erase) * kick} />
      </group>
      <group position={[2.5, 0, 0]}>
        <Block position={[0, 0.8, 0]} size={[2, 1.6, 1.4]} color="#3a454e" />
        <Block position={[0, 4.6, 0]} size={[14, 6, 0.8]} color="#2b353d" />
        <Block position={[0, 4.6, 0.45]} size={[13, 5, 0.1]} color="#0e1c24" glow={0.4} />
        <group position={[0, 4.6, 0.55]}>
          <CellWall t={t} cell={SCREEN_CELL} cryShown={(col) => (col < sweep ? 0 : 1)} />
          {erase > 0 && erase < 1 ? <Block position={[(sweep - SPECTRO_COLS / 2) * SCREEN_CELL, 0, 0.3]} size={[0.22, 4.6, 0.2]} color="#ffffff" glow={1.1} /> : null}
        </group>
      </group>
      <group position={[11.5, 0, 0]}>
        <Block position={[0, 4.7, 0]} size={[2.8, 9.4, 0.6]} color="#2b353d" />
        {Array.from({ length: METER_LAMPS }, (_, i) => (
          <Block key={i} position={[0, 1.2 + i * 1.45, 0.4]} size={[2, 1.1, 0.5]} color={level > i + 0.5 ? mix("#6fe36f", "#ff5a4d", i / (METER_LAMPS - 1)) : "#2a3a34"} glow={level > i + 0.5 ? 1 : undefined} />
        ))}
      </group>
    </group>
  );
};

// ---- The cat on a lap, looking straight at you ----
const LapSet: React.FC<{ t: number }> = ({ t }) => {
  const from = barT(17);
  const stroke = Math.sin(((t - from) / beatT(2)) * Math.PI * 2);
  const open = track(t, [
    { t: from, v: 0.5 },
    { t: from + beatT(1), v: 0.85 },
    { t: from + beatT(2.5), v: 0.85 },
    { t: from + beatT(3), v: 0.15 },
    { t: from + beatT(3.5), v: 0.7 },
  ]);
  const jeans = "#39506e";
  const shirt = "#3f7f6a";
  const handZ = -1.5 + stroke * 1.2;
  return (
    <group position={[SETS.lap, 0, 0]}>
      <Room wall="#3c5a45" floor="#6b4a36" dots="#466850" />
      <Block position={[0, 12, -9]} size={[25, 24, 5]} color="#a8553c" />
      <Block position={[0, 2.75, 0]} size={[17, 5.5, 18]} color="#a8553c" />
      {[-1, 1].map((side) => (
        <group key={side}>
          <Block position={[side * 10.5, 5, 0]} size={[4, 10, 18]} color="#b8644a" />
          <Block position={[side * 2.6, 6.2, 0]} size={[4.8, 2.6, 11]} color={jeans} />
          <Block position={[side * 2.6, 2.5, 6.8]} size={[4, 7, 3]} color={jeans} />
        </group>
      ))}
      <Block position={[0, 18.5, -5.6]} size={[11, 22, 4]} color={shirt} />
      <group position={[noise(t * 24, 8) * 0.06, 7.5, 1]} scale={1.55}>
        <LoafCat t={t} coat={GINGER} open={open} />
      </group>
      <Bar from={[6.5, 21, -5]} to={[5, 11.4, handZ]} radius={1.05} color={shirt} />
      <Block position={[4.6, 10.8, handZ]} size={[2.8, 1.1, 3]} color={SKIN} />
      <PurrMarks t={t} position={[0, 12, 5]} spread={7.5} height={1.3} color={SPARK} size={0.55} />
    </group>
  );
};

export const Scene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  return (
    <PixelStage t={t} cameraAt={cameraAt} pixelSize={2} normalEdge={0.55} depthEdge={0.85}>
      {within(t, 0, barT(2)) ? <PortraitSet t={t} /> : null}
      {within(t, barT(2), barT(3.25)) ? <WaveSet t={t} /> : null}
      {within(t, barT(3.25), barT(6.25)) ? <LabSet t={t} /> : null}
      {within(t, barT(6.25), barT(7.5)) ? <NurserySet t={t} /> : null}
      {within(t, barT(7.5), barT(8.75)) ? <VetSet t={t} /> : null}
      {within(t, barT(8.75), barT(10)) ? <XRaySet t={t} /> : null}
      {within(t, barT(10), barT(12)) ? <KitchenSet t={t} /> : null}
      {within(t, barT(12), barT(14.5)) ? <SpectrumSet t={t} /> : null}
      {within(t, barT(14.5), barT(17)) ? <ListenerSet t={t} /> : null}
      {t >= barT(17) - 0.05 ? <LapSet t={t} /> : null}
    </PixelStage>
  );
};
