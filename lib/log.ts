/**
 * Minimal structured logging: one JSON line per event so Vercel / log
 * drains can filter by route, stage and request_id without regexing
 * free-form console output. Never log secrets or image payloads.
 */

interface LogFields {
  request_id: string;
  route: string;
  stage?: string;
  ms?: number;
  [key: string]: unknown;
}

function emit(level: "info" | "error", event: string, fields: LogFields) {
  const line = JSON.stringify({
    level,
    event,
    ts: new Date().toISOString(),
    ...fields,
  });
  if (level === "error") console.error(line);
  else console.info(line);
}

export function logInfo(event: string, fields: LogFields) {
  emit("info", event, fields);
}

export function logError(
  event: string,
  fields: LogFields & { error?: unknown },
) {
  const { error, ...rest } = fields;
  emit("error", event, {
    ...rest,
    error:
      error instanceof Error
        ? `${error.name}: ${error.message}`
        : String(error ?? "unknown"),
  });
}
