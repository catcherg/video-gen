import * as THREE from "three";
import { C } from "../core/theme";

/** One exhaust primary through the given points. */
export const headerTube = (points: THREE.Vector3[], radius = 0.15) =>
  new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 20, radius, 6, false);

/** Exhaust headers. `ghost` 0..1 fades one tube out so the camera can see past it. */
export const Headers: React.FC<{ tubes: THREE.BufferGeometry[]; ghost: (index: number) => number }> = ({ tubes, ghost }) => (
  <>
    {tubes.map((g, i) => {
      const fade = ghost(i);
      return (
        <mesh key={i} geometry={g} visible={fade < 0.97}>
          <meshLambertMaterial color={C.header} flatShading transparent={fade > 0} opacity={1 - fade * 0.85} depthWrite={fade < 0.5} />
        </mesh>
      );
    })}
  </>
);
