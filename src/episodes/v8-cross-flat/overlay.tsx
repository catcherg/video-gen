import * as THREE from "three";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { keepClear, makeProjector } from "../../core/camera";
import { Captions } from "../../core/Captions";
import { Flashes } from "../../core/Flashes";
import { useFonts } from "../../core/fonts";
import { EngineHud, HUD_BOTTOM, type EngineHudConfig } from "../../core/hud";
import { Tag } from "../../core/Tag";
import { ORIGIN } from "./geometry";
import { CROSS, engineAt, FLAT, FLAT_REAL_START, FLAT_SLOW_START, isSlowed, REAL_SPEED_START, SHOW_RPM, SLOW, SLOW_START, SWAP_TO_FLAT_HOOK, TACH_MAX, TACH_RED_FROM, type V8 } from "./physics";
import { cameraAt, CAPTIONS, END_FADE_FROM, HUD_IN, SHOW_CRANK_LABEL } from "./timeline";

const project = makeProjector(cameraAt);

const hudFor = (v8: V8): EngineHudConfig => ({
  engine: v8.engine,
  isSlowed,
  slow: SLOW,
  hudIn: HUD_IN,
  realSpeedStart: REAL_SPEED_START,
  redline: SHOW_RPM,
  tachMax: TACH_MAX,
  tachRedFrom: TACH_RED_FROM,
});
const CROSS_HUD = hudFor(CROSS);
const FLAT_HUD = hudFor(FLAT);

const CRANK_LABEL_TOP = HUD_BOTTOM + 40;
const CRANK_LABEL_MARGIN = 150;

export const Overlay: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  useFonts();
  const v8 = engineAt(t);
  const crank = SHOW_CRANK_LABEL(t)
    ? keepClear(project(new THREE.Vector3(ORIGIN[0], ORIGIN[1] + 3.4, ORIGIN[2]), t, width, height), width, CRANK_LABEL_TOP, CRANK_LABEL_MARGIN)
    : null;
  return (
    <AbsoluteFill>
      {crank ? <Tag x={crank.x} y={crank.y} text={v8.label} size={30} /> : null}
      <EngineHud t={t} config={v8 === CROSS ? CROSS_HUD : FLAT_HUD} />
      <Captions t={t} captions={CAPTIONS} />
      <Flashes t={t} at={[SWAP_TO_FLAT_HOOK, SLOW_START, FLAT_SLOW_START, REAL_SPEED_START, FLAT_REAL_START]} endFadeFrom={END_FADE_FROM} />
    </AbsoluteFill>
  );
};
