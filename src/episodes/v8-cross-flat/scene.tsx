import { useCurrentFrame, useVideoConfig } from "remotion";
import { D2R } from "../../core/math";
import { PixelStage } from "../../core/PixelStage";
import { Ground } from "../../parts/cars/common";
import { pinFor, PlaceholderEngine } from "../../parts/PlaceholderEngine";
import { CRANK_LENGTH, crankRadius, cylX, ORIGIN, ROD_L } from "./geometry";
import { bankDeg, engineAt } from "./physics";
import { cameraAt } from "./timeline";

// Stub: real piston and crank motion on a placeholder engine. The full model comes later.
export const Scene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const v8 = engineAt(t);
  const cylinders = [...v8.firingOrder]
    .sort((a, b) => a - b)
    .map((cyl) => ({ cyl, x: cylX(v8, cyl), bankRad: bankDeg(v8, cyl) * D2R, c: v8.engine.cycleAt(cyl, t) }));
  const pins = v8.pins.map(([a, b]) => pinFor((cylX(v8, a) + cylX(v8, b)) / 2, bankDeg(v8, a) * D2R, v8.engine.cycleAt(a, t)));
  return (
    <PixelStage t={t} cameraAt={cameraAt}>
      <Ground shadow={[12, 8]} />
      <PlaceholderEngine origin={ORIGIN} cylinders={cylinders} pins={pins} crankR={crankRadius(v8)} rodL={ROD_L} length={CRANK_LENGTH} />
    </PixelStage>
  );
};
