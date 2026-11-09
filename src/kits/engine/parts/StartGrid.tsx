import { useMemo } from "react";
import * as THREE from "three";
import { hash } from "../../../core/math";
import { C } from "../theme";
import { Box, Ground } from "./cars/common";
import { OpenWheeler, type Livery } from "./cars/OpenWheeler";

// A night-race start straight: road, kerbs, grid boxes, start lights, grandstands, a pit wall and generic
// rivals. No team colours, logos or sponsors. Everything repeats around `anchorX`, the camera's position
// along the track, so the straight is endless and each frame is a pure function of its inputs.

export const TRACK_HALF_WIDTH = 60;
const ASPHALT = "#3a3e78";
const LINE = "#e3e5f3";
const GANTRY_X = -90;
const GANTRY_Y = 30;
const LIGHTS_Z = -6; // over the pole side of the track, so they stay in shot behind the hero
const STAND_LEN = 180;
const STAND_Z = -96;
const KERB_LEN = 12;
const BOARD_COLOURS = ["#e5354b", "#35e0ff", "#ffe066", "#b78bff", "#6ee7b0", "#ff8a4d"];

const crowdTexture = () => {
  const W = 72;
  const H = 14;
  const PALETTE = [
    [255, 90, 110],
    [90, 200, 255],
    [255, 225, 120],
    [230, 232, 245],
    [120, 240, 190],
    [190, 150, 255],
    [36, 38, 70],
    [36, 38, 70],
  ];
  const data = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const c = PALETTE[Math.floor(hash(x * 3.1, y * 1.7) * PALETTE.length)];
      data.set([c[0], c[1], c[2], 255], (y * W + x) * 4);
    }
  }
  const tex = new THREE.DataTexture(data, W, H);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
};

/** Indices of repeating pieces with spacing `step` between `from` and `to` along the track. */
const span = (from: number, to: number, step: number) => {
  const out: number[] = [];
  for (let k = Math.floor(from / step); k * step <= to; k++) out.push(k);
  return out;
};

const GridBox: React.FC<{ x: number; z: number }> = ({ x, z }) => (
  <>
    <Box p={[x - 2, 0.04, z]} s={[0.8, 0.04, 21]} c={LINE} />
    {[1, -1].map((s) => (
      <Box key={s} p={[x + 2.2, 0.04, z + s * 10.3]} s={[9, 0.04, 0.8]} c={LINE} />
    ))}
  </>
);

/** The five-light start gantry. Each column has a top and a bottom lamp, as on a real gantry. */
const Gantry: React.FC<{ on: number; pulse: number }> = ({ on, pulse }) => (
  <group position={[GANTRY_X, 0, 0]}>
    {[1, -1].map((s) => (
      <Box key={s} p={[0, GANTRY_Y / 2, s * (TRACK_HALF_WIDTH + 2)]} s={[2, GANTRY_Y, 2]} c={C.metalDark} />
    ))}
    <Box p={[0, GANTRY_Y + 4, 0]} s={[1.6, 1.6, (TRACK_HALF_WIDTH + 4) * 2]} c={C.metalDark} />
    {[0, 1, 2, 3, 4].map((i) => {
      const lit = i < on;
      const lamp = lit ? new THREE.Color(C.tail).multiplyScalar(1.6 + pulse * 0.6) : new THREE.Color("#3a1420");
      return (
        <group key={i} position={[0, GANTRY_Y, LIGHTS_Z + (i - 2) * 7.2]}>
          <Box p={[0.3, 0, 0]} s={[1, 11, 6.2]} c="#0d0e1f" />
          {[2.6, -2.6].map((y) => (
            <mesh key={y} position={[1.05, y, 0]}>
              <boxGeometry args={[0.3, 4, 4.4]} />
              <meshBasicMaterial color={lamp} />
            </mesh>
          ))}
        </group>
      );
    })}
  </group>
);

const RIVAL_LIVERIES: Livery[] = [
  { body: "#4fc3ff", accent: "#16385e" },
  { body: "#6ee7b0", accent: "#1c5a4a" },
  { body: "#ffa133", accent: "#6a3410" },
  { body: "#b78bff", accent: "#3f2d78" },
  { body: "#ff6a4d", accent: "#f2eedc" },
  { body: "#ffe066", accent: "#2a2c4a" },
  { body: "#e3e5f3", accent: "#35e0ff" },
  { body: "#ff5fa2", accent: "#3a1430" },
];
/** Rivals beyond this slot use the lighter model, since they never get close to the camera. */
const FINE_RIVALS = 4;

