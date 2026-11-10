// Finds out how this person can reach Claude, and saves their key. A key goes in and never comes back out.
import { execFile, spawn } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { claudeEnv, findClaudeBinary } from "../scripts/pipeline/claudeCode";
import { CREDENTIALS_PATH } from "../scripts/pipeline/model";
import type { Setup } from "./types";

const STATUS_TIMEOUT_MS = 10000;

const claudeBinary = () => {
  try {
    return findClaudeBinary();
  } catch {
    return undefined;
  }
};

/** Whether a signed-in Claude plan is available. Only the yes or no is kept from the command's answer. */
export const planStatus = (): Promise<Setup["plan"]> =>
  new Promise((resolve) => {
    const binary = claudeBinary();
    if (!binary) return resolve("not-installed");
    execFile(binary, ["auth", "status", "--json"], { env: claudeEnv(), timeout: STATUS_TIMEOUT_MS }, (_error, stdout) => {
      try {
        resolve((JSON.parse(stdout) as { loggedIn?: boolean }).loggedIn === true ? "signed-in" : "signed-out");
      } catch {
        resolve("signed-out");
      }
    });
  });

/** Opens Claude's own sign-in in the browser. The sign-in happens on Anthropic's page, never on this one. */
export const startSignIn = () => {
  const binary = claudeBinary();
  if (!binary) throw new Error("Claude Code isn't installed on this computer.");
  spawn(binary, ["auth", "login"], { env: claudeEnv(), stdio: "ignore", detached: true }).unref();
};

export const hasStoredKey = (file = CREDENTIALS_PATH) => Boolean(process.env.ANTHROPIC_API_KEY) || existsSync(file);

export const isApiKey = (key: unknown): key is string => typeof key === "string" && /^sk-ant-[A-Za-z0-9_-]{16,}$/.test(key.trim());

/** Stores the key outside the repository, readable only by this account. */
export const saveApiKey = (key: string, file = CREDENTIALS_PATH) => {
  mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  writeFileSync(file, `${JSON.stringify({ apiKey: key.trim() })}\n`, { mode: 0o600 });
  chmodSync(file, 0o600);
};
