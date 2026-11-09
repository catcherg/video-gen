// Writes sample songs to listen to, with measurements. Usage: npm run song-samples [-- --seeds 3] [-- --bars 18]
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { encodeWav } from "../src/core/audio";
import { planSong, songHits, STYLE_FRAMES_PER_BEAT, type SongStyle } from "../src/core/music/plan";
import { renderSong } from "../src/core/music/render";
import { ROOT } from "./lib/episode";
import { analyseSong, formatReport, songProblems } from "./lib/songAnalysis";

const flag = (name: string, fallback: number) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? Number(process.argv[i + 1]) : fallback;
};

const seeds = flag("seeds", 3);
const bars = flag("bars", 18);
const FPS = 30;
const outDir = path.join(ROOT, "out", "song-samples");
mkdirSync(outDir, { recursive: true });

let failed = false;
for (const style of ["house", "dubstep"] as SongStyle[]) {
  for (let seed = 1; seed <= seeds; seed++) {
    const plan = planSong({ style, seed, fps: FPS, framesPerBeat: STYLE_FRAMES_PER_BEAT[style], bars });
    const wav = encodeWav(renderSong(plan));
    const file = path.join(outDir, `${style}-seed${seed}.wav`);
    writeFileSync(file, wav);
    const hits = songHits(plan);
    const report = analyseSong(wav, hits.KICKS, hits.IMPACTS);
    const problems = songProblems(report);
    failed ||= problems.length > 0;
    console.log(`${problems.length === 0 ? "PASS" : "FAIL"} ${path.relative(ROOT, file)} (${plan.durationS.toFixed(1)} s, ${plan.bpm.toFixed(1)} BPM, root ${plan.rootMidi}): ${formatReport(report)}`);
    for (const p of problems) console.log(`     ${p}`);
  }
}
process.exit(failed ? 1 : 0);
