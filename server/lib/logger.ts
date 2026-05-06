import crypto from "node:crypto";

export type LogLevel = "info" | "warn" | "error";

export function makeRequestId(): string {
  return crypto.randomBytes(8).toString("hex");
}

function shouldRedactKey(key: string): boolean {
  return /(api[_-]?key|token|secret|password|cookie|authorization|session)/i.test(
    key
  );
}

function redactValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return "[redacted]";
  if (typeof value === "number") return 0;
  if (typeof value === "boolean") return false;
  return "[redacted]";
}

function redactPayload(input: unknown): unknown {
  if (input === null || input === undefined) return input;
  if (Array.isArray(input)) return input.map(v => redactPayload(v));
  if (typeof input !== "object") return input;

  const obj = input as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (shouldRedactKey(k)) {
      out[k] = redactValue(v);
      continue;
    }
    out[k] = redactPayload(v);
  }
  return out;
}

export function logEvent(
  level: LogLevel,
  event: string,
  payload: Record<string, unknown>
): void {
  const entry = {
    ts: new Date().toISOString(),
    level,
    event,
    ...(redactPayload(payload) as Record<string, unknown>),
  };
  const line = JSON.stringify(entry);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}
