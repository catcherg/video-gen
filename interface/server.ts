// The local server behind the page. It only ever listens on this computer.
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { loadState, newState, pipelineDir, saveState, STAGES, type Engine, type Gate, type Stage } from "../scripts/pipeline/state";
import { cleanUploadName, isLocalHost, isLocalOrigin, parseRange, SLUG, slugFromBrief } from "./guard";
import { Busy, type Runs } from "./runs";
import type { Graphics, Setup } from "./types";

const MAX_BODY_BYTES = 64 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const MAX_UPLOADS = 10;
const MIN_BRIEF = 10;
const MAX_BRIEF = 2000;
const MAX_NOTE = 2000;
const MAX_USD_LIMIT = 200;
const DEFAULT_MAX_USD = 10;

const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; media-src 'self'; font-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
const SECURITY_HEADERS = { "Content-Security-Policy": CSP, "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "Cross-Origin-Resource-Policy": "same-origin", "Cache-Control": "no-store" };

class BadRequest extends Error {}

export type Page = { html: string; js: string; css: string };

export type AppOptions = {
  root: string;
  port: () => number;
  runs: Runs;
  page: Page;
  plan: () => Promise<Setup["plan"]>;
  hasKey: () => boolean;
  saveKey: (key: string) => void;
  isKey: (key: unknown) => key is string;
  signIn: () => void;
  graphics: () => Graphics;
};

const send = (res: ServerResponse, status: number, type: string, body: string | Buffer) => {
  res.writeHead(status, { ...SECURITY_HEADERS, "Content-Type": type });
  res.end(body);
};
const sendJson = (res: ServerResponse, status: number, value: unknown) => send(res, status, "application/json; charset=utf-8", JSON.stringify(value));

const readBody = (req: IncomingMessage) =>
  new Promise<Record<string, unknown>>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new BadRequest("That's too much to upload at once."));
        req.destroy();
      } else chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error();
        resolve(parsed as Record<string, unknown>);
      } catch {
        reject(new BadRequest("That request couldn't be read."));
      }
    });
    req.on("error", reject);
  });

const FONTS: Record<string, string> = { "vt323.woff2": "vt323.woff2", "silkscreen.woff2": "silkscreen.woff2", "silkscreen-bold.woff2": "silkscreen-bold.woff2" };

/** Maps a public media name to the only files that may be served. Nothing from the request reaches a path unchecked. */
const mediaFile = (root: string, slug: string, name: string) => {
  const output = path.join(root, "videos", slug, "output");
  if (name === "audio.wav") return { file: path.join(output, "audio.wav"), type: "audio/wav" };
  if (name === "video.mp4") return { file: path.join(output, `${slug}.mp4`), type: "video/mp4" };
  if (/^still_\d+\.png$/.test(name)) return { file: path.join(output, "stills", name), type: "image/png" };
  return undefined;
};

const sendFile = (req: IncomingMessage, res: ServerResponse, file: string, type: string, downloadAs?: string) => {
  const { size } = statSync(file);
  const headers: Record<string, string | number> = { ...SECURITY_HEADERS, "Content-Type": type, "Accept-Ranges": "bytes" };
  if (downloadAs) headers["Content-Disposition"] = `attachment; filename="${downloadAs}"`;
  const header = req.headers.range;
  if (header) {
    const range = parseRange(header, size);
    if (!range) {
      res.writeHead(416, { ...SECURITY_HEADERS, "Content-Range": `bytes */${size}` });
      res.end();
      return;
    }
    res.writeHead(206, { ...headers, "Content-Range": `bytes ${range.start}-${range.end}/${size}`, "Content-Length": range.end - range.start + 1 });
    createReadStream(file, range).pipe(res);
    return;
  }
  res.writeHead(200, { ...headers, "Content-Length": size });
  createReadStream(file).pipe(res);
};

const text = (value: unknown, name: string) => {
  if (typeof value !== "string") throw new BadRequest(`${name} is missing.`);
  return value;
};

const limit = (value: unknown) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_USD_LIMIT) throw new BadRequest(`The spending limit must be between $1 and $${MAX_USD_LIMIT}.`);
  return amount;
};

