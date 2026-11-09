// The 3D sets, built only from the framework's general shapes. Everything is a pure function of the time.
import * as THREE from "three";
import { useCurrentFrame, useVideoConfig } from "remotion";
import type { V3 } from "../../src/core/camera";
import { D2R, hash } from "../../src/core/math";
import { easeOutCubic, hitPulse, noise, popIn, progress, staggered } from "../../src/core/motion";
import { usePalette } from "../../src/core/palette";
import { PixelStage } from "../../src/core/PixelStage";
import { Arrow3D, Ball, Bar, Block, Cone, Particles, Ring } from "../../src/core/shapes";
import { barT, beatT, LIGHT_BANDS, scatterRelativeToBlue } from "./physics";
import { cameraAt, KICKS, MOLECULES, SETS, STABS, sunsetAmount } from "./timeline";

const SUN_WHITE = "#fff8e0";
const BLUE = LIGHT_BANDS[1].color;
const VIOLET = LIGHT_BANDS[0].color;
const RED = LIGHT_BANDS[5].color;

const mix = (a: string, b: string, u: number) => `#${new THREE.Color(a).lerp(new THREE.Color(b), u).getHexString()}`;
const within = (t: number, from: number, to: number) => t >= from - 0.05 && t < to + 0.05;

// ---- Earth from space, also used for the long-path shot ----
const EARTH_R = 9;

const Earth: React.FC<{ t: number; punch: number }> = ({ t, punch }) => (
  <group scale={1 + 0.03 * punch}>
    <Ball radius={EARTH_R} detail={28} color="#2b6fd6" />
    <group rotation={[0.3, t * 0.25, 0]}>
      {Array.from({ length: 34 }, (_, i) => {
        const lon = hash(i, 3) * Math.PI * 2;
        const lat = (hash(i, 4) - 0.5) * 2.4;
        const r = EARTH_R * 0.97;
        return <Ball key={i} position={[r * Math.cos(lat) * Math.cos(lon), r * Math.sin(lat), r * Math.cos(lat) * Math.sin(lon)]} radius={0.9 + hash(i, 5) * 1.7} detail={6} color={i % 3 === 0 ? "#f2f6ff" : "#4fb56a"} />;
      })}
    </group>
  </group>
);

const Stars: React.FC<{ origin: V3 }> = ({ origin }) => <Particles t={0} count={70} seed={21} origin={origin} box={[100, 110, 2]} size={0.28} colors={["#ffffff", "#bcd6ff"]} glow={1} />;

const SpaceSet: React.FC<{ t: number }> = ({ t }) => {
  const hook = t < barT(2) + 0.05;
  const punch = hitPulse(t, STABS, 0.2);
  const pathShot = progress(t, barT(14), barT(14) + beatT(4));
  const sunset = progress(t, barT(14) + beatT(4), barT(14) + beatT(7));
  return (
    <group position={[SETS.space, 0, 0]}>
      <Stars origin={[-50, -50, -40]} />
      <Earth t={t} punch={punch} />
      {/* The glow of the air. Far thicker than the real atmosphere, and labelled that way. */}
      <Ring radius={EARTH_R + 2.2} tube={1.9} color="#58b4ff" glow={0.7} />
      {hook ? <Ball position={[9, 25, -14]} radius={3.4 + 0.5 * punch} detail={20} color={SUN_WHITE} glow={1.6} /> : null}
      {!hook ? (
        <>
          <Block position={[0, EARTH_R + 0.5, 4]} size={[1.1, 1.3, 1.1]} color={SUN_WHITE} glow={1} />
          {/* Sunlight from overhead crosses a short stretch of air and arrives white. */}
          <Bar from={[0, 30, 4]} to={[0, 30 - 20 * easeOutCubic(pathShot) - 0.001, 4]} radius={0.5} color={SUN_WHITE} glow={1.2} />
          {/* Sunlight at the horizon crosses a long stretch, losing its blue on the way. */}
          {Array.from({ length: 10 }, (_, i) => {
            const u0 = i / 10;
            const u1 = (i + 1) / 10;
            const shown = sunset > u0 ? Math.min(1, (sunset - u0) * 10) : 0;
            return shown > 0 ? <Bar key={i} from={[32 - 32 * u0, EARTH_R + 0.6, 4]} to={[32 - 32 * (u0 + (u1 - u0) * shown), EARTH_R + 0.6, 4]} radius={0.5} color={mix(SUN_WHITE, RED, Math.min(1, u0 * 1.25))} glow={1.2} /> : null;
          })}
        </>
      ) : null}
    </group>
  );
};

