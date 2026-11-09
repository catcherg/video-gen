// Synthesizes videos/<slug>/output/audio.wav from the video's audio.ts. Usage: npm run audio <slug>
import { requireSlug, writeEpisodeAudio } from "./lib/episode";

await writeEpisodeAudio(requireSlug(process.argv[2], "npm run audio <slug>"));
