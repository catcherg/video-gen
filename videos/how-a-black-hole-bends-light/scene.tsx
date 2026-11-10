// The 3D sets, built only from the framework's general shapes. Everything is a pure function of the time.
// Kept light: few meshes per set, and anything that changes size each frame is scaled by a group,
// so that its geometry is built once rather than on every frame.
import * as THREE from "three";
import { useCurrentFrame, useVideoConfig } from "remotion";
import type { V3 } from "../../src/core/camera";
import { clamp01, hash } from "../../src/core/math";
import { easeOutBack, easeOutCubic, hitPulse, lerp, noise, popIn, progress, staggered, track } from "../../src/core/motion";
import { PixelStage } from "../../src/core/PixelStage";
import { Arrow3D, Ball, Bar, Block, Cone, Particles, Ring } from "../../src/core/shapes";
import { barT, beatT, CRITICAL_IMPACT, einsteinBend, newtonBend, pathLength, PHOTON_SPHERE, PRINCIPE_SHIFT, resample, SGR_RING_RADIUS, SHADOW_DRAWN_RATIO, SOBRAL_SHIFT, SUN_DEFLECTION, traceRay, type V2 } from "./physics";
import { cameraAt, KICKS, SETS, STABS } from "./timeline";

const BLACK = "#000000";
const WHITE_HOT = "#fff7df";
const BEAM = "#d8f4ff";
const CYAN = "#7fd8ff";
const EMBER = "#ff9a3c";
const RED = "#ff5a4d";
const GOLD = "#ffd166";

const mix = (a: string, b: string, u: number) => `#${new THREE.Color(a).lerp(new THREE.Color(b), clamp01(u)).getHexString()}`;
const within = (t: number, from: number, to: number) => t >= from - 0.05 && t < to + 0.05;

/** A traced ray in world units, evenly spaced, optionally turned in its plane. */
const worldPath = (points: V2[], count: number, scale: number, turn = 0): V3[] =>
  resample(points, count).map(([x, y]): V3 => [(x * Math.cos(turn) - y * Math.sin(turn)) * scale, (x * Math.sin(turn) + y * Math.cos(turn)) * scale, 0]);

const pointAt = (points: V3[], u: number): V3 => {
  const f = clamp01(u) * (points.length - 1);
  const i = Math.min(points.length - 2, Math.floor(f));
  const k = f - i;
  const a = points[i];
  const b = points[i + 1];
  return [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
};

/** A line through points, of which only the first `reveal` share is drawn. */
const Path: React.FC<{ points: V3[]; reveal?: number; radius: number; color: string; glow?: number }> = ({ points, reveal = 1, radius, color, glow }) => {
  const head = clamp01(reveal) * (points.length - 1);
  return (
    <>
      {points.slice(0, -1).map((p, i) => {
        const share = Math.min(1, head - i);
        if (share < 0.02) return null;
        const q = points[i + 1];
        const end: V3 = [lerp(p[0], q[0], share), lerp(p[1], q[1], share), lerp(p[2], q[2], share)];
        return <Bar key={i} from={p} to={end} radius={radius} color={color} glow={glow} sides={6} />;
      })}
    </>
  );
};

/** A ball that pulses by scale, so its sphere is only built once. */
const Glint: React.FC<{ position: V3; radius: number; scale: number; color: string; glow: number }> = ({ position, radius, scale, color, glow }) => (
  <group position={position} scale={Math.max(0.001, scale)}>
    <Ball radius={radius} detail={10} color={color} glow={glow} />
  </group>
);

const Stars: React.FC<{ seed: number }> = ({ seed }) => <Particles t={0} count={60} seed={seed} origin={[-40, -62, -42]} box={[80, 104, 2]} size={0.3} colors={["#ffffff", "#bcd6ff", "#ffe6c0"]} glow={1} />;

/** Short radial bars around a circle, flickering with seeded noise. Length is a group scale, so no geometry is rebuilt. */
const Flares: React.FC<{ t: number; radius: number; count: number; min: number; max: number; thick: number; color: string; glow: number; seed: number }> = ({ t, radius, count, min, max, thick, color, glow, seed }) => (
  <>
    {Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2;
      const length = lerp(min, max, (noise(t * 1.6, seed + i) + 1) / 2);
      const middle = radius + length / 2;
      return (
        <group key={i} position={[Math.cos(angle) * middle, Math.sin(angle) * middle, 0]} rotation={[0, 0, angle]} scale={[Math.max(0.001, length), 1, 1]}>
          <Block size={[1, thick, thick]} color={color} glow={glow} />
        </group>
      );
    })}
  </>
);

