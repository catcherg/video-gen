// Scaffolds videos/<slug> from a template and registers it.
// Usage: npm run new-video <slug> [-- --title "Video title"] [-- --kit engine]
// The default template works for any subject and generates its own song. --kit engine makes an engine video instead.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ROOT, writeVideoAudio } from "./lib/video";

const USAGE = 'npm run new-video <slug> [-- --title "Video title"] [-- --kit engine]';
const SLUG = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const RESERVED = new Set(["parts-gallery", "visual-gallery"]);
const IMPORT_MARK = "// new-video: imports";
const ENTRY_MARK = "  // new-video: entries";
const VALUE_FLAGS = new Set(["--title", "--kit"]);

const fail = (message: string): never => {
  console.error(message);
  process.exit(2);
};

const args = process.argv.slice(2);
const option = (name: string) => {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return undefined;
  if (!args[i + 1]) fail(`Usage: ${USAGE}`);
  return args[i + 1];
};
const title = option("title");
const kit = option("kit");
if (kit && kit !== "engine") fail(`Unknown kit "${kit}". The only kit so far is "engine".`);
const engine = kit === "engine";

const slug = args.find((a, i) => !a.startsWith("--") && !(i > 0 && VALUE_FLAGS.has(args[i - 1])));
if (!slug) fail(`Usage: ${USAGE}`);
const safeSlug = slug as string;
if (!SLUG.test(safeSlug)) fail(`Bad slug "${safeSlug}". Use lowercase letters, digits and hyphens, starting with a letter.`);
if (RESERVED.has(safeSlug)) fail(`"${safeSlug}" is reserved.`);

const target = path.join(ROOT, "videos", safeSlug);
if (existsSync(target)) fail(`videos/${safeSlug} already exists.`);

const registryPath = path.join(ROOT, "videos/registry.ts");
const registry = readFileSync(registryPath, "utf8");
if (!registry.includes(IMPORT_MARK) || !registry.includes(ENTRY_MARK)) fail("registry.ts is missing its new-video markers.");

const words = safeSlug.split("-");
const titleText = title ?? words.map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
const identifier = words[0] + words.slice(1).map((w) => w[0].toUpperCase() + w.slice(1)).join("");

const templateDir = path.join(ROOT, engine ? "templates/engine" : "templates/video");
mkdirSync(target, { recursive: true });
for (const file of readdirSync(templateDir)) {
  const body = readFileSync(path.join(templateDir, file), "utf8")
    .replaceAll("__SLUG__", safeSlug)
    .replaceAll("__TITLE__", titleText.replaceAll('"', '\\"'));
  writeFileSync(path.join(target, file.replace(/\.tmpl$/, "")), body);
}

writeFileSync(
  registryPath,
  registry
    .replace(IMPORT_MARK, `import { meta as ${identifier} } from "./${safeSlug}/meta";\n${IMPORT_MARK}`)
    .replace(ENTRY_MARK, `  { meta: ${identifier}, load: () => import("./${safeSlug}") },\n${ENTRY_MARK}`),
);

console.log(`Created videos/${safeSlug} and registered it.`);

if (engine) {
  console.log("Next: replace the TODOs in physics.ts (with sources), timeline.ts and scene.tsx, then run:");
  console.log(`  npm test && npm run stills ${safeSlug} 15 150 750`);
  process.exit(0);
}

// A general video's timeline reads the song map, so the song has to exist before the video will compile.
await writeVideoAudio(safeSlug);
const map = spawnSync("npm", ["run", "--silent", "song-map", safeSlug], { cwd: ROOT, stdio: "inherit" });
if (map.status !== 0) process.exit(map.status ?? 1);

console.log("\nNext:");
console.log(`  1. Listen to videos/${safeSlug}/output/audio.wav. Change the seed in spec.json until you like it, then run: npm run audio ${safeSlug} && npm run song-map ${safeSlug}`);
console.log("  2. Replace the TODOs in spec.json with real, sourced facts, then physics.ts, timeline.ts and scene.tsx.");
console.log(`  3. Run: npm run check-video ${safeSlug}`);
