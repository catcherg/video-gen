// Runs the model through the local `claude` command, so a Claude plan can be used instead of API credit.
// The command gets no file or shell tools and runs in an empty folder: only web search, and only when a stage asks for it.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { MODEL, type ModelClient, type ModelRequest, type ModelResult, type Usage } from "./model";

const TIMEOUT_MS = 30 * 60 * 1000;
const WORK_DIR = path.join(os.tmpdir(), "video-gen-model");

/** Removed so the command signs in with the person's own plan, whatever launched this process. */
const STRIPPED_ENV = ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_BASE_URL", "CLAUDECODE", "CLAUDE_CODE_ENTRYPOINT", "CLAUDE_CODE_OAUTH_TOKEN", "CLAUDE_CODE_SESSION_ACCESS_TOKEN"];

/** The environment for the `claude` command, without anything that would override the person's own sign-in. */
export const claudeEnv = () => {
  const env = { ...process.env };
  for (const name of STRIPPED_ENV) delete env[name];
  return env;
};

export const findClaudeBinary = (): string => {
  if (process.env.CLAUDE_BIN) return process.env.CLAUDE_BIN;
  for (const dir of (process.env.PATH ?? "").split(path.delimiter)) {
    const candidate = path.join(dir, process.platform === "win32" ? "claude.exe" : "claude");
    if (existsSync(candidate)) return candidate;
  }
  const appRoot = path.join(os.homedir(), "Library/Application Support/Claude/claude-code");
  if (existsSync(appRoot)) {
    for (const version of readdirSync(appRoot).sort().reverse()) {
      for (const build of readdirSync(path.join(appRoot, version))) {
        const candidate = path.join(appRoot, version, build, "claude.app/Contents/MacOS/claude");
        if (existsSync(candidate)) return candidate;
      }
    }
  }
  throw new Error("Claude Code wasn't found. Install it, or set CLAUDE_BIN to the path of the claude command.");
};

type StreamEvent = {
  type?: string;
  subtype?: string;
  is_error?: boolean;
  result?: string;
  errors?: unknown[];
  session_id?: string;
  total_cost_usd?: number;
  structured_output?: unknown;
  usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number };
  tool_use_result?: { results?: unknown[]; searchCount?: number } | string;
};

/** Reads the command's event stream into a result, collecting every URL its searches really returned. */
export const parseClaudeStream = (lines: string[]): ModelResult & { costUsd: number } => {
  const events = lines.filter((l) => l.trim().startsWith("{")).map((l) => JSON.parse(l) as StreamEvent);
  const seenUrls = new Set<string>();
  let webSearches = 0;
  for (const e of events) {
    const tool = e.tool_use_result;
    if (typeof tool !== "object" || tool === null || !Array.isArray(tool.results)) continue;
    webSearches += tool.searchCount ?? 1;
    for (const result of tool.results) {
      const content = typeof result === "object" && result !== null ? (result as { content?: unknown }).content : undefined;
      if (Array.isArray(content)) for (const item of content as { url?: unknown }[]) if (typeof item?.url === "string") seenUrls.add(item.url);
    }
  }
  const final = [...events].reverse().find((e) => e.type === "result");
  if (!final) throw new Error("Claude Code ended without giving a result.");
  if (final.is_error || final.structured_output === undefined) throw new Error(`Claude Code failed (${final.subtype ?? "unknown"}): ${final.result ?? JSON.stringify(final.errors ?? "no details")}`.slice(0, 600));
  const u = final.usage ?? {};
  const usage: Usage = { inputTokens: u.input_tokens ?? 0, outputTokens: u.output_tokens ?? 0, cacheReadTokens: u.cache_read_input_tokens ?? 0, cacheWriteTokens: u.cache_creation_input_tokens ?? 0, webSearches };
  return { json: final.structured_output, usage, content: { sessionId: final.session_id }, seenUrls: [...seenUrls], costUsd: final.total_cost_usd ?? 0 };
};

/** Builds the text to send: the new message, with any uploads included as clearly marked data on the first turn. */
export const buildPrompt = (request: ModelRequest) => {
  const lastUser = [...request.turns].reverse().find((t) => t.role === "user");
  if (!lastUser || lastUser.role !== "user") throw new Error("A request needs a user message.");
  const resumeFrom = [...request.turns].reverse().find((t) => t.role === "assistant");
  if (resumeFrom && resumeFrom.role === "assistant") return { text: lastUser.text, sessionId: (resumeFrom.content as { sessionId?: string }).sessionId };
  const pdf = request.uploads?.find((u) => u.mediaType === "application/pdf");
  if (pdf) throw new Error(`"${pdf.name}" is a PDF. PDF uploads need the API engine for now, or paste the text into a .txt file.`);
  const documents = (request.uploads ?? []).map((u) => `<document title=${JSON.stringify(u.name)}>\n${u.data}\n</document>`).join("\n");
  return { text: documents ? `${documents}\n\n${lastUser.text}` : lastUser.text, sessionId: undefined };
};

const runClaude = (binary: string, args: string[], input: string) =>
  new Promise<string[]>((resolve, reject) => {
    const child = spawn(binary, args, { cwd: WORK_DIR, env: claudeEnv(), stdio: ["pipe", "pipe", "pipe"] });
    const timer = setTimeout(() => child.kill(), TIMEOUT_MS);
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d: Buffer) => (stdout += d.toString("utf8")));
    child.stderr.on("data", (d: Buffer) => (stderr += d.toString("utf8")));
    child.on("error", reject);
    child.on("close", () => {
      clearTimeout(timer);
      if (!stdout.includes('"type":"result"')) reject(new Error(`Claude Code stopped early: ${stderr.slice(-500)}`));
      else resolve(stdout.split("\n"));
    });
    child.stdin.end(input);
  });

export const createClaudeCodeClient = (binary = findClaudeBinary()): ModelClient => ({
  ask: async (request) => {
    mkdirSync(WORK_DIR, { recursive: true });
    const { text, sessionId } = buildPrompt(request);
    const promptDir = mkdtempSync(path.join(os.tmpdir(), "video-gen-prompt-"));
    const systemFile = path.join(promptDir, "system.txt");
    writeFileSync(systemFile, request.reference ? `${request.system}\n\n${request.reference}` : request.system);
    const tools = request.webSearch ? "WebSearch" : "";
    const args = ["-p", "--output-format", "stream-json", "--verbose", "--model", MODEL, "--effort", request.effort, "--tools", tools, "--setting-sources", "", "--strict-mcp-config", "--system-prompt-file", systemFile, "--json-schema", JSON.stringify(request.schema)];
    if (request.webSearch) args.push("--allowedTools", "WebSearch");
    if (sessionId) args.push("--resume", sessionId);
    try {
      return parseClaudeStream(await runClaude(binary, args, text));
    } finally {
      rmSync(promptDir, { recursive: true, force: true });
    }
  },
});
