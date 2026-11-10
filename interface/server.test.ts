import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isApiKey, saveApiKey } from "./connection";
import { cleanUploadName, isLocalHost, isLocalOrigin, parseRange, slugFromBrief } from "./guard";
import { createRuns, descendants, type Launch } from "./runs";
import { createHandler } from "./server";
import { loadState, newState, pipelineDir, saveState } from "../scripts/pipeline/state";

const FAKE_KEY = "sk-ant-placeholder-for-this-test";

describe("guards", () => {
  it("accepts only this computer's own names for the host and origin", () => {
    expect(isLocalHost("localhost:4646", 4646)).toBe(true);
    expect(isLocalHost("127.0.0.1:4646", 4646)).toBe(true);
    expect(isLocalHost("evil.example:4646", 4646)).toBe(false);
    expect(isLocalHost("localhost:9999", 4646)).toBe(false);
    expect(isLocalHost(undefined, 4646)).toBe(false);
    expect(isLocalOrigin("http://localhost:4646", 4646)).toBe(true);
    expect(isLocalOrigin("https://evil.example", 4646)).toBe(false);
    expect(isLocalOrigin("null", 4646)).toBe(false);
    expect(isLocalOrigin(undefined, 4646)).toBe(false);
  });

  it("makes a safe, unique slug from any description", () => {
    const none = () => false;
    expect(slugFromBrief("How a black hole bends light", none)).toBe("how-a-black-hole-bends-light");
    expect(slugFromBrief("../../etc/passwd", none)).toBe("etc-passwd");
    expect(slugFromBrief("1918 flu", none)).toBe("video-1918-flu");
    expect(slugFromBrief("🌋🌋", none)).toBe("video");
    expect(slugFromBrief("Crème brûlée", none)).toBe("cre-me-bru-le-e");
    expect(slugFromBrief("registry", none)).toBe("registry-2");
    expect(slugFromBrief("cats", (s) => s === "cats" || s === "cats-2")).toBe("cats-3");
  });

  it("keeps upload names inside their folder and to readable types", () => {
    expect(cleanUploadName("../../secret/notes.txt")).toBe("notes.txt");
    expect(cleanUploadName("C:\\Users\\me\\notes.md")).toBe("notes.md");
    expect(cleanUploadName(".hidden.txt")).toBe("hidden.txt");
    expect(cleanUploadName("run.sh")).toBeUndefined();
    expect(cleanUploadName("spec.tsx")).toBeUndefined();
  });

  it("parses media ranges and refuses impossible ones", () => {
    expect(parseRange("bytes=0-99", 1000)).toEqual({ start: 0, end: 99 });
    expect(parseRange("bytes=900-", 1000)).toEqual({ start: 900, end: 999 });
    expect(parseRange("bytes=-100", 1000)).toEqual({ start: 900, end: 999 });
    expect(parseRange("bytes=0-5000", 1000)).toEqual({ start: 0, end: 999 });
    expect(parseRange("bytes=2000-", 1000)).toBeUndefined();
    expect(parseRange("nonsense", 1000)).toBeUndefined();
  });

  it("finds every process under a run, however deep", () => {
    expect(descendants("  10 1\n  20 10\n  30 20\n  40 1\n  50 30\n", 10).sort()).toEqual([20, 30, 50]);
    expect(descendants("  10 1\n", 99)).toEqual([]);
  });

  it("stores a key readable only by this account", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "key-"));
    const file = path.join(dir, "nested/credentials.json");
    expect(isApiKey(FAKE_KEY)).toBe(true);
    expect(isApiKey("hello")).toBe(false);
    expect(isApiKey(undefined)).toBe(false);
    saveApiKey(FAKE_KEY, file);
    expect(statSync(file).mode & 0o777).toBe(0o600);
    rmSync(dir, { recursive: true });
  });
});

