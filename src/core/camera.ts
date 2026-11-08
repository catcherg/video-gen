import * as THREE from "three";
import { clamp01, smootherstep } from "./math";

export type V3 = [number, number, number];

/** `via` bends the move from the previous key into this one (quadratic Bezier). */
export type CameraKey = { t: number; pos: V3; target: V3; fov: number; via?: V3 };

export type CameraPose = { pos: THREE.Vector3; target: THREE.Vector3; fov: number };
export type CameraFn = (t: number) => CameraPose;

export const CAMERA_NEAR = 0.5;
export const CAMERA_FAR = 600;

/** Keyframed camera: between keys it eases, and nearby key pairs make slow drifts during holds. */
export const makeCameraRig = (keys: CameraKey[]): CameraFn => (t) => {
  let i = 0;
  while (i < keys.length - 2 && t > keys[i + 1].t) i++;
  const a = keys[i];
  const b = keys[i + 1];
  const u = smootherstep(clamp01((t - a.t) / (b.t - a.t)));
  const lerp = (p: V3, q: V3) =>
    new THREE.Vector3(p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u, p[2] + (q[2] - p[2]) * u);
  const pos = b.via
    ? new THREE.Vector3(...a.pos)
        .multiplyScalar((1 - u) * (1 - u))
        .add(new THREE.Vector3(...b.via).multiplyScalar(2 * u * (1 - u)))
        .add(new THREE.Vector3(...b.pos).multiplyScalar(u * u))
    : lerp(a.pos, b.pos);
  return { pos, target: lerp(a.target, b.target), fov: a.fov + (b.fov - a.fov) * u };
};

/** Keeps a label's centre clear of the frame edges and below a top limit such as the HUD. */
export const keepClear = <P extends { x: number; y: number }>(p: P, width: number, top: number, sideMargin: number): P => ({
  ...p,
  x: Math.min(width - sideMargin, Math.max(sideMargin, p.x)),
  y: Math.max(top, p.y),
});

/** Projects a world point to screen pixels using the same camera the scene draws with. */
export const makeProjector = (cameraAt: CameraFn) => (p: THREE.Vector3, t: number, w: number, h: number) => {
  const cam = cameraAt(t);
  const pc = new THREE.PerspectiveCamera(cam.fov, w / h, CAMERA_NEAR, CAMERA_FAR);
  pc.position.copy(cam.pos);
  pc.lookAt(cam.target);
  pc.updateMatrixWorld();
  pc.updateProjectionMatrix();
  const v = p.clone().project(pc);
  return { x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * h, visible: v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1 };
};
