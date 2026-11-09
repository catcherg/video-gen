import { describe, expect, it } from "vitest";
import { buildPrompt, parseClaudeStream } from "./claudeCode";
import type { ModelRequest } from "./model";

const line = (e: unknown) => JSON.stringify(e);
const search = line({ type: "user", tool_use_result: { query: "q", searchCount: 1, results: [{ tool_use_id: "a", content: [{ title: "T", url: "https://example.org/a" }, { title: "U", url: "https://example.org/b" }] }, "commentary"] } });
const done = (over: object = {}) => line({ type: "result", subtype: "success", is_error: false, session_id: "s1", total_cost_usd: 0.04, structured_output: { ok: true }, usage: { input_tokens: 4, output_tokens: 281, cache_read_input_tokens: 1722, cache_creation_input_tokens: 3116 }, ...over });

describe("parseClaudeStream", () => {
  it("returns the structured answer, the usage and the reported cost", () => {
    const r = parseClaudeStream([line({ type: "system", subtype: "init" }), done(), ""]);
    expect(r.json).toEqual({ ok: true });
    expect(r.costUsd).toBe(0.04);
    expect(r.usage).toMatchObject({ inputTokens: 4, outputTokens: 281, cacheReadTokens: 1722, cacheWriteTokens: 3116 });
    expect(r.content).toEqual({ sessionId: "s1" });
  });

  it("collects only the URLs that searches really returned", () => {
    const r = parseClaudeStream([search, line({ type: "assistant", text: "see https://invented.example" }), done()]);
    expect(r.seenUrls).toEqual(["https://example.org/a", "https://example.org/b"]);
    expect(r.usage.webSearches).toBe(1);
  });

  it("ignores tool results that are plain text", () => {
    expect(parseClaudeStream([line({ type: "user", tool_use_result: "Structured output provided" }), done()]).seenUrls).toEqual([]);
  });

  it("throws when the command reports an error or gives no answer", () => {
    expect(() => parseClaudeStream([done({ is_error: true, result: "limit reached" })])).toThrow("limit reached");
    expect(() => parseClaudeStream([done({ structured_output: undefined })])).toThrow("failed");
    expect(() => parseClaudeStream([line({ type: "system" })])).toThrow("without giving a result");
  });
});

const request = (over: Partial<ModelRequest> = {}): ModelRequest => ({ system: "S", turns: [{ role: "user", text: "Question" }], schema: {}, effort: "high", ...over });

describe("buildPrompt", () => {
  it("sends the question on a first turn", () => {
    expect(buildPrompt(request())).toEqual({ text: "Question", sessionId: undefined });
  });

  it("marks text uploads as documents, ahead of the question", () => {
    const { text } = buildPrompt(request({ uploads: [{ name: "a.txt", mediaType: "text/plain", data: "NOTES" }] }));
    expect(text).toContain('<document title="a.txt">\nNOTES\n</document>');
    expect(text.indexOf("NOTES")).toBeLessThan(text.indexOf("Question"));
  });

  it("explains that PDFs need the API engine", () => {
    expect(() => buildPrompt(request({ uploads: [{ name: "a.pdf", mediaType: "application/pdf", data: "x" }] }))).toThrow("PDF");
  });

  it("continues the same session on a retry, sending only the new message", () => {
    const retry = request({ uploads: [{ name: "a.txt", mediaType: "text/plain", data: "NOTES" }], turns: [{ role: "user", text: "Question" }, { role: "assistant", content: { sessionId: "s1" } }, { role: "user", text: "Fix this" }] });
    expect(buildPrompt(retry)).toEqual({ text: "Fix this", sessionId: "s1" });
  });
});
