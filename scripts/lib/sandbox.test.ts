import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { applyContentSecurityPolicy, cleanEnv, CONTENT_SECURITY_POLICY, readCaptionsSandboxed, runInSandbox } from "./sandbox";

const dir = mkdtempSync(path.join(os.tmpdir(), "sandbox-test-"));
const secret = path.join(dir, "secret.txt");
writeFileSync(secret, "TOP SECRET");
afterAll(() => rmSync(dir, { recursive: true }));

/** Runs an attack inside the sandbox and reports whether it worked. */
const attempt = async (attack: string) => {
  const result = await runInSandbox(
    `const g = (() => {}).constructor("return this")();
     const proc = g.process;
     const attack = async () => { ${attack} };
     try { const value = await attack(); console.log("ALLOWED " + JSON.stringify(value)); } catch (e) { console.log("DENIED " + (e.code ?? e.message)); }`,
    dir,
  );
  expect(result.ok, result.ok ? "" : result.error).toBe(true);
  return result.ok ? result.stdout.trim() : "";
};

describe("the Node sandbox stops generated code", () => {
  it("reading files, through a bypass of the static rules", async () => {
    expect(await attempt(`return proc.getBuiltinModule("node:fs").readFileSync(${JSON.stringify(secret)}, "utf8");`)).toContain("DENIED");
  });

  it("reading the saved API key", async () => {
    expect(await attempt(`return proc.getBuiltinModule("node:fs").readFileSync(${JSON.stringify(path.join(os.homedir(), ".config/video-gen/credentials.json"))}, "utf8");`)).toContain("DENIED");
  });

  it("writing files", async () => {
    const target = path.join(dir, "pwned.txt");
    expect(await attempt(`proc.getBuiltinModule("node:fs").writeFileSync(${JSON.stringify(target)}, "x"); return "written";`)).toContain("DENIED");
    expect(existsSync(target)).toBe(false);
  });

  it("starting other programs", async () => {
    expect(await attempt(`return proc.getBuiltinModule("node:child_process").execSync("echo pwned").toString();`)).toContain("DENIED");
  });

  it("opening network connections", async () => {
    expect(await attempt(`return await new Promise((res, rej) => { const s = proc.getBuiltinModule("node:net").connect(80, "127.0.0.1"); s.on("connect", () => res("connected")); s.on("error", rej); });`)).toContain("DENIED");
  });

  it("starting worker threads", async () => {
    expect(await attempt(`const { Worker } = proc.getBuiltinModule("node:worker_threads"); new Worker("0", { eval: true }); return "started";`)).toContain("DENIED");
  });

  it("seeing secrets in the environment", async () => {
    process.env.ANTHROPIC_API_KEY = "placeholder-for-this-test";
    try {
      expect(await attempt(`return Object.keys(proc.env);`)).not.toContain("ANTHROPIC");
    } finally {
      delete process.env.ANTHROPIC_API_KEY;
    }
  });
});

describe("readCaptionsSandboxed", () => {
  const timeline = (body: string) => {
    const file = path.join(dir, `t${Math.random().toString(36).slice(2)}.ts`);
    writeFileSync(file, body);
    return file;
  };

  it("returns a video's captions", async () => {
    expect(await readCaptionsSandboxed(timeline('export const CAPTIONS = [{ from: 0, to: 1, lines: ["HI"] }];'))).toEqual([{ from: 0, to: 1, lines: ["HI"] }]);
  });

  it("isn't confused by output printed before the result", async () => {
    expect(await readCaptionsSandboxed(timeline('console.log("noise"); export const CAPTIONS = [];'))).toEqual([]);
  });

  it("reports code that crashes", async () => {
    await expect(readCaptionsSandboxed(timeline('throw new Error("boom"); export const CAPTIONS = [];'))).rejects.toThrow("boom");
  });

  it("stops code that never finishes", { timeout: 40000 }, async () => {
    await expect(readCaptionsSandboxed(timeline("while (true) {} export const CAPTIONS = [];"))).rejects.toThrow("failed to load");
  });
});

describe("the page policy", () => {
  it("goes first in the head, before any script", () => {
    const html = applyContentSecurityPolicy('<html><head><script src="a.js"></script></head></html>');
    expect(html.indexOf("Content-Security-Policy")).toBeLessThan(html.indexOf("<script"));
  });

  it("refuses a page it can't secure", () => {
    expect(() => applyContentSecurityPolicy("<html></html>")).toThrow("<head>");
  });

  it("allows only the local server to be reached", () => {
    expect(CONTENT_SECURITY_POLICY).toContain("connect-src 'self'");
    expect(CONTENT_SECURITY_POLICY).not.toMatch(/https?:|\*/);
  });
});

describe("cleanEnv", () => {
  it("strips credentials and keeps ordinary settings", () => {
    const env = cleanEnv({ PATH: "/bin", HOME: "/h", ANTHROPIC_API_KEY: "a", ANTHROPIC_AUTH_TOKEN: "b", CLAUDE_CODE_OAUTH_TOKEN: "c", MY_SERVICE_API_KEY: "d", GITHUB_TOKEN: "e", AWS_SECRET_ACCESS_KEY: "f" });
    expect(env).toEqual({ PATH: "/bin", HOME: "/h" });
  });
});

it("the browser guard allows only local hosts", () => {
  const script = readFileSync(path.join(import.meta.dirname, "guarded-browser.sh"), "utf8");
  expect(script).toContain("MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1");
});