// ---- The hook: a true light path that loops once around the hole ----
const HOOK_S = 2.2;
const HOOK_REACH = 4.1;
const HOOK_RAY = worldPath(traceRay(CRITICAL_IMPACT * 1.00046, Math.hypot(3.4, CRITICAL_IMPACT), (x, y) => Math.hypot(x, y) < HOOK_REACH), 64, HOOK_S, 0.385);

const HoleSet: React.FC<{ t: number }> = ({ t }) => {
  const reveal = track(t, [
    { t: 0, v: 0.08 },
    { t: barT(1), v: 0.26 },
    { t: barT(1.85), v: 1 },
  ]);
  const punch = hitPulse(t, STABS, 0.2);
  return (
    <group position={[SETS.hole, 0, 0]}>
      <Stars seed={21} />
      <group scale={1 + 0.04 * punch}>
        <Ball radius={HOOK_S} detail={28} color={BLACK} />
        <Ring radius={HOOK_S + 0.16} tube={0.12} color={EMBER} glow={1.3} />
        <Ring radius={HOOK_S + 0.62} tube={0.22} color="#8a2f18" glow={0.6} />
      </group>
      <Path points={HOOK_RAY} reveal={reveal} radius={0.19} color={BEAM} glow={1.3} />
      <Glint position={pointAt(HOOK_RAY, reveal)} radius={0.5} scale={1 + 0.4 * punch} color={WHITE_HOT} glow={2} />
    </group>
  );
};

// ---- Starlight grazing the Sun. The bend is hugely exaggerated, and the diagram title says so ----
const SUN_R = 4.6;
const SUN_Y = -0.8;
const RIM_Y = SUN_Y + SUN_R + 0.7;
const SUN_SPAN = 11.4;
const RAY_TILT = -0.04;
const RAY_BEND = 0.15;
const RAY_SOFT = 1.4;

const sunRayY = (x: number) => RIM_Y + RAY_TILT * x + RAY_BEND * (RAY_SOFT - Math.hypot(x, RAY_SOFT));
const ARRIVAL_SLOPE = RAY_TILT - (RAY_BEND * SUN_SPAN) / Math.hypot(SUN_SPAN, RAY_SOFT);

const SUN_RAY = Array.from({ length: 28 }, (_, i): V3 => {
  const x = lerp(-SUN_SPAN, SUN_SPAN, i / 27);
  return [x, sunRayY(x), 0];
});
const TRUE_STAR: V3 = [-SUN_SPAN, sunRayY(-SUN_SPAN), 0];
const EARTH_SPOT: V3 = [SUN_SPAN, sunRayY(SUN_SPAN), 0];
const SEEN_STAR: V3 = [-SUN_SPAN, EARTH_SPOT[1] - 2 * SUN_SPAN * ARRIVAL_SLOPE, 0];
const SIGHT_DOTS = Array.from({ length: 16 }, (_, i): V3 => {
  const u = (i + 1) / 17;
  return [lerp(EARTH_SPOT[0], SEEN_STAR[0], u), lerp(EARTH_SPOT[1], SEEN_STAR[1], u), 0];
});
const EARTH_PATCHES: V3[] = [
  [0.5, 0.55, 0.85],
  [-0.6, 0.1, 0.9],
  [0.1, -0.7, 0.85],
];

const StarMark: React.FC<{ position: V3; color: string; scale: number }> = ({ position, color, scale }) => (
  <group position={position} scale={Math.max(0.001, scale)}>
    <Ball radius={0.6} detail={8} color={color} glow={1.6} />
    <Block size={[2.4, 0.22, 0.22]} color={color} glow={1.2} />
    <Block size={[0.22, 2.4, 0.22]} color={color} glow={1.2} />
  </group>
);

