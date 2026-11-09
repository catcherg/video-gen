// The 3D sets, built only from the framework's general shapes. Everything is a pure function of the time.
import * as THREE from "three";
import { useCurrentFrame, useVideoConfig } from "remotion";
import type { V3 } from "../../src/core/camera";
import { hash } from "../../src/core/math";
import { easeOutCubic, hitPulse, noise, popIn, progress, staggered } from "../../src/core/motion";
import { PixelStage } from "../../src/core/PixelStage";
import { Ball, Bar, Block, Cone, Particles } from "../../src/core/shapes";
import { barT, beatT, FINAL_DEBT_FLOOR_M, NET_CAPITAL_1780_M } from "./physics";
import { cameraAt, KICKS, SETS, STABS } from "./timeline";

const GOLD = "#f2b84b";
const GOLD_DARK = "#c98a2e";
const WOOD = "#7a4f2c";
const WOOD_DARK = "#4d3019";
const SAIL = "#f1e6cf";
const RED = "#e8674f";
const WATER_A = "#2c6f86";
const WATER_B = "#25607a";

const mix = (a: string, b: string, u: number) => `#${new THREE.Color(a).lerp(new THREE.Color(b), u).getHexString()}`;
const within = (t: number, from: number, to: number) => t >= from - 0.05 && t < to + 0.05;

// ---- Reusable props for this video ----
const Sky: React.FC<{ low: string; high: string }> = ({ low, high }) => (
  <>
    {Array.from({ length: 9 }, (_, i) => (
      <Block key={i} position={[0, 11 * i + 1, -90]} size={[320, 11.2, 1]} color={mix(low, high, i / 8)} glow={1} />
    ))}
  </>
);

const Sea: React.FC<{ t: number; dark?: number }> = ({ t, dark = 0 }) => (
  <>
    {Array.from({ length: 17 }, (_, x) =>
      Array.from({ length: 11 }, (_, z) => (
        <Block key={`${x}-${z}`} position={[(x - 8) * 8, noise(t * 0.9 + x * 0.5 + z * 0.7, 9) * 0.6 - 1, 88 - z * 14]} size={[8.1, 2, 14.1]} color={mix((x + z) % 2 ? WATER_A : WATER_B, "#10202c", dark)} />
      )),
    )}
  </>
);

/** A generic three-masted trading ship, with no flags or company marks. */
const Ship: React.FC<{ position: V3; rotation?: V3; scale?: number; dark?: number }> = ({ position, rotation, scale = 1, dark = 0 }) => {
  const wood = mix(WOOD, "#191210", dark);
  const sail = mix(SAIL, "#3b3232", dark);
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <Block position={[0, 1.6, 0]} size={[17, 3.2, 4.4]} color={wood} />
      <Block position={[-7.2, 4.1, 0]} size={[4.6, 2, 4.2]} color={mix(WOOD_DARK, "#120d0c", dark)} />
      <Block position={[8.2, 2.9, 0]} size={[2.2, 1.2, 3]} color={mix(WOOD_DARK, "#120d0c", dark)} />
      {[-4, 1.5, 6].map((x, i) => (
        <group key={x}>
          <Bar from={[x, 3, 0]} to={[x, 15 - i * 1.4, 0]} radius={0.28} color={mix(WOOD_DARK, "#120d0c", dark)} />
          <Block position={[x, 10.6 - i, 0.3]} size={[6 - i * 0.6, 3.6, 0.3]} color={sail} glow={0.65} />
          <Block position={[x, 6.4 - i * 0.6, 0.3]} size={[7 - i * 0.6, 3.6, 0.3]} color={sail} glow={0.65} />
        </group>
      ))}
    </group>
  );
};

const CoinStack: React.FC<{ position: V3; coins: number; radius?: number; color?: string; shade?: string }> = ({ position, coins, radius = 2.4, color = GOLD, shade = GOLD_DARK }) => (
  <group position={position}>
    {Array.from({ length: Math.max(0, Math.round(coins)) }, (_, i) => (
      <Bar key={i} from={[0, i * 0.62, 0]} to={[0, i * 0.62 + 0.52, 0]} radius={radius} sides={14} color={i % 2 ? color : shade} />
    ))}
  </group>
);

const within2 = (t: number, a: [number, number], b: [number, number]) => within(t, a[0], a[1]) || within(t, b[0], b[1]);

// ---- Ship at sea ----
const SeaSet: React.FC<{ t: number }> = ({ t }) => {
  const punch = hitPulse(t, STABS, 0.2);
  return (
    <group position={[SETS.sea, 0, 0]}>
      <Sky low="#f0c98a" high="#5b7fa8" />
      <Sea t={t} />
      <group position={[0, noise(t * 0.8, 2) * 0.5, 0]} rotation={[noise(t * 0.7, 3) * 0.05, 0, noise(t * 0.6, 4) * 0.05]}>
        <Ship position={[0, 0, 0]} scale={1 + 0.04 * punch} />
      </group>
    </group>
  );
};