// ---- White light fanning out into its colours ----
const SplitSet: React.FC<{ t: number }> = ({ t }) => {
  const reveal = progress(t, barT(2) + beatT(1), barT(4) - beatT(1));
  const pulse = hitPulse(t, KICKS);
  return (
    <group position={[SETS.split, 0, 0]}>
      <Ball position={[-9, 8, 0]} radius={3 + 0.3 * pulse} detail={18} color={SUN_WHITE} glow={1.6} />
      <Bar from={[-7, 6.5, 0]} to={[-1.5, 2, 0]} radius={0.8} color={SUN_WHITE} glow={1.2} />
      {LIGHT_BANDS.map((band, i) => {
        const u = easeOutCubic(staggered(reveal, i, LIGHT_BANDS.length));
        const angle = (28 - i * 15) * D2R;
        const length = 13 * u;
        return u > 0.04 ? <Arrow3D key={band.name} from={[-1.5, 2, 0]} to={[-1.5 + Math.cos(angle) * length, 2 + Math.sin(angle) * length, 0]} radius={0.42} color={band.color} glow={0.6} /> : null;
      })}
    </group>
  );
};

// ---- Light meeting air molecules ----
const Molecule: React.FC<{ position: V3; spin: number }> = ({ position, spin }) => {
  const { dim } = usePalette();
  return (
    <group position={position} rotation={[spin * 0.7, spin, spin * 0.4]}>
      <Ball position={[-0.75, 0, 0]} radius={1} detail={10} color={dim} />
      <Ball position={[0.75, 0, 0]} radius={1} detail={10} color={dim} />
    </group>
  );
};

const CROSSING_S = 2.4;
const PHOTONS = 66;
const TRAIL = [0, 0.05, 0.1];

/** One packet of light. It flies straight until it meets the air, and then, if it scatters, flies off at a seeded angle. */
const photonAt = (i: number, age: number): V3 => {
  const band = LIGHT_BANDS[i % LIGHT_BANDS.length];
  const x = -18 + age * 36;
  const y = (hash(i, 51) - 0.5) * 26 + 2;
  const z = (hash(i, 52) - 0.5) * 6;
  const hitX = -9 + 18 * hash(i, 53);
  // Red is the baseline: the scaled chance keeps the true ratio between colours while some red still scatters.
  const scatters = hash(i, 54) < Math.min(1, 0.8 * scatterRelativeToBlue(band.nm));
  if (!scatters || x < hitX) return [x, y, z];
  const angle = hash(i, 55) * Math.PI * 2;
  const travelled = x - hitX;
  return [hitX + Math.cos(angle) * travelled, y + Math.sin(angle) * travelled, z];
};

const AirSet: React.FC<{ t: number }> = ({ t }) => (
  <group position={[SETS.air, 0, 0]}>
    {MOLECULES.map((m, i) => (
      <Molecule key={i} position={[m[0] + noise(t * 0.6, i) * 0.4, m[1] + noise(t * 0.6, i + 50) * 0.4, m[2]]} spin={t * 0.8 + i} />
    ))}
    {Array.from({ length: PHOTONS }, (_, i) => {
      const color = LIGHT_BANDS[i % LIGHT_BANDS.length].color;
      const start = (t / CROSSING_S + hash(i, 50)) % 1;
      return TRAIL.map((lag, k) => {
        const age = start - lag;
        return age > 0 ? <Block key={`${i}-${k}`} position={photonAt(i, age)} size={[0.7 - k * 0.15, 0.7 - k * 0.15, 0.7 - k * 0.15]} color={color} glow={0.9 - k * 0.25} /> : null;
      });
    })}
  </group>
);

// ---- An eye: lots of blue light reaches it, and much less violet ----
const EyeSet: React.FC<{ t: number }> = ({ t }) => {
  const look = popIn(t, barT(8), 0.3);
  return (
    <group position={[SETS.eye, 0, 0]}>
      <Particles t={t} count={46} seed={61} origin={[-12, 2, 14]} box={[24, 24, 2]} velocity={[0, -6, 0]} size={0.9} colors={[BLUE]} glow={1} />
      <Particles t={t} count={7} seed={62} origin={[-12, 2, 14]} box={[24, 24, 2]} velocity={[0, -6, 0]} size={0.9} colors={[VIOLET]} glow={0.5} />
      <group scale={Math.max(0.001, look)}>
        <Ball position={[0, 0, 4]} radius={7} detail={24} color="#f2f6ff" />
        <Ball position={[0, 0.8, 9.2]} radius={3} detail={18} color={BLUE} />
        <Ball position={[0, 1.1, 11]} radius={1.5} detail={14} color="#0a0c18" />
      </group>
    </group>
  );
};