const SunSet: React.FC<{ t: number }> = ({ t }) => {
  const pulse = hitPulse(t, KICKS);
  const ray = progress(t, barT(2) + beatT(1), barT(3) + beatT(0.5));
  const sight = progress(t, barT(3.25), barT(3.75));
  const ghost = popIn(t, barT(3.75), 0.25);
  const packet = ((t - barT(3)) / barT(1)) % 1;
  return (
    <group position={[SETS.sun, 0, 0]}>
      <Stars seed={22} />
      <group position={[0, SUN_Y, 0]}>
        <Ball radius={SUN_R} detail={28} color="#ffd24a" glow={1.2} />
        <Flares t={t} radius={SUN_R - 0.05} count={24} min={0.2} max={0.55 + 0.25 * pulse} thick={0.45} color="#ffb03a" glow={1} seed={300} />
      </group>
      <StarMark position={TRUE_STAR} color={WHITE_HOT} scale={popIn(t, barT(2), 0.25) * (1 + 0.1 * pulse)} />
      <group position={EARTH_SPOT}>
        <Ball radius={1.15} detail={14} color="#2b6fd6" glow={0.25} />
        {EARTH_PATCHES.map((p, i) => (
          <Ball key={i} position={p} radius={0.38} detail={6} color="#4fb56a" glow={0.3} />
        ))}
      </group>
      <Path points={SUN_RAY} reveal={ray} radius={0.13} color="#fff4c8" glow={1.2} />
      {ray >= 1 ? <Block position={pointAt(SUN_RAY, packet)} size={[0.55, 0.55, 0.55]} color={WHITE_HOT} glow={2} /> : null}
      {SIGHT_DOTS.map((p, i) => (i / SIGHT_DOTS.length < sight ? <Block key={i} position={p} size={[0.3, 0.3, 0.3]} color={CYAN} glow={1} /> : null))}
      {ghost > 0 ? <StarMark position={SEEN_STAR} color={CYAN} scale={ghost * (1 + 0.1 * pulse)} /> : null}
    </group>
  );
};

// ---- The 1919 eclipse: two telescopes, with meters to scale for the two reported shifts ----
const GROUND_Y = -3.6;
const ECLIPSE_R = 2.2;
const ECLIPSE_SPOT: V3 = [0, 2.4, -6];
const METER_SCALE = 2;
const ECLIPSE_STARS = Array.from({ length: 12 }, (_, i): V3 => {
  const angle = (i / 12) * Math.PI * 2 + hash(i, 80) * 0.4;
  const r = 4 + hash(i, 81) * 3.5;
  return [Math.cos(angle) * r * 1.5, ECLIPSE_SPOT[1] + Math.sin(angle) * r * 0.5, ECLIPSE_SPOT[2]];
});
const TREES = Array.from({ length: 8 }, (_, i) => ({ x: (hash(i, 90) - 0.5) * 34, z: -14 - hash(i, 91) * 10, height: 2.6 + hash(i, 92) * 1.2 }));

const Telescope: React.FC<{ x: number }> = ({ x }) => {
  const mount: V3 = [x, -1.7, 2];
  const dir = new THREE.Vector3(ECLIPSE_SPOT[0] - mount[0], ECLIPSE_SPOT[1] - mount[1], ECLIPSE_SPOT[2] - mount[2]).normalize();
  const along = (s: number): V3 => [mount[0] + dir.x * s, mount[1] + dir.y * s, mount[2] + dir.z * s];
  return (
    <>
      {[
        [-1.1, 0.7],
        [1.1, 0.7],
        [0, -1],
      ].map(([dx, dz], i) => (
        <Bar key={i} from={mount} to={[x + dx, GROUND_Y, mount[2] + dz]} radius={0.12} color="#8a90a6" glow={0.3} sides={6} />
      ))}
      <Bar from={along(-1.6)} to={along(2.8)} radius={0.42} color="#d7dce8" glow={0.5} />
      <Bar from={along(2.8)} to={along(3.4)} radius={0.58} color="#8fb4ff" glow={0.8} />
    </>
  );
};

