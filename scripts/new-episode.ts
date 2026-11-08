// Scaffolds src/episodes/<slug> from templates/episode and registers it.
// Usage: npm run new-episode <slug> [-- --title "Episode title"]
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ROOT } from "./lib/episode";

const USAGE = 'npm run new-episode <slug> [-- --title "Episode title"]';
const SLUG = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const RESERVED = new Set(["parts-gallery"]);
const IMPORT_MARK = "// new-episode: imports";
const ENTRY_MARK = "  // new-episode: entries";

const fail = (message: string): never => {
  console.error(message);
  process.exit(2);
};

const args = process.argv.slice(2);
const titleFlag = args.indexOf("--title");
const title = titleFlag >= 0 ? args[titleFlag + 1] : undefined;
if (titleFlag >= 0 && !title) fail(`Usage: ${USAGE}`);
const slug = args.find((a, i) => !a.startsWith("--") && (titleFlag < 0 || i !== titleFlag + 1));
if (!slug) fail(`Usage: ${USAGE}`);
const safeSlug = slug as string;
if (!SLUG.test(safeSlug)) fail(`Bad slug "${safeSlug}". Use lowercase letters, digits and hyphens, starting with a letter.`);
if (RESERVED.has(safeSlug)) fail(`"${safeSlug}" is reserved.`);

const target = path.join(ROOT, "src/episodes", safeSlug);
if (existsSync(target)) fail(`src/episodes/${safeSlug} already exists.`);

const registryPath = path.join(ROOT, "src/episodes/registry.ts");
const registry = readFileSync(registryPath, "utf8");
if (!registry.includes(IMPORT_MARK) || !registry.includes(ENTRY_MARK)) fail("registry.ts is missing its new-episode markers.");

const words = safeSlug.split("-");
const titleText = title ?? words.map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
const identifier = words[0] + words.slice(1).map((w) => w[0].toUpperCase() + w.slice(1)).join("");

const templateDir = path.join(ROOT, "templates/episode");
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

console.log(`Created src/episodes/${safeSlug} and registered it.`);
console.log("Next: replace the TODOs in physics.ts (with sources), timeline.ts and scene.tsx, then run:");
console.log(`  npm test && npm run stills ${safeSlug} 15 150 750`);
