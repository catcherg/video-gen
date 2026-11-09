import * as THREE from "three";
import { C } from "../theme";
import { Lam } from "../../../core/Lam";

const ALONG_X: [number, number, number] = [0, 0, Math.PI / 2];

const Pulley: React.FC<{ y: number; z: number; r: number; spin: number; c: string }> = ({ y, z, r, spin, c }) => (
  <group position={[0, y, z]} rotation={[spin, 0, 0]}>
    <mesh rotation={ALONG_X}>
      <cylinderGeometry args={[r, r, 0.14, 16]} />
      <Lam c={c} />
    </mesh>
    {[0, 1, 2].map((i) => {
      const a = (i / 3) * Math.PI * 2;
      return (
        <mesh key={i} position={[-0.09, Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5]} rotation={[a, 0, 0]}>
          <boxGeometry args={[0.04, r * 0.85, 0.08]} />
          <Lam c={C.metalDark} />
        </mesh>
      );
    })}
  </group>
);

const PULLEYS = { crank: [0, 0, 0.42], alternator: [1.28, 0.98, 0.25], water: [1.05, -0.85, 0.28] } as const;

const beltGeo = (() => {
  const { crank, alternator, water } = PULLEYS;
  const pts = [
    [crank[0] - crank[2] - 0.02, 0],
    [alternator[0], alternator[1] + alternator[2] + 0.04],
    [alternator[0] + alternator[2] + 0.04, alternator[1]],
    [water[0] + water[2] + 0.04, water[1]],
    [water[0], water[1] - water[2] - 0.04],
  ].map(([y, z]) => new THREE.Vector3(0, y, z));
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 48, 0.05, 4, true);
})();

/** Front-of-engine drive: crank pulley, alternator, water pump and serpentine belt. */
export const FrontDrive: React.FC<{ x: number; crankSpin: number }> = ({ x, crankSpin }) => (
  <group position={[x, 0, 0]}>
    <Pulley y={PULLEYS.crank[0]} z={PULLEYS.crank[1]} r={PULLEYS.crank[2]} spin={crankSpin} c={C.metalLight} />
    <Pulley y={PULLEYS.alternator[0]} z={PULLEYS.alternator[1]} r={PULLEYS.alternator[2]} spin={crankSpin * 1.7} c={C.metal} />
    <Pulley y={PULLEYS.water[0]} z={PULLEYS.water[1]} r={PULLEYS.water[2]} spin={crankSpin * 1.5} c={C.metal} />
    <mesh geometry={beltGeo}>
      <Lam c={C.coil} />
    </mesh>
    <mesh position={[0.34, PULLEYS.alternator[0], PULLEYS.alternator[1]]} rotation={ALONG_X}>
      <cylinderGeometry args={[0.34, 0.34, 0.5, 12]} />
      <Lam c={C.metalDark} />
    </mesh>
    <mesh position={[0.26, PULLEYS.water[0], PULLEYS.water[1]]} rotation={ALONG_X}>
      <cylinderGeometry args={[0.22, 0.3, 0.32, 10]} />
      <Lam c={C.spring} />
    </mesh>
  </group>
);

/** Fuel rail along a bank, feeding the injectors, in the bank's frame. */
export const FuelRail: React.FC<{ x: number; y: number; z: number; length: number }> = ({ x, y, z, length }) => (
  <mesh position={[x, y, z]} rotation={ALONG_X}>
    <cylinderGeometry args={[0.07, 0.07, length, 8]} />
    <Lam c={C.intake} />
  </mesh>
);

/** Oil filter and starter motor mounted on the side of the block. */
export const SideAncillaries: React.FC = () => (
  <>
    <mesh position={[-1.4, -0.65, 2.0]}>
      <cylinderGeometry args={[0.34, 0.34, 0.8, 12]} />
      <Lam c={C.crankGold} />
    </mesh>
    <mesh position={[-1.4, -0.2, 2.0]}>
      <cylinderGeometry args={[0.2, 0.2, 0.16, 10]} />
      <Lam c={C.metalDark} />
    </mesh>
    <mesh position={[3.0, -0.55, -1.7]} rotation={ALONG_X}>
      <cylinderGeometry args={[0.3, 0.3, 1.2, 12]} />
      <Lam c={C.metalDark} />
    </mesh>
    <mesh position={[3.72, -0.55, -1.7]} rotation={ALONG_X}>
      <cylinderGeometry args={[0.18, 0.18, 0.3, 10]} />
      <Lam c={C.metalLight} />
    </mesh>
  </>
);

/** Ignition harness running along a bank, in the bank's frame. */
export const Harness: React.FC<{ x: number; y: number; length: number }> = ({ x, y, length }) => (
  <mesh position={[x, y, 0]} rotation={ALONG_X}>
    <cylinderGeometry args={[0.05, 0.05, length, 6]} />
    <Lam c={C.warm} />
  </mesh>
);
