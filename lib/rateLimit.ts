/**
 * Best-effort in-memory fixed-window rate limiter.
 *
 * NOTE: state lives per serverless instance, so this bounds abuse per
 * instance rather than globally. It stops naive loops from burning Meta /
 * OpenAI quota at zero infra cost. For a global guarantee swap the Map
 * for Upstash Redis or a Postgres window table behind this same API.
 */

interface WindowState {
  count: number;
  resetAt: number;
}

const windows = new Map<string, WindowState>();
const MAX_KEYS = 10_000;

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();

  // Opportunistic cleanup so the Map cannot grow without bound.
  if (windows.size > MAX_KEYS) {
    for (const [k, v] of windows) {
      if (v.resetAt <= now) windows.delete(k);
    }
  }

  const current = windows.get(key);
  if (!current || current.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (current.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }

  current.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Client IP from proxy headers, with a stable fallback bucket. */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "desconocida";
}
