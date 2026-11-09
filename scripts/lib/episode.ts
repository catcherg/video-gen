import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { encodeWav, type EpisodeAudio } from "../../src/core/audio";
import type { EpisodeMeta, ToneCheck } from "../../src/core/episode";
import { planSong, type SongPlan } from "../../src/core/music/plan";
import { renderSong } from "../../src/core/music/render";
import { loadSpec, specSongRequest } from "../../src/core/spec";

export const ROOT = path.resolve(import.meta.dirname, "../..");

/** Everything about one video lives here, with its generated files in output/. */
export const videoDir = (slug: string) => path.join(ROOT, "videos", slug);
export const outputDir = (slug: string) => path.join(videoDir(slug), "output");

const load = async <T>(slug: string, file: string): Promise<T> =>
  (await import(pathToFileURL(path.join(videoDir(slug), file)).href)) as T;

/** Exits with a clear message unless <slug> is an existing episode. */
export const requireSlug = (arg: string | undefined, usage: string): string => {
  if (!arg) {
    console.error(`Usage: ${usage}`);
    process.exit(2);
  }
  if (!existsSync(path.join(videoDir(arg), "meta.ts"))) {
    console.error(`No video at videos/${arg}`);
    process.exit(2);
  }
  return arg;
};

export const loadMeta = async (slug: string) => (await load<{ meta: EpisodeMeta }>(slug, "meta.ts")).meta;
/** Videos without a physics file have no tone to check. */
export const loadToneChecks = async (slug: string): Promise<ToneCheck[]> =>
  existsSync(path.join(videoDir(slug), "physics.ts")) ? ((await load<{ toneChecks?: ToneCheck[] }>(slug, "physics.ts")).toneChecks ?? []) : [];

export const audioPath = (slug: string) => path.join(outputDir(slug), "audio.wav");

/** The planned song, for a video whose spec generates one. */
export const loadSongPlan = (slug: string): SongPlan | undefined => {
  const file = path.join(videoDir(slug), "spec.json");
  if (!existsSync(file)) return undefined;
  const spec = loadSpec(JSON.parse(readFileSync(file, "utf8")));
  return spec.song.generator ? planSong(specSongRequest(spec)) : undefined;
};

export const writeEpisodeAudio = async (slug: string) => {
  const plan = loadSongPlan(slug);
  if (!plan && !existsSync(path.join(videoDir(slug), "audio.ts"))) {
    console.error(`videos/${slug} has no audio.ts and no song generator in its spec.`);
    process.exit(2);
  }
  const rendered = plan ? renderSong(plan) : (await load<{ default: EpisodeAudio }>(slug, "audio.ts")).default.render();
  const out = audioPath(slug);
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, encodeWav(rendered));
  console.log(`wrote ${path.relative(ROOT, out)}: ${rendered.summary}`);
};
