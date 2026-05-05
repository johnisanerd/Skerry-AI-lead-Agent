import crypto from "node:crypto";

export type LogLevel = "info" | "warn" | "error";

export function makeRequestId(): string {
  return crypto.randomBytes(8).toString("hex");
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
    ...payload,
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
