import { ThreeCanvas } from "@remotion/three";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPixelatedPass } from "three/examples/jsm/postprocessing/RenderPixelatedPass.js";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { coverAngleAt, engineOrigin } from "../geometry";
import { cameraAt } from "../timeline";
import { Car } from "./Car";
import { Engine } from "./Engine";
import { C } from "./palette";

export const PIXEL = 4;

const Pixelate: React.FC = () => {
  const { gl, scene, camera, size } = useThree();
  const composer = useMemo(() => {
    const c = new EffectComposer(gl);
    const px = new RenderPixelatedPass(PIXEL, scene, camera, { normalEdgeStrength: 0.35, depthEdgeStrength: 0.5 });
    c.addPass(px);
    c.addPass(new OutputPass());
    return c;
  }, [gl, scene, camera]);
  useEffect(() => composer.setSize(size.width, size.height), [composer, size]);
  useFrame(() => composer.render(), 1);
  return null;
};

const CameraRig: React.FC<{ t: number }> = ({ t }) => {
  const { camera } = useThree();
  useFrame(() => {
    const cam = cameraAt(t);
    const pc = camera as THREE.PerspectiveCamera;
    pc.position.copy(cam.pos);
    pc.fov = cam.fov;
    pc.near = 0.5;
    pc.far = 600;
    pc.lookAt(cam.target);
    pc.updateProjectionMatrix();
  });
  return null;
};

export const Scene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  return (
    <ThreeCanvas width={width} height={height} flat linear={false} camera={{ fov: 30, position: [40, 15, 40] }}>
      <color attach="background" args={[C.bg]} />
      <hemisphereLight args={["#ffffff", "#2a2b50", 1.15]} />
      <directionalLight position={[20, 40, -25]} intensity={2.1} />
      <directionalLight position={[-30, 15, 30]} intensity={0.55} color="#b9c0ff" />
      <CameraRig t={t} />
      <Car coverAngle={coverAngleAt(t)} />
      <Engine t={t} frame={frame} origin={engineOrigin(t)} />
      <Pixelate />
    </ThreeCanvas>
  );
};
