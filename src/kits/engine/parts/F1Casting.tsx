import { useMemo } from "react";
import * as THREE from "three";
import { hash } from "../../../core/math";
import { C } from "../theme";

// The engine as a technical cutaway: solid castings with hatched cut faces, real ports and water jackets,
// on a blueprint backdrop. Sizes come from `CastingSpec`, so the section always fits the moving parts.

export type CastingSpec = {
  deck: number;
  top: number;
  boreR: number;
  sumpY: number;
  /** Where the section plane sits, relative to each bank's first cylinder centre. */
  faceX: number;
  blockLength: number;
};

const CUT_ALUMINIUM = "#9c9fb4";
const CUT_HEAD = "#b4b7ca";
const WATER = "#2f86ea";

const hatchTexture = () => {
  const N = 8;
  const data = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const v = (x + y) % N < 2 ? 214 : 255;
      data.set([v, v, v, 255], (y * N + x) * 4);
    }
  }
  const tex = new THREE.DataTexture(data, N, N);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(5, 5);
  tex.needsUpdate = true;
  return tex;
};

type P = [number, number];

const shapeOf = (pts: P[], holes: P[][] = []) => {
  const s = new THREE.Shape();
  pts.forEach(([x, y], i) => (i === 0 ? s.moveTo(x, y) : s.lineTo(x, y)));
  s.closePath();
  for (const h of holes) {
    const path = new THREE.Path();
    h.forEach(([x, y], i) => (i === 0 ? path.moveTo(x, y) : path.lineTo(x, y)));
    path.closePath();
    s.holes.push(path);
  }
  return s;
};

/** Extrudes a shape drawn as (z, y) so its cut face points at -x and its depth runs toward +x. */
const section = (shape: THREE.Shape, depth: number) => {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 4 });
  g.rotateY(-Math.PI / 2);
  g.translate(depth, 0, 0);
  return g;
};

const Cut: React.FC<{ geo: THREE.BufferGeometry; hatch: THREE.Texture; colour: string }> = ({ geo, hatch, colour }) => (
  <mesh geometry={geo}>
    <meshLambertMaterial attach="material-0" map={hatch} color={colour} flatShading />
    <meshLambertMaterial attach="material-1" color="#5a5d78" flatShading />
  </mesh>
);

