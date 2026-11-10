// Small pure rules for the local server. Any website open in the same browser can send requests to localhost,
// so every request has to prove it came from this page, and everything named in a request has to be checked.
import path from "node:path";

export const SLUG = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const RESERVED = new Set(["parts-gallery", "visual-gallery", "registry"]);
const LOCAL_HOSTS = ["localhost", "127.0.0.1"];
const MAX_SLUG_LENGTH = 48;
const SLUG_WORDS = 7;
const UPLOAD_TYPES = [".txt", ".md", ".csv", ".pdf"];

/** Blocks DNS rebinding, where another website's name is pointed at this computer. */
export const isLocalHost = (host: string | undefined, port: number) => LOCAL_HOSTS.some((h) => host === `${h}:${port}`);

/** Blocks other websites from making changes through the visitor's browser. */
export const isLocalOrigin = (origin: string | undefined, port: number) => LOCAL_HOSTS.some((h) => origin === `http://${h}:${port}`);

/** A readable folder name from the description, made unique. */
export const slugFromBrief = (brief: string, taken: (slug: string) => boolean) => {
  const words = brief
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .slice(0, SLUG_WORDS);
  const joined = words.join("-").slice(0, MAX_SLUG_LENGTH).replace(/-+$/, "");
  const base = /^[a-z]/.test(joined) ? joined : joined ? `video-${joined}` : "video";
  if (!RESERVED.has(base) && !taken(base)) return base;
  for (let n = 2; ; n++) if (!RESERVED.has(`${base}-${n}`) && !taken(`${base}-${n}`)) return `${base}-${n}`;
};

/** A safe file name for an upload, or undefined if the type isn't one the pipeline can read. */
export const cleanUploadName = (name: string) => {
  const base = path.basename(name.replaceAll("\\", "/")).replace(/[^A-Za-z0-9._ -]/g, "_").replace(/^\.+/, "").trim();
  return base.length > 0 && UPLOAD_TYPES.includes(path.extname(base).toLowerCase()) ? base.slice(-120) : undefined;
};

/** The byte range asked for by a media player, or undefined if the header can't be honoured. */
export const parseRange = (header: string, size: number): { start: number; end: number } | undefined => {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (match[1] === "" && match[2] === "") || size === 0) return undefined;
  if (match[1] === "") {
    const last = Math.min(Number(match[2]), size);
    return last === 0 ? undefined : { start: size - last, end: size - 1 };
  }
  const start = Number(match[1]);
  const end = match[2] === "" ? size - 1 : Math.min(Number(match[2]), size - 1);
  return start > end || start >= size ? undefined : { start, end };
};