const skylineTexture = () => {
  const W = 256;
  const H = 64;
  const data = new Uint8Array(W * H * 4);
  const put = (x: number, y: number, c: [number, number, number]) => data.set([c[0], c[1], c[2], 255], (y * W + x) * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) put(x, y, hash(x, y) > 0.992 && y > 26 ? [200, 205, 255] : [18 + y / 8, 19 + y / 8, 42 + y / 4]);
  let x = 0;
  let b = 0;
  while (x < W) {
    const w = 6 + Math.floor(hash(b, 1) * 12);
    const h = 12 + Math.floor(hash(b, 2) * 34);
    for (let i = x; i < Math.min(W, x + w); i++) {
      for (let y = 0; y < h; y++) {
        const lit = (i - x) % 3 === 1 && y % 3 === 1 && hash(i, y) > 0.55;
        put(i, y, lit ? (hash(i, y + 5) > 0.3 ? [255, 214, 130] : [120, 220, 255]) : [12, 13, 30]);
      }
    }
    x += w + (hash(b, 3) > 0.7 ? 2 : 0);
    b++;
  }
  const tex = new THREE.DataTexture(data, W, H);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
};

/** A floodlight mast and the pool of light it throws across the road. */
const Floodlight: React.FC<{ x: number; z: number; pulse: number }> = ({ x, z, pulse }) => (
  <group position={[x, 0, z]}>
    <Box p={[0, 36, 0]} s={[1.6, 72, 1.6]} c={C.metalDark} />
    <Box p={[0, 72, 0]} s={[14, 5, 1.2]} c="#0d0e1f" />
    {[-5, -1.7, 1.7, 5].flatMap((dx) =>
      [-1.3, 1.3].map((dy) => (
        <mesh key={`${dx}${dy}`} position={[dx, 72 + dy, Math.sign(-z) * 0.7]}>
          <boxGeometry args={[2.5, 1.9, 0.3]} />
          <meshBasicMaterial color={new THREE.Color("#fff2c4").multiplyScalar(1 + pulse * 0.4)} />
        </mesh>
      )),
    )}
  </group>
);

const Marshal: React.FC<{ x: number; z: number; wave: number; colour: string }> = ({ x, z, wave, colour }) => (
  <group position={[x, 0, z]}>
    <Box p={[0, 3.5, 0]} s={[6, 7, 6]} c="#6066a8" />
    <Box p={[0, 7.2, 0]} s={[7, 0.4, 7]} c={C.warm} />
    <Box p={[0, 9.2, 0]} s={[1.2, 3.2, 1]} c={C.warm} />
    <Box p={[0, 11.3, 0]} s={[0.9, 0.9, 0.9]} c={C.body} />
    <group position={[0, 10.4, 0.9]} rotation={[wave, 0, wave * 0.5]}>
      <Box p={[0, 3.2, 0]} s={[0.15, 6.4, 0.15]} c={C.metalLight} />
      <Box p={[0, 5.6, 2]} s={[0.1, 2.6, 4]} c={colour} />
    </group>
  </group>
);

export type RivalState = { x: number; z: number; slot: number };

export type StartGridProps = {
  anchorX: number;
  /** Red lights currently on, 0..5. */
  lightsOn: number;
  /** Beat pulse, 0..1, for the crowd and light strips. */
  pulse: number;
  /** Grid boxes for each slot, in world space. */
  boxes: { x: number; z: number }[];
  rivals: RivalState[];
  /** False during the climax, when only the hero's box and the lights are visible. */
  showField: boolean;
  /** Road speed, used to smear the kerbs into a solid band at pace. */
  speed: number;
  wheelSpin: number;
  /** Rubber laid down by the launch, in world space. */
  marks: { x: number; z: number; len: number }[];
  t: number;
  /** Where the hero is, for the spotlight during the climax. */
  heroX: number;
  heroZ: number;
};

