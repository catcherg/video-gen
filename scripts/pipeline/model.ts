// The one place that talks to Claude. Everything else depends only on the ModelClient interface,
// so the whole pipeline can be tested with scripted answers and without spending money.
import Anthropic from "@anthropic-ai/sdk";
import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export const MODEL = "claude-opus-5-5";
const MAX_TOKENS = 64000;
/** Web tools can pause a long turn; each resume continues the same turn. */
const MAX_PAUSE_RESUMES = 8;
const MAX_WEB_SEARCHES = 10;

// Claude API list prices, in dollars per million tokens, as of October 2026. Check against the live pricing page.
const PRICES = { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 };
const USD_PER_WEB_SEARCH = 0.01;

export type Usage = { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number; webSearches: number };

export const costOf = (u: Usage) => (u.inputTokens * PRICES.input + u.outputTokens * PRICES.output + u.cacheReadTokens * PRICES.cacheRead + u.cacheWriteTokens * PRICES.cacheWrite) / 1e6 + u.webSearches * USD_PER_WEB_SEARCH;

export type Upload = { name: string; mediaType: "application/pdf" | "text/plain"; data: string };

export type Turn = { role: "user"; text: string } | { role: "assistant"; content: unknown };

export type ModelRequest = {
  /** Instructions that are the same on every call of this stage. */
  system: string;
  /** Long, stable reference text, cached between calls. */
  reference?: string;
  uploads?: Upload[];
  turns: Turn[];
  schema: Record<string, unknown>;
  webSearch?: boolean;
  effort: "medium" | "high" | "xhigh";
};

export type ModelResult = {
  json: unknown;
  usage: Usage;
  /** Pass back as an assistant turn when retrying. */
  content: unknown;
  /** Every URL a web search actually returned in this call. */
  seenUrls: string[];
  /** The engine's own figure for what this call is worth, when it reports one. */
  costUsd?: number;
};

export interface ModelClient {
  ask(request: ModelRequest): Promise<ModelResult>;
}

export const CREDENTIALS_PATH = path.join(os.homedir(), ".config", "video-gen", "credentials.json");

/** Each person uses their own key: from the environment, or the file `npm run set-key` writes outside the repository. */
const storedKey = () => {
  if (process.env.ANTHROPIC_API_KEY || !existsSync(CREDENTIALS_PATH)) return undefined;
  return (JSON.parse(readFileSync(CREDENTIALS_PATH, "utf8")) as { apiKey?: string }).apiKey;
};

const messageParams = (request: ModelRequest): Anthropic.Beta.BetaMessageParam[] => {
  const documents = (request.uploads ?? []).map(
    (u): Anthropic.Beta.BetaContentBlockParam => ({
      type: "document",
      title: u.name,
      source: u.mediaType === "application/pdf" ? { type: "base64", media_type: "application/pdf", data: u.data } : { type: "text", media_type: "text/plain", data: u.data },
    }),
  );
  return request.turns.map((turn, i) => {
    if (turn.role === "assistant") return { role: "assistant", content: turn.content as Anthropic.Beta.BetaContentBlockParam[] };
    return { role: "user", content: i === 0 ? [...documents, { type: "text", text: turn.text }] : turn.text };
  });
};

export const createAnthropicClient = (): ModelClient => {
  const key = storedKey();
  const client = key ? new Anthropic({ apiKey: key }) : new Anthropic();
  return {
    ask: async (request) => {
      const system: Anthropic.Beta.BetaTextBlockParam[] = [{ type: "text", text: request.system }];
      if (request.reference) system.push({ type: "text", text: request.reference, cache_control: { type: "ephemeral" } });
      const messages = messageParams(request);
      const usage: Usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, webSearches: 0 };
      const seenUrls = new Set<string>();

      for (let resumes = 0; resumes <= MAX_PAUSE_RESUMES; resumes++) {
        const message = await client.beta.messages
          .stream({
            model: MODEL,
            max_tokens: MAX_TOKENS,
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default",
            system,
            messages,
            tools: request.webSearch ? [{ type: "web_search_20260209", name: "web_search", max_uses: MAX_WEB_SEARCHES }] : undefined,
            output_config: { effort: request.effort, format: { type: "json_schema", schema: request.schema } },
          })
          .finalMessage();

        usage.inputTokens += message.usage.input_tokens;
        usage.outputTokens += message.usage.output_tokens;
        usage.cacheReadTokens += message.usage.cache_read_input_tokens ?? 0;
        usage.cacheWriteTokens += message.usage.cache_creation_input_tokens ?? 0;
        usage.webSearches += message.usage.server_tool_use?.web_search_requests ?? 0;
        for (const block of message.content) {
          if (block.type === "web_search_tool_result" && Array.isArray(block.content)) for (const r of block.content) seenUrls.add(r.url);
        }

        if (message.stop_reason === "pause_turn") {
          messages.push({ role: "assistant", content: message.content as Anthropic.Beta.BetaContentBlockParam[] });
          continue;
        }
        if (message.stop_reason === "refusal") throw new Error(`The model declined this request (${message.stop_details?.category ?? "no category given"}).`);
        if (message.stop_reason === "max_tokens") throw new Error("The model's answer was cut off at its length limit.");
        const text = message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
        return { json: JSON.parse(text), usage, content: message.content, seenUrls: [...seenUrls] };
      }
      throw new Error("The model paused too many times without finishing.");
    },
  };
};

/** Answers from a list in order, for tests and offline dry runs. */
export const createScriptedClient = (answers: unknown[], usage: Usage = { inputTokens: 1000, outputTokens: 500, cacheReadTokens: 0, cacheWriteTokens: 0, webSearches: 0 }, seenUrls: string[] = []): ModelClient & { requests: ModelRequest[] } => {
  const requests: ModelRequest[] = [];
  return {
    requests,
    ask: async (request) => {
      requests.push(request);
      if (requests.length > answers.length) throw new Error(`The script has only ${answers.length} answers`);
      return { json: answers[requests.length - 1], usage, content: [{ type: "text", text: "scripted" }], seenUrls };
    },
  };
};
