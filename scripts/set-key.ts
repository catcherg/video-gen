// Saves your own Claude API key for the pipeline, outside this repository, readable only by you.
// Usage: npm run set-key       then paste the key when asked. It isn't shown as you type.
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { CREDENTIALS_PATH } from "./pipeline/model";

const readHidden = (prompt: string) =>
  new Promise<string>((resolve) => {
    process.stdout.write(prompt);
    const input = process.stdin;
    input.setRawMode?.(true);
    input.resume();
    input.setEncoding("utf8");
    let value = "";
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") {
          input.setRawMode?.(false);
          input.pause();
          input.removeListener("data", onData);
          process.stdout.write("\n");
          resolve(value);
          return;
        }
        if (ch === "\u0003") process.exit(130);
        value = ch === "\u007f" ? value.slice(0, -1) : value + ch;
      }
    };
    input.on("data", onData);
  });

const key = (await readHidden("Paste your Claude API key: ")).trim();
if (!key.startsWith("sk-ant-")) {
  console.error("That doesn't look like a Claude API key. Nothing was saved.");
  process.exit(2);
}
mkdirSync(path.dirname(CREDENTIALS_PATH), { recursive: true, mode: 0o700 });
writeFileSync(CREDENTIALS_PATH, `${JSON.stringify({ apiKey: key })}\n`, { mode: 0o600 });
chmodSync(CREDENTIALS_PATH, 0o600);
console.log(`Saved to ${CREDENTIALS_PATH}. It's outside this repository and only your account can read it.`);