/** A column as tall as a reported shift, with a white tick at the predicted one. Height is a group scale. */
const Meter: React.FC<{ x: number; shift: number; rise: number; color: string }> = ({ x, shift, rise, color }) => {
  const height = Math.max(0.01, shift * METER_SCALE * rise);
  return (
    <>
      <group position={[x, GROUND_Y + height / 2, 2]} scale={[1, height, 1]}>
        <Block size={[1.2, 1, 1.2]} color={color} glow={0.6} />
      </group>
      {rise > 0.6 ? <Block position={[x, GROUND_Y + SUN_DEFLECTION * METER_SCALE, 2]} size={[2.2, 0.16, 1.4]} color={WHITE_HOT} glow={1.2} /> : null}
    </>
  );
};

const EclipseSet: React.FC<{ t: number }> = ({ t }) => {
  const from = barT(4.5);
  const cover = easeOutCubic(progress(t, from, from + beatT(2)));
  const corona = progress(t, from + beatT(1.5), from + beatT(2.25));
  const rise = easeOutCubic(progress(t, from + beatT(2), from + beatT(4)));
  const pulse = hitPulse(t, KICKS);
  return (
    <group position={[SETS.eclipse, 0, 0]}>
      <Stars seed={23} />
      <group position={ECLIPSE_SPOT}>
        <Ball radius={ECLIPSE_R} detail={24} color="#ffe9a8" glow={1.6} />
        {corona > 0 ? (
          <group position={[0, 0, 0.6]} scale={Math.max(0.001, corona * (1 + 0.04 * pulse))}>
            <Flares t={t} radius={ECLIPSE_R} count={20} min={0.5} max={1.3} thick={0.24} color="#fff4d6" glow={0.9} seed={320} />
            <Ring radius={ECLIPSE_R + 0.28} tube={0.16} color="#fff4d6" glow={1.1} />
          </group>
        ) : null}
        <Ball position={[3.4 * (1 - cover), 0, 2.4]} radius={ECLIPSE_R + 0.05} detail={24} color={BLACK} />
      </group>
      {ECLIPSE_STARS.map((p, i) => {
        const pop = popIn(t, from + beatT(2 + (i % 3)), 0.2);
        return pop > 0 ? (
          <group key={i} position={p} scale={Math.max(0.001, pop)}>
            <Block size={[0.36, 0.36, 0.36]} color="#ffffff" glow={1.4} />
          </group>
        ) : null;
      })}
      <Block position={[0, GROUND_Y - 20, 0]} size={[260, 40, 120]} color="#1c2236" />
      {TREES.map((tree, i) => (
        <Cone key={i} position={[tree.x, GROUND_Y + tree.height / 2, tree.z]} radius={0.9} height={tree.height} sides={6} color="#141a2a" />
      ))}
      <Telescope x={-4.6} />
      <Telescope x={4.6} />
      <Meter x={-7.8} shift={PRINCIPE_SHIFT} rise={rise} color={CYAN} />
      <Meter x={7.8} shift={SOBRAL_SHIFT} rise={rise} color={EMBER} />
    </group>
  );
};

// ---- Rays past a mass. Angles follow the far-field formula, scaled up, and the diagram title says so ----
const MASS_PASSES = [2.4, 3.4, 4.8];
const MASS_COLORS = ["#ff7a4d", GOLD, CYAN];
const MASS_SIDES = [1, -1];
const MASS_SPAN = 10.4;
const MASS_SOFT = 1.2;
const MASS_STRENGTH = 0.6;
const MASS_STEPS = 18;
const MASS_PACKET_S = 2.2;

const massRayY = (x: number, pass: number, angle: number) => pass - (Math.tan(angle) / 2) * (x + Math.hypot(x, MASS_SOFT));

const massRay = (pass: number, side: number, angle: number) =>
  Array.from({ length: MASS_STEPS + 1 }, (_, i): V3 => {
    const x = lerp(-MASS_SPAN, MASS_SPAN, i / MASS_STEPS);
    return [x, side * massRayY(x, pass, angle), 0];
  });