describe("server", () => {
  let root: string;
  let server: Server;
  let port: number;
  let launches: string[][];
  let finish: (code: number) => void;
  let stops: number;
  const saved: string[] = [];

  const launch: Launch = (args, _log, onExit) => {
    launches.push(args);
    finish = (code) => onExit(code);
    return () => {
      stops += 1;
      onExit(null);
    };
  };

  const base = () => `http://localhost:${port}`;
  const post = (url: string, body: unknown = {}, headers: Record<string, string> = {}) => fetch(`${base()}${url}`, { method: "POST", headers: { "Content-Type": "application/json", Origin: base(), ...headers }, body: JSON.stringify(body) });
  const start = (over: object = {}) => post("/api/videos", { brief: "How a black hole bends light", engine: "claude-code", ...over });

  beforeEach(async () => {
    root = mkdtempSync(path.join(os.tmpdir(), "interface-"));
    mkdirSync(path.join(root, "videos"));
    launches = [];
    stops = 0;
    saved.length = 0;
    const runs = createRuns({ root, launch });
    server = createServer(
      createHandler({
        root,
        port: () => port,
        runs,
        page: { html: "<html>page</html>", js: "", css: "" },
        plan: async () => "signed-in",
        hasKey: () => false,
        saveKey: (key) => saved.push(key),
        isKey: isApiKey,
        signIn: () => {},
        graphics: () => ({ state: "ready", mode: "gpu" }),
      }),
    );
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    port = (server.address() as AddressInfo).port;
  });

  afterEach(async () => {
    await new Promise((resolve) => server.close(resolve));
    rmSync(root, { recursive: true });
  });

  it("refuses a request sent under another website's name", async () => {
    const http = await import("node:http");
    const status = await new Promise((resolve) => http.get({ port, host: "127.0.0.1", path: "/api/setup", headers: { Host: "evil.example" } }, (res) => resolve(res.statusCode)));
    expect(status).toBe(403);
  });

  it("refuses changes from other websites and from plain forms", async () => {
    expect((await post("/api/videos", {}, { Origin: "https://evil.example" })).status).toBe(403);
    expect((await post("/api/setup/key", { key: FAKE_KEY }, { Origin: "https://evil.example" })).status).toBe(403);
    expect((await fetch(`${base()}/api/videos`, { method: "POST", headers: { "Content-Type": "text/plain", Origin: base() }, body: "{}" })).status).toBe(403);
    expect(saved).toEqual([]);
    expect(launches).toEqual([]);
  });

  it("sends a strict page policy", async () => {
    const response = await fetch(`${base()}/`);
    expect(response.headers.get("content-security-policy")).toContain("default-src 'none'");
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("saves a key and never gives it back", async () => {
    expect((await post("/api/setup/key", { key: "not a key" })).status).toBe(400);
    const response = await post("/api/setup/key", { key: FAKE_KEY });
    expect(response.status).toBe(200);
    expect(saved).toEqual([FAKE_KEY]);
    expect(await response.text()).not.toContain(FAKE_KEY);
    expect(await (await fetch(`${base()}/api/setup`)).text()).not.toContain(FAKE_KEY);
  });

  it("serves only known media files", async () => {
    const output = path.join(root, "videos/cats/output");
    mkdirSync(path.join(output, "pipeline"), { recursive: true });
    writeFileSync(path.join(output, "audio.wav"), "0123456789");
    writeFileSync(path.join(output, "pipeline/state.json"), "{}");
    expect((await fetch(`${base()}/media/cats/audio.wav`)).status).toBe(200);
    expect((await fetch(`${base()}/media/cats/state.json`)).status).toBe(404);
    expect((await fetch(`${base()}/media/cats/..%2Fpipeline%2Fstate.json`)).status).toBe(404);
    expect((await fetch(`${base()}/media/..%2F..%2Fetc/audio.wav`)).status).toBe(404);
    const partial = await fetch(`${base()}/media/cats/audio.wav`, { headers: { Range: "bytes=2-4" } });
    expect(partial.status).toBe(206);
    expect(await partial.text()).toBe("234");
  });

  it("starts a run with its uploads and the chosen engine", async () => {
    const data = Buffer.from("Notes about gravity").toString("base64");
    const response = await start({ uploads: [{ name: "../../notes.txt", data }] });
    expect(response.status).toBe(200);
    const { slug } = (await response.json()) as { slug: string };
    expect(slug).toBe("how-a-black-hole-bends-light");
    expect(launches).toEqual([[slug]]);
    const state = loadState(root, slug);
    expect(state?.engine).toBe("claude-code");
    expect(state?.uploads).toEqual(["notes.txt"]);
    expect(readFileSync(path.join(pipelineDir(root, slug), "uploads/notes.txt"), "utf8")).toBe("Notes about gravity");
  });

  it("refuses bad descriptions, file types and a PDF on the plan engine", async () => {
    expect((await start({ brief: "short" })).status).toBe(400);
    expect((await start({ uploads: [{ name: "run.sh", data: "" }] })).status).toBe(400);
    expect((await start({ uploads: [{ name: "a.pdf", data: "" }] })).status).toBe(400);
    expect((await start({ engine: "api" })).status).toBe(400);
    expect(launches).toEqual([]);
  });

  it("runs one video at a time", async () => {
    await start();
    expect((await start({ brief: "A second video about something else" })).status).toBe(409);
    finish(0);
    expect((await start({ brief: "A second video about something else" })).status).toBe(200);
    expect(launches).toHaveLength(2);
  });

  it("passes approvals and notes to the pipeline, and only valid ones", async () => {
    const state = newState("cats", "Why cats purr", [], 10);
    state.completed.facts = true;
    mkdirSync(path.join(root, "videos/cats"), { recursive: true });
    saveState(root, state);
    writeFileSync(path.join(pipelineDir(root, "cats"), "facts.json"), JSON.stringify([{ id: "a", claim: "A", value: 1, confidence: "secondary", sources: [] }]));

    const view = (await (await fetch(`${base()}/api/videos/cats`)).json()) as { phase: string; gate: string; facts: unknown[] };
    expect(view.phase).toBe("waiting");
    expect(view.gate).toBe("facts");
    expect(view.facts).toHaveLength(1);

    expect((await post("/api/videos/cats/approve", { gate: "song" })).status).toBe(400);
    expect((await post("/api/videos/cats/approve", { gate: "facts" })).status).toBe(200);
    finish(0);
    expect((await post("/api/videos/cats/revise", { stage: "nope" })).status).toBe(400);
    expect((await post("/api/videos/cats/revise", { stage: "facts", note: "Use a newer study" })).status).toBe(200);
    expect(launches).toEqual([["cats", "--approve", "facts"], ["cats", "--revise", "facts", "--note", "Use a newer study"]]);
  });

  it("stops a run on request and reports it as paused, not failed", async () => {
    const state = newState("cats", "Why cats purr", [], 10);
    mkdirSync(path.join(root, "videos/cats"), { recursive: true });
    saveState(root, state);
    await post("/api/videos/cats/continue");
    expect(((await (await fetch(`${base()}/api/videos/cats`)).json()) as { phase: string }).phase).toBe("working");
    await post("/api/videos/cats/stop");
    expect(stops).toBe(1);
    const view = (await (await fetch(`${base()}/api/videos/cats`)).json()) as { phase: string; failure?: string };
    expect(view.phase).toBe("paused");
    expect(view.failure).toBeUndefined();
  });

  it("explains a run that ended early", async () => {
    const state = newState("cats", "Why cats purr", [], 10);
    mkdirSync(path.join(root, "videos/cats"), { recursive: true });
    saveState(root, state);
    writeFileSync(path.join(pipelineDir(root, "cats"), "run.log"), "Claude Code wasn't found.\n");
    await post("/api/videos/cats/continue");
    finish(1);
    expect(((await (await fetch(`${base()}/api/videos/cats`)).json()) as { failure: string }).failure).toContain("wasn't found");
  });
});
