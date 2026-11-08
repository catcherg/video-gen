import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { encodeWav, type EpisodeAudio } from "../../src/core/audio";
import type { EpisodeMeta, ToneCheck } from "../../src/core/episode";

export const ROOT = path.resolve(import.meta.dirname, "../..");

const load = async <T>(slug: string, file: string): Promise<T> =>
  (await import(pathToFileURL(path.join(ROOT, "src/episodes", slug, file)).href)) as T;

/** Exits with a clear message unless <slug> is an existing episode. */
export const requireSlug = (arg: string | undefined, usage: string): string => {
  if (!arg) {
    console.error(`Usage: ${usage}`);
    process.exit(2);
  }
  if (!existsSync(path.join(ROOT, "src/episodes", arg, "meta.ts"))) {
    console.error(`No episode at src/episodes/${arg}`);
    process.exit(2);
  }
  return arg;
};

export const loadMeta = async (slug: string) => (await load<{ meta: EpisodeMeta }>(slug, "meta.ts")).meta;
export const loadToneChecks = async (slug: string) => (await load<{ toneChecks: ToneCheck[] }>(slug, "physics.ts")).toneChecks;

export const audioPath = (slug: string) => path.join(ROOT, "public", slug, "audio.wav");

export const writeEpisodeAudio = async (slug: string) => {
  const { default: audio } = await load<{ default: EpisodeAudio }>(slug, "audio.ts");
  const rendered = audio.render();
  const out = audioPath(slug);
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, encodeWav(rendered));
  console.log(`wrote ${path.relative(ROOT, out)}: ${rendered.summary}`);
};