const MassSet: React.FC<{ t: number }> = ({ t }) => {
  const grow = 1 + 0.25 * easeOutCubic(progress(t, barT(7), barT(7) + beatT(1)));
  const reveal = progress(t, barT(5.75) + beatT(0.5), barT(6.5));
  const ghost = t < barT(7) ? progress(t, barT(6.5), barT(6.9)) : 0;
  const pulse = hitPulse(t, KICKS);
  return (
    <group position={[SETS.mass, 0, 0]}>
      <Stars seed={24} />
      <group scale={Math.cbrt(grow) * (1 + 0.05 * pulse)}>
        <Ball radius={1.4} detail={20} color="#b46bff" glow={0.7} />
        <Ring radius={1.62} tube={0.07} color="#e2c8ff" glow={0.9} />
      </group>
      {MASS_PASSES.map((pass, i) => {
        const angle = einsteinBend(pass) * MASS_STRENGTH * grow;
        const newton = newtonBend(pass) * MASS_STRENGTH * grow;
        const shown = staggered(reveal, i, MASS_PASSES.length);
        return MASS_SIDES.map((side) => (
          <group key={`${i}-${side}`}>
            <Path points={massRay(pass, side, angle)} reveal={shown} radius={0.11} color={MASS_COLORS[i]} glow={1.1} />
            {ghost > 0 ? <Path points={massRay(pass, side, newton)} reveal={ghost} radius={0.06} color="#7c8bb8" glow={0.4} /> : null}
            {reveal >= 1
              ? [0, 1].map((k) => {
                  const x = lerp(-MASS_SPAN, MASS_SPAN, (t / MASS_PACKET_S + hash(i * 7 + k, side + 60)) % 1);
                  return <Block key={k} position={[x, side * massRayY(x, pass, angle), 0]} size={[0.4, 0.4, 0.4]} color={WHITE_HOT} glow={1.6} />;
                })
              : null}
          </group>
        ));
      })}
    </group>
  );
};

// ---- Light orbiting at the photon sphere, drawn to scale against the horizon ----
const ORBIT_R = 4;
const ORBIT_SPHERE = ORBIT_R * PHOTON_SPHERE;
const ORBIT_PLANES: V3[] = [
  [0, 0, 0],
  [1.08, 0, 0.5],
  [-1.08, 0, -0.5],
];
const ORBIT_TRAIL = [0, 0.1, 0.2, 0.3, 0.4];
const ORBIT_BEAM = worldPath(traceRay(CRITICAL_IMPACT * (1 + 1e-6), Math.hypot(2, CRITICAL_IMPACT), (x, y) => Math.hypot(x, y) < 3.4), 72, ORBIT_R, 0.9);
/** Arrows sit in front of the hole, so they are shortened to line up with the rings behind them. */
const ARROW_Z = 4.3;
const ARROW_NEAR = 0.95;

const OrbitSet: React.FC<{ t: number }> = ({ t }) => {
  const rings = barT(9.5);
  const spin = (Math.PI * 2) / barT(1);
  const beam = 0.8 * progress(t, barT(8.25) + beatT(0.5), barT(10.75));
  const arrows = easeOutCubic(progress(t, rings, rings + beatT(1)));
  const arrowTip = (radius: number, degrees: number): V3 => {
    const a = (degrees * Math.PI) / 180;
    return [Math.cos(a) * radius * ARROW_NEAR * arrows, Math.sin(a) * radius * ARROW_NEAR * arrows, ARROW_Z];
  };
  return (
    <group position={[SETS.orbit, 0, 0]}>
      <Stars seed={25} />
      <Ball radius={ORBIT_R} detail={28} color={BLACK} />
      <Ring radius={ORBIT_R + 0.04} tube={0.09} color={RED} glow={1.1} />
      <Path points={ORBIT_BEAM} reveal={beam} radius={0.14} color={BEAM} glow={1.2} />
      {beam > 0 ? <Glint position={pointAt(ORBIT_BEAM, beam)} radius={0.5} scale={1} color={WHITE_HOT} glow={2} /> : null}
      {ORBIT_PLANES.map((rotation, i) => {
        const pop = popIn(t, rings + beatT(i * 0.5), 0.25);
        if (pop <= 0) return null;
        return (
          <group key={i} rotation={rotation}>
            <group scale={Math.max(0.001, pop)}>
              <Ring radius={ORBIT_SPHERE} tube={i === 0 ? 0.1 : 0.06} color={i === 0 ? CYAN : "#4a86b8"} glow={i === 0 ? 0.9 : 0.6} />
            </group>
            {[0, 1].map((p) =>
              ORBIT_TRAIL.map((lag, k) => {
                const a = p * Math.PI + i - t * spin + lag;
                const size = 0.6 - k * 0.1;
                return <Block key={`${p}-${k}`} position={[Math.cos(a) * ORBIT_SPHERE, Math.sin(a) * ORBIT_SPHERE, 0]} size={[size, size, size]} color={WHITE_HOT} glow={1.6 - k * 0.25} />;
              }),
            )}
          </group>
        );
      })}
      {arrows > 0.04 ? (
        <>
          <Arrow3D from={[0, 0, ARROW_Z]} to={arrowTip(ORBIT_R, 150)} radius={0.16} color={RED} glow={1} />
          <Arrow3D from={[0, 0, ARROW_Z]} to={arrowTip(ORBIT_SPHERE, 30)} radius={0.16} color={CYAN} glow={1} />
        </>
      ) : null}
    </group>
  );
};