/** The cut through one bank, in that bank's frame (+y up the bore). `inner` is +1 if local +z faces the V. */
const BankSection: React.FC<{ spec: CastingSpec; inner: number; hatch: THREE.Texture; pulse: number }> = ({ spec, inner, hatch, pulse }) => {
  const { deck, top, boreR: R } = spec;
  const geo = useMemo(() => {
    const m = (pts: P[]): P[] => pts.map(([z, y]) => [z * inner, y]);
    const DEPTH = 0.42;
    const y0 = 0.7;
    const wall = (a: number, b: number) => section(shapeOf(m([[a, y0], [b, y0], [b, deck], [a, deck]])), DEPTH);
    const outline: P[] = [
      [-1.05, deck],
      [1.05, deck],
      [1.75, deck + 0.55],
      [1.75, deck + 1.0],
      [1.0, deck + 0.72],
      [0.97, top],
      [0.82, top],
      [0.82, deck + 0.42],
      [-0.82, deck + 0.42],
      [-0.82, top],
      [-0.97, top],
      [-1.05, deck + 0.5],
    ];
    const exhaust: P[] = [
      [-0.16, deck + 0.02],
      [-0.4, deck + 0.02],
      [-0.99, deck + 0.04],
      [-0.99, deck + 0.27],
      [-0.46, deck + 0.3],
      [-0.16, deck + 0.14],
    ];
    const intake: P[] = [
      [0.16, deck + 0.02],
      [0.16, deck + 0.14],
      [0.55, deck + 0.36],
      [1.25, deck + 0.64],
      [1.68, deck + 0.92],
      [1.68, deck + 0.6],
      [1.2, deck + 0.34],
      [0.55, deck + 0.06],
    ];
    const jacket = (a: number, b: number, y1: number, y2: number) => new THREE.ShapeGeometry(shapeOf(m([[a, y1], [b, y1], [b, y2], [a, y2]])));
    return {
      inside: wall(R, R + 0.34),
      outside: wall(-R - 0.34, -R),
      head: section(shapeOf(m(outline), [m(exhaust), m(intake)]), DEPTH),
      jackets: [jacket(R + 0.09, R + 0.25, y0 + 0.14, deck - 0.05), jacket(-R - 0.25, -R - 0.09, y0 + 0.14, deck - 0.05), jacket(-0.78, -0.42, deck + 0.32, deck + 0.4), jacket(0.3, 0.72, deck + 0.04, deck + 0.13)],
      liners: [jacket(R - 0.012, R + 0.022, y0, deck), jacket(-R - 0.022, -R + 0.012, y0, deck)],
    };
  }, [deck, top, R, inner]);
  const flow = new THREE.Color(WATER).multiplyScalar(0.9 + pulse * 0.35);
  return (
    <>
      <Cut geo={geo.inside} hatch={hatch} colour={CUT_ALUMINIUM} />
      <Cut geo={geo.outside} hatch={hatch} colour={CUT_ALUMINIUM} />
      <Cut geo={geo.head} hatch={hatch} colour={CUT_HEAD} />
      {geo.jackets.map((g, i) => (
        <mesh key={i} geometry={g} position={[-0.004, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
          <meshBasicMaterial color={flow} side={2} />
        </mesh>
      ))}
      {geo.liners.map((g, i) => (
        <mesh key={i} geometry={g} position={[-0.006, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
          <meshBasicMaterial color="#d7dcf5" side={2} />
        </mesh>
      ))}
    </>
  );
};

/** Crankcase and sump in section, in world (z, y) around the crank centre. */
const CrankcaseSection: React.FC<{ spec: CastingSpec; hatch: THREE.Texture }> = ({ spec, hatch }) => {
  const geo = useMemo(() => {
    const R = spec.boreR;
    const toWorld = (bank: number, zl: number, yl: number): P => {
      const b = (bank * Math.PI) / 4;
      return [yl * Math.sin(b) + zl * Math.cos(b), yl * Math.cos(b) - zl * Math.sin(b)];
    };
    const y0 = 0.7;
    const A_OUT = toWorld(-1, -R - 0.34, y0);
    const B_OUT = toWorld(1, R + 0.34, y0);
    const A_EDGE = toWorld(-1, -R, y0);
    const B_EDGE = toWorld(1, R, y0);
    const CAVITY = 0.72;
    const arc: P[] = [];
    const a0 = Math.atan2(B_EDGE[1], B_EDGE[0]);
    const a1 = Math.PI - a0;
    for (let i = 0; i <= 24; i++) {
      const a = a0 - (i / 24) * (2 * Math.PI - (a1 - a0));
      arc.push([Math.cos(a) * CAVITY, Math.sin(a) * CAVITY]);
    }
    const lower: P[] = [A_OUT, [-1.38, spec.sumpY], [1.38, spec.sumpY], B_OUT, B_EDGE, ...arc, A_EDGE];
    const A_IN = toWorld(-1, R, y0);
    const B_IN = toWorld(1, -R, y0);
    const wedge: P[] = [A_IN, [0, 0.7], B_IN, [0.42, 1.28], [-0.42, 1.28]];
    return { lower: section(shapeOf(lower), 0.42), wedge: section(shapeOf(wedge), 0.42) };
  }, [spec]);
  return (
    <>
      <Cut geo={geo.lower} hatch={hatch} colour={CUT_ALUMINIUM} />
      <Cut geo={geo.wedge} hatch={hatch} colour={CUT_ALUMINIUM} />
    </>
  );
};

/** The front of the engine, sliced open. Moving parts at the front of each bank sit just ahead of this face. */
export const EngineSection: React.FC<{ spec: CastingSpec; firstCylX: [number, number]; bankRad: [number, number]; pulse: number }> = ({ spec, firstCylX, bankRad, pulse }) => {
  const hatch = useMemo(hatchTexture, []);
  return (
    <>
      <group position={[firstCylX[0] + spec.faceX, 0, 0]}>
        <CrankcaseSection spec={spec} hatch={hatch} />
      </group>
      {[0, 1].map((i) => (
        <group key={i} position={[firstCylX[i] + spec.faceX, 0, 0]} rotation={[bankRad[i], 0, 0]}>
          <BankSection spec={spec} inner={i === 0 ? 1 : -1} hatch={hatch} pulse={pulse} />
        </group>
      ))}
    </>
  );
};

/** Solid walls running back along a bank, so the engine reads as one casting from any angle. */
export const BankCasting: React.FC<{ spec: CastingSpec; x: number; length: number; showHead: boolean }> = ({ spec, x, length, showHead }) => {
  const { deck, top, boreR: R } = spec;
  const wallH = deck - 0.7;
  return (
    <>
      {[1, -1].map((s) => (
        <group key={s}>
          <mesh position={[x, 0.7 + wallH / 2, s * (R + 0.3)]}>
            <boxGeometry args={[length, wallH, 0.12]} />
            <meshLambertMaterial color="#6f7290" flatShading />
          </mesh>
          {showHead ? (
            <mesh position={[x, deck + (top - deck) / 2, s * 0.92]}>
              <boxGeometry args={[length, top - deck, 0.11]} />
              <meshLambertMaterial color="#80839f" flatShading />
            </mesh>
          ) : null}
        </group>
      ))}
    </>
  );
};

const blueprintTexture = () => {
  const N = 128;
  const data = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const major = x % 64 === 0 || y % 64 === 0;
      const minor = x % 16 === 0 || y % 16 === 0;
      const c = major ? [34, 44, 92] : minor ? [20, 25, 58] : [12, 15, 40];
      data.set([c[0], c[1], c[2], 255], (y * N + x) * 4);
    }
  }
  const tex = new THREE.DataTexture(data, N, N);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
};

/** A clean technical-drawing room around the engine, used in place of the workshop during the close-ups. */
export const BlueprintRoom: React.FC<{ centre: THREE.Vector3; pulse: number }> = ({ centre, pulse }) => {
  const map = useMemo(() => {
    const t = blueprintTexture();
    t.repeat.set(6, 6);
    return t;
  }, []);
  const glow = new THREE.Color(1, 1, 1).multiplyScalar(1 + pulse * 0.3);
  const SIZE = 240;
  return (
    <>
      <mesh position={[centre.x + 22, centre.y, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[SIZE, SIZE]} />
        <meshBasicMaterial map={map} color={glow} />
      </mesh>
      <mesh position={[centre.x, centre.y, 22]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[SIZE, SIZE]} />
        <meshBasicMaterial map={map} color={glow} />
      </mesh>
      <mesh position={[centre.x, centre.y - 6, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[SIZE, SIZE]} />
        <meshBasicMaterial map={map} color={glow} />
      </mesh>
    </>
  );
};

/** A mechanic in overalls, facing the car. `work` 0..1 bobs them with the beat. */
export const Mechanic: React.FC<{ x: number; z: number; face: number; suit: string; work: number; seed: number }> = ({ x, z, face, suit, work, seed }) => (
  <group position={[x, work * 0.25, z]} rotation={[0, face, 0]}>
    {[1, -1].map((s) => (
      <mesh key={s} position={[0, 2.4, s * 0.55]}>
        <boxGeometry args={[0.85, 4.6, 0.7]} />
        <meshLambertMaterial color={suit} flatShading />
      </mesh>
    ))}
    <mesh position={[0, 6.6, 0]}>
      <boxGeometry args={[1.2, 3.8, 2.1]} />
      <meshLambertMaterial color={suit} flatShading />
    </mesh>
    <mesh position={[0, 6.9, 0]}>
      <boxGeometry args={[1.25, 0.6, 2.2]} />
      <meshBasicMaterial color={hash(seed, 1) > 0.5 ? C.hot : "#35e0ff"} />
    </mesh>
    <mesh position={[0, 9.3, 0]}>
      <sphereGeometry args={[0.95, 8, 6]} />
      <meshLambertMaterial color={C.body} flatShading />
    </mesh>
    <mesh position={[-0.75, 9.3, 0]}>
      <boxGeometry args={[0.2, 0.55, 1.2]} />
      <meshLambertMaterial color={C.glass} flatShading />
    </mesh>
    <mesh position={[-1.1, 6.6 + work * 0.5, 1.15]} rotation={[0, 0, 1.2]}>
      <boxGeometry args={[0.55, 3.2, 0.55]} />
      <meshLambertMaterial color={suit} flatShading />
    </mesh>
    <mesh position={[-2.5, 5.9 + work * 0.5, 1.15]}>
      <boxGeometry args={[1.4, 0.8, 0.7]} />
      <meshLambertMaterial color={C.warm} flatShading />
    </mesh>
  </group>
);
