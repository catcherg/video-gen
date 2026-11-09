// Checks that the dominant frequency in each real-speed section matches physics within 1%.
// Usage: npm run verify-audio <slug>
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { ToneCheck } from "../src/core/video";
import { audioPath, loadToneChecks, requireSlug, ROOT } from "./lib/video";
import { spectralPeaks } from "./lib/fft";

const TOLERANCE = 0.01;
const SEARCH_MIN_HZ = 40;
const SEARCH_MAX_HZ = 5000;

const slug = requireSlug(process.argv[2], "npm run verify-audio <slug>");
const wavPath = audioPath(slug);
if (!existsSync(wavPath)) {
  console.error(`${path.relative(ROOT, wavPath)} not found. Run: npm run audio ${slug}`);
  process.exit(2);
}

const wav = readFileSync(wavPath);
const sampleRate = wav.readUInt32LE(24);
const frames = (wav.length - 44) / 4;
const signal = (channel: ToneCheck["channel"]) => {
  const out = new Float64Array(frames);
  for (let i = 0; i < frames; i++) {
    const l = wav.readInt16LE(44 + i * 4);
    const r = wav.readInt16LE(46 + i * 4);
    out[i] = (channel === "left" ? l * 2 : channel === "right" ? r * 2 : l + r) / 65536;
  }
  return out;
};

let failed = false;
for (const check of await loadToneChecks(slug)) {
  const section = signal(check.channel).subarray(Math.round(check.from * sampleRate), Math.round(check.to * sampleRate));
  const [top, ...rest] = spectralPeaks(section, sampleRate, check.minHz ?? SEARCH_MIN_HZ, check.maxHz ?? SEARCH_MAX_HZ);
  const error = Math.abs(top.hz - check.expectedHz) / check.expectedHz;
  const ok = error <= TOLERANCE;
  failed ||= !ok;
  const next = rest.find((p) => Math.abs(p.hz - top.hz) / top.hz > 0.03);
  const margin = next ? `${(top.db - next.db).toFixed(1)} dB above ${next.hz.toFixed(1)} Hz` : "no competing peak";
  console.log(
    `${ok ? "PASS" : "FAIL"} ${check.label}${check.channel ? ` [${check.channel}]` : ""} (${check.from}-${check.to} s): expected ${check.expectedHz.toFixed(1)} Hz, ` +
      `dominant ${top.hz.toFixed(1)} Hz, error ${(error * 100).toFixed(3)}%, ${margin}`,
  );
}
process.exit(failed ? 1 : 0);
