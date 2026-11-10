// `npm start`: builds the page, starts the server on this computer only, and prompts the person to open it.
import { spawn } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { createServer, type Server } from "node:http";
import path from "node:path";
import { createInterface } from "node:readline";
import { build } from "esbuild";
import { hasStoredKey, isApiKey, planStatus, saveApiKey, startSignIn } from "./connection";
import { createRuns, launchGenerate } from "./runs";
import { createHandler } from "./server";
import type { Graphics, Setup } from "./types";

const ROOT = path.resolve(import.meta.dirname, "..");
const FIRST_PORT = 4646;
const LAST_PORT = 4666;
const PLAN_CACHE_MS = 5000;

/** Remotion reaches each video's audio through this link. A zip download or a Windows checkout can lose it. */
const ensureVideosLink = () => {
  const link = path.join(ROOT, "public/videos");
  const isLink = existsSync(link) && (lstatSync(link).isSymbolicLink() || lstatSync(link).isDirectory());
  if (isLink) return;
  rmSync(link, { force: true });
  symlinkSync(path.join(ROOT, "videos"), link, process.platform === "win32" ? "junction" : "dir");
};

const buildPage = async () => {
  const result = await build({
    entryPoints: { app: path.join(import.meta.dirname, "page/main.tsx"), styles: path.join(import.meta.dirname, "page/styles.css") },
    bundle: true,
    write: false,
    outdir: "/page",
    minify: true,
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
    external: ["/fonts/*"],
    logLevel: "error",
  });
  const output = (suffix: string) => result.outputFiles.find((f) => f.path.endsWith(suffix))?.text ?? "";
  return { html: readFileSync(path.join(import.meta.dirname, "page/index.html"), "utf8"), js: output("app.js"), css: output("styles.css") };
};

const savedGraphics = (): Graphics | undefined => {
  try {
    const saved = JSON.parse(readFileSync(path.join(ROOT, "out/graphics.json"), "utf8")) as { platform: string; mode: "gpu" | "software" };
    return saved.platform === process.platform ? { state: "ready", mode: saved.mode } : undefined;
  } catch {
    return undefined;
  }
};

const checkGraphics = (done: (result: Graphics) => void) => {
  const child = spawn(process.execPath, ["--import", "tsx", "interface/check-graphics.ts"], { cwd: ROOT, stdio: ["ignore", "pipe", "inherit"] });
  let stdout = "";
  child.stdout.on("data", (d: Buffer) => (stdout += d.toString("utf8")));
  child.on("close", () => {
    try {
      done(JSON.parse(stdout) as Graphics);
    } catch {
      done({ state: "failed", message: "The graphics check crashed." });
    }
  });
};

const listen = (server: Server, port: number) =>
  new Promise<number>((resolve, reject) => {
    const onError = (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE" && port < LAST_PORT) resolve(listen(server, port + 1));
      else reject(err);
    };
    server.once("error", onError);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", onError);
      resolve(port);
    });
  });

const openInBrowser = (url: string) => {
  const [command, args] = process.platform === "darwin" ? ["open", [url]] : process.platform === "win32" ? ["cmd", ["/c", "start", "", url]] : ["xdg-open", [url]];
  spawn(command as string, args as string[], { stdio: "ignore", detached: true }).unref();
};

mkdirSync(path.join(ROOT, "out"), { recursive: true });
ensureVideosLink();

const runs = createRuns({ root: ROOT, launch: launchGenerate(ROOT), fixture: process.env.VIDEO_GEN_FIXTURE });
let graphics: Graphics = savedGraphics() ?? { state: "checking" };
if (graphics.state === "checking") checkGraphics((result) => (graphics = result));

let planCache: { at: number; value: Setup["plan"] } | undefined;
const plan = async () => {
  if (planCache && Date.now() - planCache.at < PLAN_CACHE_MS) return planCache.value;
  planCache = { at: Date.now(), value: await planStatus() };
  return planCache.value;
};

let port = FIRST_PORT;
const server = createServer(
  createHandler({ root: ROOT, port: () => port, runs, page: await buildPage(), plan, hasKey: hasStoredKey, saveKey: saveApiKey, isKey: isApiKey, signIn: startSignIn, graphics: () => graphics }),
);
port = await listen(server, FIRST_PORT);

const url = `http://localhost:${port}`;
console.log(`\n  Video Gen is running on this computer.\n\n  Open this page:  ${url}\n`);
if (process.stdin.isTTY) {
  console.log("  Press Enter to open it in your browser. Close this window to stop Video Gen.\n");
  createInterface({ input: process.stdin }).once("line", () => openInBrowser(url));
}

const shutdown = () => {
  runs.stopAll();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
process.on("SIGHUP", shutdown);
