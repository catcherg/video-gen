// Synthesizes public/<slug>/audio.wav from the episode's physics. Usage: npm run audio <slug>
import { requireSlug, writeEpisodeAudio } from "./lib/episode";

await writeEpisodeAudio(requireSlug(process.argv[2], "npm run audio <slug>"));