// ---- True ray paths either side of the critical distance ----
const CRIT_S = 1.6;
const CRIT_X = 6.9;
const CRIT_Y = 3.4;
const CAPTURED = "#ff6a4d";
const ESCAPED = CYAN;

const CRITICAL_RAYS = [
  { share: 0.72, color: CAPTURED, glow: 1 },
  { share: 0.9, color: CAPTURED, glow: 1 },
  { share: 0.985, color: CAPTURED, glow: 1.1 },
  { share: 1.0012, color: WHITE_HOT, glow: 1.6 },
  { share: 1.02, color: ESCAPED, glow: 1.1 },
  { share: 1.08, color: ESCAPED, glow: 1 },
  { share: 1.25, color: ESCAPED, glow: 1 },
].map((ray) => {
  const impact = CRITICAL_IMPACT * ray.share;
  const traced = traceRay(impact, Math.hypot(CRIT_X, impact), (x, y) => Math.abs(x) < CRIT_X + 0.1 && Math.abs(y) < CRIT_Y);
  return { ...ray, points: worldPath(traced, 40, CRIT_S), length: pathLength(traced) * CRIT_S };
});
const CRIT_LONGEST = Math.max(...CRITICAL_RAYS.map((ray) => ray.length));

const CriticalSet: React.FC<{ t: number }> = ({ t }) => {
  const travelled = Math.max(0, t - barT(10.75) - 0.05) * (CRIT_LONGEST / barT(1));
  return (
    <group position={[SETS.critical, 0, 0]}>
      <Stars seed={26} />
      <Ball radius={CRIT_S} detail={24} color={BLACK} />
      <Ring radius={CRIT_S + 0.04} tube={0.06} color={RED} glow={1} />
      <Ring radius={CRIT_S * PHOTON_SPHERE} tube={0.05} color={GOLD} glow={0.8} />
      {CRITICAL_RAYS.map((ray, i) => {
        const reveal = clamp01(travelled / ray.length);
        return (
          <group key={i}>
            <Path points={ray.points} reveal={reveal} radius={0.1} color={ray.color} glow={ray.glow} />
            {reveal > 0 && reveal < 1 ? <Block position={pointAt(ray.points, reveal)} size={[0.42, 0.42, 0.42]} color={WHITE_HOT} glow={1.8} /> : null}
          </group>
        );
      })}
    </group>
  );
};

// ---- The disk: its far half folds up over the hole, then the thin photon rings appear ----
const SHADOW_R = 3;
const DISK_IN = 3.7;
const DISK_OUT = 8.8;
const DISK_TILT = 0.14;
const DISK_LANES = 5;
const LOWER_ARC_SPOTS = 24;
const CIRCLING_LAGS = [0, 0.1, 0.2];

const LANES = Array.from({ length: DISK_LANES }, (_, k) => {
  const heat = k / (DISK_LANES - 1);
  const r = lerp(DISK_IN, DISK_OUT, heat);
  return { r, heat, spots: Math.round(r * 7), color: mix("#fff1c2", "#e8642a", heat) };
});

const PHOTON_RINGS = [
  { radius: 3.38, tube: 0.1, color: WHITE_HOT, glow: 1.7 },
  { radius: 3.2, tube: 0.06, color: "#ffe2a0", glow: 1.1 },
  { radius: 3.08, tube: 0.045, color: "#c79a5a", glow: 0.7 },
];