// ---- The ground: noon, then the sunset ----
const SKY_BANDS = 9;
const NOON_LOW = "#a9dcff";
const NOON_HIGH = "#2f7fe0";
const SUNSET_LOW = "#ff7a2e";
const SUNSET_MID = "#d6455e";
const SUNSET_HIGH = "#2a2358";

const skyColor = (height: number, sunset: number) => {
  const noon = mix(NOON_LOW, NOON_HIGH, height);
  const dusk = height < 0.5 ? mix(SUNSET_LOW, SUNSET_MID, height * 2) : mix(SUNSET_MID, SUNSET_HIGH, (height - 0.5) * 2);
  return mix(noon, dusk, sunset);
};

const RAIN = 44;
const RAIN_PERIOD_S = 1.4;

const GroundSet: React.FC<{ t: number }> = ({ t }) => {
  const sunset = sunsetAmount(t);
  const sunHeight = 26 - 24 * progress(t, barT(10), barT(12));
  const noonRain = 1 - progress(t, barT(12) - beatT(1), barT(12));
  const hill = mix("#2f8c4b", "#3a2b35", sunset);
  const hillFar = mix("#4faa5e", "#59324a", sunset);
  const person: V3 = [0, 2.6, 8];
  return (
    <group position={[SETS.ground, 0, 0]}>
      {Array.from({ length: SKY_BANDS }, (_, i) => (
        <Block key={i} position={[0, 10 * i + 2, -70]} size={[260, 10.2, 1]} color={skyColor(i / (SKY_BANDS - 1), sunset)} glow={1} />
      ))}
      <Ball position={[-4, sunHeight, -60]} radius={7 + 3 * sunset} detail={20} color={mix(SUN_WHITE, "#ffb347", sunset)} glow={1.8} />
      <Ball position={[-40, -22, -40]} radius={44} detail={16} color={hillFar} />
      <Ball position={[46, -30, -30]} radius={52} detail={16} color={hillFar} />
      <Block position={[0, -20, 0]} size={[260, 40, 120]} color={hill} />
      <Block position={[9, 2.2, 2]} size={[1, 4.4, 1]} color={mix("#6b4a2f", "#2a1f24", sunset)} />
      <Cone position={[9, 7, 2]} radius={3.4} height={7} color={mix("#2c7d41", "#2a2230", sunset)} />
      <Block position={[person[0], 1.4, person[2]]} size={[1.2, 2.8, 0.8]} color={mix("#e8554e", "#3a2230", sunset)} />
      <Ball position={[person[0], 3.4, person[2]]} radius={0.72} detail={10} color={mix("#ffd2a6", "#5a3a3a", sunset)} />
      {noonRain > 0
        ? Array.from({ length: RAIN }, (_, i) => {
            const u = ((t / RAIN_PERIOD_S + hash(i, 70)) % 1) ** 1.4;
            const angle = (0.08 + hash(i, 71) * 0.84) * Math.PI;
            const reach = 34 * (1 - u);
            return <Block key={i} position={[person[0] + Math.cos(angle) * reach, person[1] + Math.sin(angle) * reach, person[2] + (hash(i, 72) - 0.5) * 8 * (1 - u)]} size={[0.75, 0.75, 0.75]} color={BLUE} glow={1.1} />;
          })
        : null}
    </group>
  );
};

export const Scene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  return (
    <PixelStage t={t} cameraAt={cameraAt} pixelSize={2} normalEdge={0.55} depthEdge={0.85}>
      {within(t, 0, barT(2)) || within(t, barT(14), barT(16)) ? <SpaceSet t={t} /> : null}
      {within(t, barT(2), barT(4)) ? <SplitSet t={t} /> : null}
      {within(t, barT(4), barT(8)) ? <AirSet t={t} /> : null}
      {within(t, barT(8), barT(10)) ? <EyeSet t={t} /> : null}
      {within(t, barT(10), barT(14)) || t >= barT(16) - 0.05 ? <GroundSet t={t} /> : null}
    </PixelStage>
  );
};
