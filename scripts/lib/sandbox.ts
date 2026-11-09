// Containment for code a person didn't write. Generated code runs in only two places, and each has a real barrier:
//   Node: pre-bundled, then run in a child process with no file writes, network or subprocesses.
//   Browser: a content security policy on the page, and a wrapper that stops the browser resolving outside hosts.
// The static rules in sceneChecks.ts come first, but they can be bypassed, so nothing relies on them alone.
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { ensureBrowser } from "@remotion/renderer";
import { build } from "esbuild";

const RUN_TIMEOUT_MS = 30_000;

/** Removed from every child process, so a credential is never in reach of what those processes run. */
const SECRET_ENV = [/^ANTHROPIC_/, /^CLAUDE_CODE_/, /^CLAUDECODE$/, /_API_KEY$/, /_TOKEN$/, /_SECRET$/, /^AWS_/, /^GH_/, /^GITHUB_/];

export const cleanEnv = (env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv => Object.fromEntries(Object.entries(env).filter(([name]) => !SECRET_ENV.some((p) => p.test(name))));

export type SandboxResult = { ok: true; stdout: string } | { ok: false; error: string };

/**
 * Bundles a script, then runs it with Node's permission system on: it may read its own bundle and nothing else.
 * No file writes, network, subprocesses, workers or native addons, and an empty environment.
 */
export const runInSandbox = async (entrySource: string, resolveDir: string): Promise<SandboxResult> => {
  // The real path, because macOS's temp folder is a symlink and the permission applies to the file itself.
  const dir = path.join(realpathSync(os.tmpdir()), `video-gen-sandbox-${process.pid}-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  const outfile = path.join(dir, "bundle.mjs");
  try {
    await build({ stdin: { contents: entrySource, resolveDir, loader: "ts" }, outfile, bundle: true, platform: "node", format: "esm", jsx: "automatic", logLevel: "silent", banner: { js: 'import{createRequire as __cr}from"node:module";const require=__cr(import.meta.url);' } });
    const result = spawnSync(process.execPath, ["--permission", `--allow-fs-read=${outfile}`, outfile], { encoding: "utf8", env: {}, timeout: RUN_TIMEOUT_MS, cwd: dir, maxBuffer: 16 * 1024 * 1024 });
    if (result.status !== 0) return { ok: false, error: (result.stderr || result.error?.message || "the sandboxed code failed").slice(-1500) };
    return { ok: true, stdout: result.stdout };
  } catch (err) {
    return { ok: false, error: (err as Error).message.slice(-1500) };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

const MARKER = "SANDBOX_RESULT ";

/** Reads a video's captions without giving its code any access to this computer. */
export const readCaptionsSandboxed = async (timelinePath: string): Promise<unknown[]> => {
  const source = `import { CAPTIONS } from ${JSON.stringify(timelinePath)};\nconsole.log(${JSON.stringify(MARKER)} + JSON.stringify(CAPTIONS ?? []));\n`;
  const result = await runInSandbox(source, path.dirname(timelinePath));
  if (!result.ok) throw new Error(`The video's timeline failed to load: ${result.error}`);
  const line = result.stdout.split("\n").reverse().find((l) => l.startsWith(MARKER));
  if (!line) throw new Error("The video's timeline didn't report its captions.");
  return JSON.parse(line.slice(MARKER.length)) as unknown[];
};

/** Everything a page may load must come from the render's own local server. */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:",
  "connect-src 'self' data: blob:",
  "img-src 'self' data: blob:",
  "media-src 'self' data: blob:",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join("; ");

/** Puts the policy first in the page, ahead of every script, so nothing on the page can run before it applies. */
export const applyContentSecurityPolicy = (html: string) => {
  if (!/<head>/i.test(html)) throw new Error("The rendered page has no <head> to secure.");
  return html.replace(/<head>/i, (head) => `${head}<meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}">`);
};

/** Bundles the videos, with the page locked down. Returns what to render from. */
export const secureBundle = async (root: string) => {
  const serveUrl = await bundle({ entryPoint: path.join(root, "src/index.ts"), rootDir: root });
  const indexPath = path.join(serveUrl, "index.html");
  writeFileSync(indexPath, applyContentSecurityPolicy(readFileSync(indexPath, "utf8")));
  return serveUrl;
};

/**
 * A wrapper around the render browser that makes every outside hostname fail to resolve.
 * Remotion has no option for browser flags, so the wrapper adds it. It's a shell script, so Windows gets the page policy only.
 */
export const guardedBrowser = async (root: string): Promise<string | undefined> => {
  if (process.platform === "win32") return undefined;
  const status = await ensureBrowser({ logLevel: "error" });
  if (status.type === "no-browser") throw new Error("The render browser isn't installed.");
  if ("path" in status) process.env.VIDEO_GEN_REAL_BROWSER = status.path;
  return path.join(root, "scripts/lib/guarded-browser.sh");
};