const arcRadius = (r: number) => SHADOW_R + 0.75 + (r - DISK_IN) * 0.33;

/** A spot on the disk. The near half stays flat. As `warp` reaches 1 the far half lifts into an arc over the hole. */
const diskPoint = (r: number, angle: number, warp: number): V3 => {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  if (s >= 0) return [r * c, 0, r * s];
  const lift = -s;
  const bent = lerp(r, arcRadius(r), lift);
  return [lerp(r * c, bent * c, warp), bent * lift * warp, lerp(r * s, -0.6 * lift, warp)];
};

const DiskSet: React.FC<{ t: number }> = ({ t }) => {
  const warp = easeOutBack(progress(t, barT(12), barT(12) + beatT(1.5)));
  const pulse = hitPulse(t, KICKS);
  const ringsFrom = barT(13.25);
  const spin = (Math.PI * 2) / barT(1);
  return (
    <group position={[SETS.disk, 0, 0]}>
      <Stars seed={27} />
      <Ball radius={SHADOW_R} detail={28} color={BLACK} />
      <group rotation={[DISK_TILT, 0, 0]}>
        {LANES.map((lane, k) =>
          Array.from({ length: lane.spots }, (_, j) => {
            const angle = (j / lane.spots) * Math.PI * 2 + hash(j, 100 + k) * 0.05 + t * 1.4 * (DISK_IN / lane.r) ** 1.5;
            return <Block key={`${k}-${j}`} position={diskPoint(lane.r, angle, warp)} size={[0.46, 0.46, 0.46]} color={lane.color} glow={1.4 - 0.6 * lane.heat + 0.2 * pulse} />;
          }),
        )}
        {warp > 0.05
          ? [0, 1].map((k) =>
              Array.from({ length: LOWER_ARC_SPOTS }, (_, j) => {
                const sweep = ((j / LOWER_ARC_SPOTS + t * 0.12) % 1) * Math.PI;
                const r = SHADOW_R + 0.75 + k * 0.32;
                return <Block key={`low-${k}-${j}`} position={[r * Math.cos(sweep), -r * Math.sin(sweep) * warp, -0.6]} size={[0.32, 0.32, 0.32]} color={mix("#ffd08a", "#d8602a", k)} glow={1} />;
              }),
            )
          : null}
      </group>
      {PHOTON_RINGS.map((ring, i) => {
        const pop = popIn(t, ringsFrom + beatT(i * 2), 0.25);
        return pop > 0 ? (
          <group key={i} scale={Math.max(0.001, pop)}>
            <Ring radius={ring.radius} tube={ring.tube} color={ring.color} glow={ring.glow} />
          </group>
        ) : null;
      })}
      {t >= ringsFrom
        ? [0, 1, 2, 3, 4, 5].map((p) =>
            CIRCLING_LAGS.map((lag, k) => {
              const a = (p / 6) * Math.PI * 2 - t * spin + lag;
              const size = 0.26 - k * 0.05;
              return <Block key={`${p}-${k}`} position={[Math.cos(a) * PHOTON_RINGS[0].radius, Math.sin(a) * PHOTON_RINGS[0].radius, 0.2]} size={[size, size, size]} color="#ffffff" glow={1.8 - k * 0.4} />;
            }),
          )
        : null}
    </group>
  );
};

// ---- The shadow grows out past the event horizon ----
const HORIZON_R = 2;

const ShadowSet: React.FC<{ t: number }> = ({ t }) => {
  const from = barT(14.5);
  const grown = easeOutCubic(progress(t, from + beatT(0.5), from + beatT(2.5)));
  const edge = lerp(HORIZON_R, HORIZON_R * SHADOW_DRAWN_RATIO, grown);
  const pulse = hitPulse(t, KICKS);
  return (
    <group position={[SETS.shadow, 0, 0]}>
      <Stars seed={28} />
      <group position={[0, 0, -2]}>
        <group scale={[edge, edge, 0.05]}>
          <Ball radius={1} detail={32} color={BLACK} />
        </group>
        <group scale={1 + 0.015 * pulse}>
          <Ring radius={edge + 0.2} tube={0.22} color="#ffc878" glow={1.4} />
        </group>
        <Ring radius={edge + 0.78} tube={0.36} color="#8a3a1a" glow={0.55} />
      </group>
      <Ball radius={HORIZON_R} detail={24} color="#241746" glow={0.25} />
      <Ring radius={HORIZON_R + 0.03} tube={0.08} color={RED} glow={1.2} />
    </group>
  );
};

