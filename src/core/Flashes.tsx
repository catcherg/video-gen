import { AbsoluteFill } from "remotion";
import { UI } from "./theme";

/** White flashes at given times, plus a fade to ink at the end of the video. */
export const Flashes: React.FC<{ t: number; at: number[]; endFadeFrom: number }> = ({ t, at, endFadeFrom }) => {
  const flash = Math.max(...at.map((a) => Math.max(0, 1 - Math.abs(t - a) / 0.12))) * 0.55;
  const end = Math.min(1, Math.max(0, (t - endFadeFrom) / 0.5));
  return (
    <>
      {flash > 0 ? <AbsoluteFill style={{ background: "#ffffff", opacity: flash }} /> : null}
      {end > 0 ? <AbsoluteFill style={{ background: UI.ink, opacity: end }} /> : null}
    </>
  );
};
