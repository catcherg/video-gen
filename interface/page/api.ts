// Talks to the local server, and keeps the page's copy of its answers fresh.
import { useCallback, useEffect, useState } from "react";

export const post = async <T = unknown>(url: string, body: unknown = {}): Promise<T> => {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const answer = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(answer.error ?? "That didn't work.");
  return answer;
};

/** Reads a URL now and on a timer. Returns undefined until the first answer. */
export const usePoll = <T,>(url: string, everyMs: number) => {
  const [value, setValue] = useState<T>();
  const [missing, setMissing] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const response = await fetch(url);
      if (response.status === 404) setMissing(true);
      else if (response.ok) {
        setMissing(false);
        setValue((await response.json()) as T);
      }
    } catch {
      // The server is restarting. The next poll tries again.
    }
  }, [url]);
  useEffect(() => {
    setValue(undefined);
    void refresh();
    const timer = setInterval(() => void refresh(), everyMs);
    return () => clearInterval(timer);
  }, [refresh, everyMs]);
  return { value, missing, refresh };
};

export const readAsBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error(`"${file.name}" couldn't be read.`));
    reader.readAsDataURL(file);
  });