// ---- Sagittarius A*: a blocky ring, the predicted size over it, then light feeding it ----
const SGR_SEGMENTS = 56;
const SGR_BANDS = 4;
const SGR_HALF_WIDTH = 0.95;
const SGR_RAY_COUNT = 6;
const SGR_REACH = 1.85;
const SGR_RAY = worldPath(traceRay(CRITICAL_IMPACT * 1.001, SGR_REACH, (x, y) => Math.hypot(x, y) < SGR_REACH + 0.01), 24, SGR_RING_RADIUS / PHOTON_SPHERE);

const SgrSet: React.FC<{ t: number }> = ({ t }) => {
  const from = barT(15.75);
  const build = progress(t, from, from + barT(1));
  const predicted = popIn(t, barT(16.25), 0.25);
  const rays = progress(t, barT(17), barT(17.75));
  const pulse = hitPulse(t, KICKS);
  return (
    <group position={[SETS.sgr, 0, 0]}>
      <Stars seed={29} />
      <Ball radius={SGR_RING_RADIUS - 1.6} detail={24} color={BLACK} />
      {Array.from({ length: SGR_SEGMENTS }, (_, i) => {
        const shown = staggered(build, i, SGR_SEGMENTS, 0.75);
        if (shown <= 0) return null;
        const angle = (i / SGR_SEGMENTS) * Math.PI * 2;
        const knots = Math.max(0, Math.cos(3 * (angle - 0.6))) ** 2;
        return Array.from({ length: SGR_BANDS }, (_, k) => {
          const band = (k / (SGR_BANDS - 1)) * 2 - 1;
          const radius = SGR_RING_RADIUS + band * SGR_HALF_WIDTH;
          const heat = clamp01((0.35 + 0.65 * knots) * (1 - band * band * 0.7) + 0.12 * noise(t * 0.8, i + k * 100) + 0.1 * pulse);
          const color = heat < 0.5 ? mix("#4a1006", "#e85a14", heat * 2) : mix("#e85a14", "#ffe6a8", (heat - 0.5) * 2);
          return (
            <group key={`${i}-${k}`} position={[Math.cos(angle) * radius, Math.sin(angle) * radius, 0]} rotation={[0, 0, angle]} scale={Math.max(0.001, shown)}>
              <Block size={[0.66, 0.66, 0.66]} color={color} glow={0.7 + 0.8 * heat} />
            </group>
          );
        });
      })}
      {predicted > 0 ? (
        <group position={[0, 0, 0.6]} scale={Math.max(0.001, predicted)}>
          <Ring radius={SGR_RING_RADIUS} tube={0.1} color={CYAN} glow={1.1} />
        </group>
      ) : null}
      {rays > 0
        ? Array.from({ length: SGR_RAY_COUNT }, (_, i) => (
            <group key={i} position={[0, 0, 0.4]} rotation={[0, 0, (i / SGR_RAY_COUNT) * Math.PI * 2]}>
              <Path points={SGR_RAY} reveal={rays} radius={0.08} color="#ffe9b0" glow={1.4} />
            </group>
          ))
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
      {within(t, 0, barT(2)) ? <HoleSet t={t} /> : null}
      {within(t, barT(2), barT(4.5)) ? <SunSet t={t} /> : null}
      {within(t, barT(4.5), barT(5.75)) ? <EclipseSet t={t} /> : null}
      {within(t, barT(5.75), barT(8.25)) ? <MassSet t={t} /> : null}
      {within(t, barT(8.25), barT(10.75)) ? <OrbitSet t={t} /> : null}
      {within(t, barT(10.75), barT(12)) ? <CriticalSet t={t} /> : null}
      {within(t, barT(12), barT(14.5)) ? <DiskSet t={t} /> : null}
      {within(t, barT(14.5), barT(15.75)) ? <ShadowSet t={t} /> : null}
      {t >= barT(15.75) - 0.05 ? <SgrSet t={t} /> : null}
    </PixelStage>
  );
};