// ---- Public money ----
const MoneySet: React.FC<{ t: number }> = ({ t }) => {
  const reveal = progress(t, barT(2), barT(3.5));
  const stacks: [number, number][] = [[-12, 8], [-6, 13], [0, 17], [6, 14], [12, 10]];
  return (
    <group position={[SETS.money, 0, 0]}>
      <Sky low="#5a4028" high="#2a1c12" />
      <Block position={[0, -2, 40]} size={[260, 4, 260]} color={WOOD_DARK} />
      {stacks.map(([x, coins], i) => (
        <CoinStack key={x} position={[x, 0, 0]} coins={coins * easeOutCubic(staggered(reveal, i, stacks.length))} />
      ))}
      {/* A share: a plain sheet of paper with a red wax seal. */}
      <group position={[0, 15 + hitPulse(t, KICKS) * 0.5, 4]} scale={Math.max(0.001, popIn(t, barT(2) + beatT(1), 0.3))}>
        <Block size={[9, 6, 0.3]} color={SAIL} glow={0.65} />
        <Block position={[0, 1.6, 0.2]} size={[6.5, 0.45, 0.1]} color={WOOD} />
        <Block position={[0, 0.3, 0.2]} size={[6.5, 0.45, 0.1]} color={WOOD} />
        <Ball position={[2.8, -1.8, 0.3]} radius={0.9} detail={10} color={RED} />
      </group>
    </group>
  );
};

// ---- The Banda Islands ----
const ISLAND = { y: -11, z: 6, r: 20 };
/** A point on the island's surface. */
const onIsland = (x: number, z: number): V3 => [x, ISLAND.y + Math.sqrt(Math.max(0, ISLAND.r ** 2 - x ** 2 - (z - ISLAND.z) ** 2)), z];
const TREES: V3[] = Array.from({ length: 7 }, (_, i) => onIsland(-9 + i * 3 + hash(i, 1), 2 + hash(i, 2) * 3));
const HOUSES: V3[] = Array.from({ length: 5 }, (_, i) => onIsland(-7 + i * 3.5, 10));

const BandaSet: React.FC<{ t: number }> = ({ t }) => {
  const attack = t >= barT(7);
  const empty = t >= barT(8);
  const flash = attack && !empty ? hitPulse(t, KICKS, 0.12) : 0;
  const dark = empty ? 0.7 : attack ? 0.35 : 0;
  return (
    <group position={[SETS.banda, 0, 0]}>
      <Sky low={mix("#ffd9a0", "#7a4a3a", dark)} high={mix("#7fb6c9", "#2a2030", dark)} />
      <Sea t={t} dark={dark * 0.7} />
      <Ball position={[0, ISLAND.y, ISLAND.z]} radius={ISLAND.r} detail={22} color={mix("#3f8a4c", "#28302a", dark)} />
      {TREES.map((p, i) => (
        <group key={i} position={p}>
          <Block position={[0, 1.5, 0]} size={[0.8, 3, 0.8]} color={mix(WOOD, "#1d1612", dark)} />
          <Cone position={[0, 4.6, 0]} radius={2.3} height={5} color={mix("#2c7d41", "#1e2a22", dark)} />
          <Ball position={[0.9, 3.8, 1.6]} radius={0.5} detail={8} color={mix(GOLD, "#4d4031", dark)} />
        </group>
      ))}
      {!empty
        ? HOUSES.map((p, i) => (
            <group key={i} position={p}>
              <Block position={[0, 1, 0]} size={[3, 2, 2.6]} color={SAIL} glow={0.5} />
              <Cone position={[0, 3, 0]} radius={2.4} height={2} sides={4} color={WOOD} />
            </group>
          ))
        : null}
      {attack && !empty ? (
        <>
          <Ship position={[-7.5, 0, 34]} scale={0.42} dark={0.3} />
          <Ship position={[7.5, 0, 34]} rotation={[0, Math.PI, 0]} scale={0.42} dark={0.3} />
          {flash > 0 ? <Ball position={[-3.6, 2.2, 34]} radius={0.5 + 1.5 * flash} detail={10} color="#ffd27a" glow={2} /> : null}
          {flash > 0 ? <Ball position={[3.6, 2.2, 34]} radius={0.5 + 1.5 * flash} detail={10} color="#ffd27a" glow={2} /> : null}
        </>
      ) : null}
    </group>
  );
};