export const StartGrid: React.FC<StartGridProps> = ({ anchorX, lightsOn, pulse, boxes, rivals, showField, speed, wheelSpin, marks, t, heroX, heroZ }) => {
  const crowd = useMemo(crowdTexture, []);
  const skyline = useMemo(skylineTexture, []);
  const from = anchorX - 620;
  const to = anchorX + 320;
  const smear = speed / 30;
  const wave = Math.sin(t * 13.46) * 0.5; // two swings per beat
  const beatIndex = Math.floor(t / (14 / 30));
  const led = new THREE.Color("#35e0ff").multiplyScalar(0.4 + pulse * 1.3);
  const crowdLight = new THREE.Color(1, 1, 1).multiplyScalar(0.85 + pulse * 0.5);
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[anchorX, -0.02, 0]}>
        <planeGeometry args={[2400, TRACK_HALF_WIDTH * 2]} />
        <meshLambertMaterial color={ASPHALT} />
      </mesh>
      {/* the start line: a checker strip across the road */}
      {span(-TRACK_HALF_WIDTH, TRACK_HALF_WIDTH - 1, 4).map((k) =>
        [0, 1].map((row) => <Box key={`${k}${row}`} p={[-34 + row * 4, 0.03, k * 4 + 2]} s={[4, 0.04, 4]} c={(k + row) % 2 === 0 ? LINE : "#0d0e1f"} />),
      )}
      {boxes.map((b, i) => (
        <GridBox key={i} x={b.x} z={b.z} />
      ))}
      <Gantry on={lightsOn} pulse={pulse} />
      {/* the rubbered-in racing line, road seams and earlier starts' tyre marks */}
      {[1, -1].map((side) => (
        <Box key={side} p={[anchorX - 150, 0.02, side * 14]} s={[1000, 0.02, 11]} c="#2b2e5c" />
      ))}
      {span(from, to, 110).map((k) => (
        <Box key={`seam${k}`} p={[k * 110, 0.025, 0]} s={[0.5, 0.02, TRACK_HALF_WIDTH * 2 - 6]} c="#565a99" />
      ))}
      {boxes.flatMap((b, i) =>
        [1, -1].map((side) => <Box key={`t${i}${side}`} p={[b.x + 28, 0.03, b.z + side * 7.5]} s={[34, 0.02, 2.2]} c="#1f2147" />),
      )}
      {marks.map((m, i) => (m.len > 1 ? <Box key={`m${i}`} p={[m.x - m.len / 2, 0.05, m.z]} s={[m.len, 0.02, 3]} c="#0b0c1a" /> : null))}
      {!showField ? (
        <>
          {/* during the climax, the car alone in a shaft of light */}
          <mesh position={[heroX + 2, 42, heroZ]}>
            <cylinderGeometry args={[5, 27, 84, 16, 1, true]} />
            <meshBasicMaterial color="#fff2c4" transparent opacity={0.08 + pulse * 0.06} depthWrite={false} side={2} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[heroX + 2, 0.06, heroZ]}>
            <circleGeometry args={[27, 32]} />
            <meshBasicMaterial color="#fff2c4" transparent opacity={0.16 + pulse * 0.12} depthWrite={false} />
          </mesh>
        </>
      ) : null}
      {showField ? (
        <>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[anchorX, -0.06, 0]}>
            <planeGeometry args={[2400, 1200]} />
            <meshLambertMaterial color="#232649" />
          </mesh>
          {/* a city at night, always beyond the circuit */}
          {[
            { p: [anchorX - 560, 92, 0] as [number, number, number], r: [0, Math.PI / 2, 0] as [number, number, number] },
            { p: [anchorX + 560, 92, 0] as [number, number, number], r: [0, -Math.PI / 2, 0] as [number, number, number] },
            { p: [anchorX, 92, -560] as [number, number, number], r: [0, 0, 0] as [number, number, number] },
            { p: [anchorX, 92, 560] as [number, number, number], r: [0, Math.PI, 0] as [number, number, number] },
          ].map((w, i) => (
            <mesh key={i} position={w.p} rotation={w.r}>
              <planeGeometry args={[1200, 190]} />
              <meshBasicMaterial map={skyline} />
            </mesh>
          ))}
          {span(from, to, 240).map((k) => (
            <group key={`fl${k}`}>
              <Floodlight x={k * 240} z={-(TRACK_HALF_WIDTH + 24)} pulse={pulse} />
              <Floodlight x={k * 240 + 120} z={TRACK_HALF_WIDTH + 72} pulse={pulse} />
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[k * 240 + 60, 0.08, 0]}>
                <planeGeometry args={[130, TRACK_HALF_WIDTH * 2 - 6]} />
                <meshBasicMaterial color="#d4dcff" transparent opacity={0.13} depthWrite={false} />
              </mesh>
            </group>
          ))}
          {/* centre dashes */}
          {span(from, to, 60).map((k) => (
            <Box key={k} p={[k * 60, 0.03, 0]} s={[22 + smear, 0.04, 0.8]} c="#5a5f8e" />
          ))}
          {[1, -1].map((side) => (
            <group key={side}>
              {span(from, to, KERB_LEN * 2).map((k) => (
                <Box key={k} p={[k * KERB_LEN * 2 + KERB_LEN / 2, 0.06, side * (TRACK_HALF_WIDTH - 1.5)]} s={[KERB_LEN + smear, 0.08, 3]} c={C.red} />
              ))}
              {span(from, to, KERB_LEN * 2).map((k) => (
                <Box key={`w${k}`} p={[k * KERB_LEN * 2 - KERB_LEN / 2, 0.05, side * (TRACK_HALF_WIDTH - 1.5)]} s={[KERB_LEN, 0.08, 3]} c={LINE} />
              ))}
              {/* catch fence */}
              <mesh position={[anchorX - 150, 13, side * (TRACK_HALF_WIDTH + 6.5)]}>
                <boxGeometry args={[1000, 16, 0.05]} />
                <meshBasicMaterial color="#c4c9f0" transparent opacity={0.2} depthWrite={false} />
              </mesh>
              <Box p={[anchorX - 150, 21, side * (TRACK_HALF_WIDTH + 6.5)]} s={[1000, 0.3, 0.3]} c={C.metal} />
              {span(from, to, 36).map((k) => (
                <Box key={`post${k}`} p={[k * 36, 11, side * (TRACK_HALF_WIDTH + 6.5)]} s={[0.5, 21, 0.5]} c={C.metal} />
              ))}
              {/* striped trackside boards, no names on them */}
              {span(from, to, 72).map((k) => (
                <group key={`board${k}`} position={[k * 72 + 20, 2.5, side * (TRACK_HALF_WIDTH + 4.3)]}>
                  <Box p={[0, 0, 0]} s={[48, 4.2, 0.2]} c={BOARD_COLOURS[((k % BOARD_COLOURS.length) + BOARD_COLOURS.length) % BOARD_COLOURS.length]} />
                  <Box p={[-8, 0, -side * 0.15]} s={[6, 4.2, 0.1]} c="#0d0e1f" />
                  <Box p={[10, 0, -side * 0.15]} s={[14, 1.2, 0.1]} c={LINE} />
                </group>
              ))}
              {/* tyre stacks at the foot of the wall */}
              {span(from, to, 54).map((k) => (
                <group key={`tyres${k}`} position={[k * 54 - 11, 0, side * (TRACK_HALF_WIDTH + 2.6)]}>
                  {[0, 1, 2].map((n) => (
                    <mesh key={n} position={[0, 0.8 + n * 1.5, 0]}>
                      <cylinderGeometry args={[1.9, 1.9, 1.4, 8]} />
                      <meshLambertMaterial color={n % 2 === 0 ? C.red : LINE} flatShading />
                    </mesh>
                  ))}
                </group>
              ))}
              {/* barrier with a light strip that hits on the kick */}
              <Box p={[anchorX - 150, 2.4, side * (TRACK_HALF_WIDTH + 5)]} s={[1000, 4.8, 0.8]} c="#6a6fae" />
              <mesh position={[anchorX - 150, 5, side * (TRACK_HALF_WIDTH + 5)]}>
                <boxGeometry args={[1000, 0.5, 1]} />
                <meshBasicMaterial color={led} />
              </mesh>
            </group>
          ))}
          {/* grandstands on one side */}
          {span(from, to, STAND_LEN).map((k) => (
            <group key={k} position={[k * STAND_LEN, 0, STAND_Z]}>
              <Box p={[0, 7, -1]} s={[STAND_LEN - 4, 14, 2]} c="#5a5f9e" />
              <mesh position={[0, 26, -13]} rotation={[-Math.PI / 2 + 0.72, 0, 0]}>
                <planeGeometry args={[STAND_LEN - 8, 34]} />
                <meshBasicMaterial map={crowd} color={crowdLight} />
              </mesh>
              <Box p={[0, 42, -20]} s={[STAND_LEN - 4, 1.2, 34]} c={C.metal} />
              {/* camera flashes all over the crowd on each kick */}
              {pulse > 0.3
                ? Array.from({ length: 9 }, (_, i) => {
                    const seed = beatIndex + k * 7;
                    const u = (hash(i, seed + 3) - 0.5) * 30;
                    return (
                      <mesh key={i} position={[(hash(seed, i) - 0.5) * (STAND_LEN - 20), 26 + 0.66 * u + 0.35, -13 - 0.75 * u + 0.35]}>
                        <boxGeometry args={[2, 2, 0.4]} />
                        <meshBasicMaterial color="#ffffff" />
                      </mesh>
                    );
                  })
                : null}
              {/* flags along the roof */}
              {[-70, -35, 0, 35, 70].map((dx, i) => (
                <group key={`f${dx}`} position={[dx, 42.6, -3]} rotation={[0, wave * (i % 2 === 0 ? 1 : -1), 0]}>
                  <Box p={[0, 5, 0]} s={[0.25, 10, 0.25]} c={C.metalLight} />
                  <Box p={[0, 8, 3]} s={[0.1, 4, 6]} c={BOARD_COLOURS[(i + 2) % BOARD_COLOURS.length]} />
                </group>
              ))}
              {[-60, 0, 60].map((dx) => (
                <mesh key={dx} position={[dx, 40.8, -8]}>
                  <boxGeometry args={[14, 0.6, 3]} />
                  <meshBasicMaterial color={new THREE.Color("#fff2c4").multiplyScalar(0.7 + pulse * 0.5)} />
                </mesh>
              ))}
            </group>
          ))}
          {/* pit wall and pit building on the other side */}
          {span(from, to, 40).map((k) => (
            <Box key={k} p={[k * 40, 8, TRACK_HALF_WIDTH + 13]} s={[3, 16, 2]} c={C.metalDark} />
          ))}
          {/* pit-wall crew, who jump on the kick, and a marshal post every so often */}
          {span(from, to, 26).map((k) => (
            <group key={`crew${k}`} position={[k * 26 + 7, 16 + pulse * 1.4 * (((k % 2) + 2) % 2), TRACK_HALF_WIDTH + 13]}>
              <Box p={[0, 2.2, 0]} s={[1.5, 3.2, 1]} c={BOARD_COLOURS[((k % BOARD_COLOURS.length) + BOARD_COLOURS.length) % BOARD_COLOURS.length]} />
              <Box p={[0, 4.4, 0]} s={[1, 1, 1]} c={C.body} />
            </group>
          ))}
          {span(from, to, 180).map((k) => (
            <Marshal key={`marshal${k}`} x={k * 180 + 50} z={TRACK_HALF_WIDTH + 9.5} wave={wave} colour="#6ee7b0" />
          ))}
          {span(from, to, 60).map((k) => (
            <group key={k} position={[k * 60, 0, TRACK_HALF_WIDTH + 44]}>
              <Box p={[0, 15, 0]} s={[52, 30, 24]} c="#454a86" />
              <Box p={[0, 6.5, -12.2]} s={[44, 11, 0.4]} c="#6a6fae" />
              {/* lit garages with a car being worked on, and a row of windows upstairs */}
              {[-13, 13].map((dx, i) => (
                <group key={dx} position={[dx, 0, -12.4]}>
                  <Box p={[0, 6.2, 0]} s={[20, 10.4, 0.2]} c={i === 0 ? "#556099" : "#6a5d8e"} />
                  <Box p={[0, 11.1, -0.2]} s={[20, 0.8, 0.2]} c={BOARD_COLOURS[((k + i) % BOARD_COLOURS.length + BOARD_COLOURS.length) % BOARD_COLOURS.length]} />
                  <Box p={[0, 2.4, -0.2]} s={[13, 2.4, 0.2]} c="#20223f" />
                  {[-7, 7].map((m) => (
                    <group key={m} position={[m, 0, -0.3]}>
                      <Box p={[0, 3.2, 0]} s={[1.4, 3.6, 0.3]} c={C.warm} />
                      <Box p={[0, 5.6, 0]} s={[1, 1, 0.3]} c={C.body} />
                    </group>
                  ))}
                </group>
              ))}
              {[-20, -10, 0, 10, 20].map((dx) => (
                <mesh key={`win${dx}`} position={[dx, 26, -12.3]}>
                  <boxGeometry args={[7, 4, 0.2]} />
                  <meshBasicMaterial color="#ffd98a" />
                </mesh>
              ))}
              <mesh position={[0, 21, -12.3]}>
                <boxGeometry args={[46, 1, 0.3]} />
                <meshBasicMaterial color={new THREE.Color(C.warm).multiplyScalar(0.5 + pulse * 0.7)} />
              </mesh>
            </group>
          ))}
          {rivals.map((r) => (
            <group key={r.slot} position={[r.x, 0, r.z]}>
              <OpenWheeler coverLift={0} wheelSpin={wheelSpin} livery={RIVAL_LIVERIES[(r.slot - 1) % RIVAL_LIVERIES.length]} pulse={pulse} fine={r.slot <= FINE_RIVALS} />
            </group>
          ))}
        </>
      ) : null}
      <Ground shadow={[0.01, 0.01]} floor={false} />
    </>
  );
};
