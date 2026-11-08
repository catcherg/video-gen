import { ThreeCanvas } from "@remotion/three";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPixelatedPass } from "three/examples/jsm/postprocessing/RenderPixelatedPass.js";
import { useVideoConfig } from "remotion";
import { CAMERA_FAR, CAMERA_NEAR, type CameraFn } from "./camera";
import { C, PIXEL_SIZE } from "./theme";

const PixelPass: React.FC<{ pixelSize: number }> = ({ pixelSize }) => {
  const { gl, scene, camera, size } = useThree();
  const composer = useMemo(() => {
    const c = new EffectComposer(gl);
    c.addPass(new RenderPixelatedPass(pixelSize, scene, camera, { normalEdgeStrength: 0.35, depthEdgeStrength: 0.5 }));
    c.addPass(new OutputPass());
    return c;
  }, [gl, scene, camera, pixelSize]);
  useEffect(() => composer.setSize(size.width, size.height), [composer, size]);
  useFrame(() => composer.render(), 1);
  return null;
};

const CameraRig: React.FC<{ t: number; cameraAt: CameraFn }> = ({ t, cameraAt }) => {
  const { camera } = useThree();
  useFrame(() => {
    const cam = cameraAt(t);
    const pc = camera as THREE.PerspectiveCamera;
    pc.position.copy(cam.pos);
    pc.fov = cam.fov;
    pc.near = CAMERA_NEAR;
    pc.far = CAMERA_FAR;
    pc.lookAt(cam.target);
    pc.updateProjectionMatrix();
  });
  return null;
};

/** The standard 3D setup: canvas, lights, camera rig and pixel pass around an episode's models. */
export const PixelStage: React.FC<{ t: number; cameraAt: CameraFn; children: React.ReactNode; pixelSize?: number }> = ({ t, cameraAt, children, pixelSize = PIXEL_SIZE }) => {
  const { width, height } = useVideoConfig();
  return (
    <ThreeCanvas width={width} height={height} flat linear={false} camera={{ fov: 30, position: [40, 15, 40] }}>
      <color attach="background" args={[C.bg]} />
      <hemisphereLight args={["#ffffff", "#2a2b50", 1.15]} />
      <directionalLight position={[20, 40, -25]} intensity={2.1} />
      <directionalLight position={[-30, 15, 30]} intensity={0.55} color="#b9c0ff" />
      <CameraRig t={t} cameraAt={cameraAt} />
      {children}
      <PixelPass pixelSize={pixelSize} />
    </ThreeCanvas>
  );
};
