// Synthesizes videos/<slug>/output/audio.wav from the video's audio.ts. Usage: npm run audio <slug>
import { requireSlug, writeVideoAudio } from "./lib/video";

await writeVideoAudio(requireSlug(process.argv[2], "npm run audio <slug>"));