export const createHandler = (options: AppOptions) => {
  const { root, port, runs, page } = options;

  const setup = async (): Promise<Setup> => ({ plan: await options.plan(), hasKey: options.hasKey(), graphics: options.graphics(), runningSlug: runs.runningSlug() });

  const startVideo = async (body: Record<string, unknown>) => {
    const brief = text(body.brief, "A description").trim();
    if (brief.length < MIN_BRIEF) throw new BadRequest("Describe the video in a little more detail.");
    if (brief.length > MAX_BRIEF) throw new BadRequest(`Keep the description under ${MAX_BRIEF} characters. Add longer material as a file.`);
    if (body.engine !== "api" && body.engine !== "claude-code") throw new BadRequest("Choose how to connect to Claude first.");
    const engine: Engine = body.engine;
    if (engine === "claude-code" && (await options.plan()) !== "signed-in") throw new BadRequest("Sign in to your Claude plan first.");
    if (engine === "api" && !options.hasKey()) throw new BadRequest("Add your Claude API key first.");

    const uploads = Array.isArray(body.uploads) ? (body.uploads as { name?: unknown; data?: unknown }[]) : [];
    if (uploads.length > MAX_UPLOADS) throw new BadRequest(`Add at most ${MAX_UPLOADS} files.`);
    const files = new Map<string, Buffer>();
    for (const upload of uploads) {
      const name = cleanUploadName(text(upload.name, "A file name"));
      if (!name) throw new BadRequest(`"${String(upload.name)}" can't be used. Add text, Markdown, CSV or PDF files.`);
      if (engine === "claude-code" && name.toLowerCase().endsWith(".pdf")) throw new BadRequest(`"${name}" is a PDF. PDFs need an API key for now, so paste its text into a .txt file instead.`);
      const bytes = Buffer.from(text(upload.data, "A file"), "base64");
      if (bytes.length > MAX_UPLOAD_BYTES) throw new BadRequest(`"${name}" is larger than 20 MB.`);
      files.set(name, bytes);
    }

    const busy = runs.runningSlug();
    if (busy) throw new Busy(`"${busy}" is being worked on. Wait for it to finish or stop it first.`);
    const slug = slugFromBrief(brief, runs.exists);
    const state = { ...newState(slug, brief, [...files.keys()], body.maxUsd === undefined ? DEFAULT_MAX_USD : limit(body.maxUsd)), engine };
    mkdirSync(path.join(pipelineDir(root, slug), "uploads"), { recursive: true });
    for (const [name, bytes] of files) writeFileSync(path.join(pipelineDir(root, slug), "uploads", name), bytes);
    saveState(root, state);
    runs.run(slug);
    return slug;
  };

  const act = (slug: string, action: string, body: Record<string, unknown>) => {
    if (action === "stop") return runs.stop(slug);
    if (!loadState(root, slug)) throw new BadRequest("That video isn't in progress.");
    if (action === "continue") return runs.run(slug);
    if (action === "approve") {
      const gate = body.gate as Gate;
      if (!runs.canApprove(slug, gate)) throw new BadRequest("That isn't waiting for approval.");
      return runs.run(slug, ["--approve", gate]);
    }
    if (action === "revise") {
      const stage = body.stage as Stage;
      if (!STAGES.includes(stage)) throw new BadRequest("That stage doesn't exist.");
      const note = typeof body.note === "string" ? body.note.trim().slice(0, MAX_NOTE) : "";
      return runs.run(slug, ["--revise", stage, "--note", note, ...(body.maxUsd === undefined ? [] : ["--max-usd", String(limit(body.maxUsd))])]);
    }
    throw new BadRequest("Unknown action.");
  };

  const route = async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const parts = url.pathname.split("/").filter(Boolean);

    if (req.method === "GET") {
      if (url.pathname === "/") return send(res, 200, "text/html; charset=utf-8", page.html);
      if (url.pathname === "/app.js") return send(res, 200, "text/javascript; charset=utf-8", page.js);
      if (url.pathname === "/app.css") return send(res, 200, "text/css; charset=utf-8", page.css);
      if (parts[0] === "fonts" && parts.length === 2 && FONTS[parts[1]]) return sendFile(req, res, path.join(root, "public/fonts", FONTS[parts[1]]), "font/woff2");
      if (url.pathname === "/api/setup") return sendJson(res, 200, await setup());
      if (url.pathname === "/api/videos") return sendJson(res, 200, runs.list());
      if (parts[0] === "api" && parts[1] === "videos" && parts.length === 3 && SLUG.test(parts[2])) {
        const view = runs.detail(parts[2]);
        return view ? sendJson(res, 200, view) : sendJson(res, 404, { error: "That video doesn't exist." });
      }
      if (parts[0] === "media" && parts.length === 3 && SLUG.test(parts[1])) {
        const media = mediaFile(root, parts[1], parts[2]);
        if (media && existsSync(media.file)) return sendFile(req, res, media.file, media.type, url.searchParams.has("download") ? `${parts[1]}.mp4` : undefined);
      }
      return send(res, 404, "text/plain; charset=utf-8", "Not found");
    }

    if (req.method !== "POST") return send(res, 405, "text/plain; charset=utf-8", "Not allowed");
    // A cross-site form can't send this content type without the browser asking first, and this server never says yes.
    if (!isLocalOrigin(req.headers.origin, port()) || !req.headers["content-type"]?.startsWith("application/json")) return sendJson(res, 403, { error: "Requests have to come from this page." });
    const body = await readBody(req);

    if (url.pathname === "/api/setup/key") {
      if (!options.isKey(body.key)) throw new BadRequest("That doesn't look like a Claude API key. Keys start with sk-ant-.");
      options.saveKey(body.key);
      return sendJson(res, 200, { ok: true });
    }
    if (url.pathname === "/api/setup/sign-in") {
      options.signIn();
      return sendJson(res, 200, { ok: true });
    }
    if (url.pathname === "/api/videos") return sendJson(res, 200, { slug: await startVideo(body) });
    if (parts[0] === "api" && parts[1] === "videos" && parts.length === 4 && SLUG.test(parts[2])) {
      if (!runs.exists(parts[2])) return sendJson(res, 404, { error: "That video doesn't exist." });
      act(parts[2], parts[3], body);
      return sendJson(res, 200, { ok: true });
    }
    return sendJson(res, 404, { error: "Not found" });
  };

  return (req: IncomingMessage, res: ServerResponse) => {
    if (!isLocalHost(req.headers.host, port())) return send(res, 403, "text/plain; charset=utf-8", "This page can only be opened from this computer.");
    route(req, res).catch((err: Error) => {
      if (res.headersSent) return res.destroy();
      if (err instanceof Busy) return sendJson(res, 409, { error: err.message });
      if (err instanceof BadRequest) return sendJson(res, 400, { error: err.message });
      console.error(err);
      sendJson(res, 500, { error: "Something went wrong on this computer. The terminal window has the details." });
    });
  };
};
