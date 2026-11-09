import { AbsoluteFill } from "remotion";
import { makeCameraRig } from "../../../core/camera";
import { PixelStage } from "../../../core/PixelStage";
import { C } from "../theme";
import { Ground } from "./cars/common";
import { Hatchback } from "./cars/Hatchback";
import { MuscleCoupe } from "./cars/MuscleCoupe";
import { WedgeSupercar } from "./cars/WedgeSupercar";

const cameraAt = makeCameraRig([
  { t: 0, pos: [100, 105, 125], target: [0, 4, 0], fov: 40 },
  { t: 1, pos: [100, 105, 125], target: [0, 4, 0], fov: 40 },
]);

/** Dev-only composition for eyeballing reusable models: npx remotion still parts-gallery out/gallery.png */
export const PartsGallery: React.FC = () => (
  <AbsoluteFill style={{ background: C.bg }}>
    <PixelStage t={0} cameraAt={cameraAt}>
      <Ground shadow={[1, 1]} />
      <group position={[0, 0, -32]}>
        <WedgeSupercar coverAngle={0} />
      </group>
      <MuscleCoupe hoodAngle={0.6} />
      <group position={[0, 0, 28]}>
        <Hatchback />
      </group>
    </PixelStage>
  </AbsoluteFill>
);