// ---- Dividends ----
const ChestSet: React.FC<{ t: number }> = ({ t }) => (
  <group position={[SETS.chest, 0, 0]}>
    <Sky low="#5a4028" high="#2a1c12" />
    <Block position={[0, -2, 40]} size={[260, 4, 260]} color={WOOD_DARK} />
    <Block position={[0, 2.5, 0]} size={[16, 5, 10]} color="#a8683a" glow={0.25} />
    <Block position={[0, 2.5, 5.1]} size={[16.2, 1, 0.3]} color={GOLD} glow={0.4} />
    <Block position={[0, 5.3, 0]} size={[15, 0.8, 9]} color={GOLD} glow={0.5} />
    <Particles t={t} count={46} seed={31} origin={[-7, 5.5, -3]} box={[14, 18, 6]} velocity={[0, 11, 0]} size={1} colors={[GOLD, GOLD_DARK]} glow={0.6} />
  </group>
);

// ---- More cargo, the same profit ----
const CargoSet: React.FC<{ t: number }> = ({ t }) => {
  const grow = progress(t, barT(10), barT(12) - beatT(1));
  const columns = 7;
  return (
    <group position={[SETS.cargo, 0, 0]}>
      <Sky low="#5a4028" high="#2a1c12" />
      <Block position={[0, -2, 40]} size={[260, 4, 260]} color={WOOD_DARK} />
      {Array.from({ length: columns }, (_, c) => {
        const crates = Math.round(2 + (4 + c * 1.3) * easeOutCubic(staggered(grow, c, columns)));
        return Array.from({ length: crates }, (_, h) => <Block key={`${c}-${h}`} position={[-13 + c * 3.6, 1.5 + h * 3.1, -2]} size={[3.3, 3, 3.3]} color={(c + h) % 2 ? "#b07a45" : "#9a6636"} glow={0.35} />);
      })}
      {/* Profit stays the same size however high the cargo climbs. */}
      <CoinStack position={[-9, 0, 8]} coins={6} radius={2} />
      <CoinStack position={[9, 0, 8]} coins={6} radius={2} />
    </group>
  );
};

// ---- War ----
const WarSet: React.FC<{ t: number }> = ({ t }) => {
  const sink = progress(t, barT(12) + beatT(2), barT(14));
  const flash = t >= barT(12) && t < barT(14) ? hitPulse(t, KICKS, 0.14) : 0;
  return (
    <group position={[SETS.war, 0, 0]}>
      <Sky low="#d6653a" high="#2a1820" />
      <Sea t={t} dark={0.45} />
      <Ship position={[-4, -sink * 8, 0]} rotation={[0, 0, -0.42 * sink]} dark={0.25} />
      <Ship position={[11, -sink * 6, -16]} rotation={[0, Math.PI, 0.25 * sink]} scale={0.7} dark={0.5} />
      {flash > 0 ? <Ball position={[6, 5, -6]} radius={1 + 3.4 * flash} detail={10} color="#ffd27a" glow={2} /> : null}
      <Particles t={t} count={44} seed={41} origin={[-18, 1, -4]} box={[36, 26, 10]} velocity={[0.8, 7, 0]} size={0.55} colors={["#ffb45e", RED, "#ffe08a"]} glow={1.4} />
    </group>
  );
};

// ---- The fall, then the debt ----
const COINS_PER_MILLION = 0.56;

const FallSet: React.FC<{ t: number }> = ({ t }) => {
  const left = 1 - progress(t, barT(14) + beatT(2), barT(15) + beatT(3));
  const debt = easeOutCubic(progress(t, barT(16), barT(17)));
  return (
    <group position={[SETS.fall, 0, 0]}>
      <Sky low="#3d2415" high="#1a110a" />
      <Block position={[0, -2, 40]} size={[320, 4, 340]} color="#2e1e12" />
      {t < barT(16) ? <CoinStack position={[0, 0, 0]} coins={NET_CAPITAL_1780_M * COINS_PER_MILLION * left} radius={5} /> : null}
      {t >= barT(16) - 0.05 ? <CoinStack position={[0, 0, 0]} coins={FINAL_DEBT_FLOOR_M * COINS_PER_MILLION * debt} radius={5} color={RED} shade="#a83a2a" /> : null}
    </group>
  );
};

export const Scene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  return (
    <PixelStage t={t} cameraAt={cameraAt} pixelSize={2} normalEdge={0.55} depthEdge={0.85}>
      {within2(t, [0, barT(2)], [barT(4), barT(6)]) ? <SeaSet t={t} /> : null}
      {within(t, barT(2), barT(4)) ? <MoneySet t={t} /> : null}
      {within(t, barT(6), barT(9)) ? <BandaSet t={t} /> : null}
      {within(t, barT(9), barT(10)) ? <ChestSet t={t} /> : null}
      {within(t, barT(10), barT(12)) ? <CargoSet t={t} /> : null}
      {within(t, barT(12), barT(14)) ? <WarSet t={t} /> : null}
      {t >= barT(14) - 0.05 ? <FallSet t={t} /> : null}
    </PixelStage>
  );
};
