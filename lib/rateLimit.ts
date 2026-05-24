type RateLimitResult = {
  success: boolean;
  remaining: number;
  resetAt: Date;
};

type Window = { count: number; resetAt: number };

// Dev fallback when Upstash isn't configured. Per-process, lost on restart.
// Fine for local dev; production must have Upstash configured.
const memory = new Map<string, Window>();

function memoryLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const existing = memory.get(key);
  if (!existing || existing.resetAt <= now) {
    memory.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: limit - 1, resetAt: new Date(now + windowMs) };
  }
  if (existing.count >= limit) {
    return { success: false, remaining: 0, resetAt: new Date(existing.resetAt) };
  }
  existing.count += 1;
  return {
    success: true,
    remaining: limit - existing.count,
    resetAt: new Date(existing.resetAt),
  };
}

/**
 * Sliding window rate limiter. Backed by Upstash Redis in production,
 * in-memory fallback in dev.
 *
 * @param key      stable per-actor key, e.g. `ip:1.2.3.4` or `email:foo@bar`
 * @param limit    requests per window
 * @param windowMs window length in ms
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return memoryLimit(key, limit, windowMs);
  }
  const { Redis } = await import("@upstash/redis");
  const { Ratelimit } = await import("@upstash/ratelimit");
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, `${Math.ceil(windowMs / 1000)} s`),
    prefix: "kinframe",
  });
  const r = await limiter.limit(key);
  return {
    success: r.success,
    remaining: r.remaining,
    resetAt: new Date(r.reset),
  };
}

export const LIMITS = {
  PREVIEWS_PER_IP_PER_DAY: 3,
  PREVIEWS_PER_EMAIL_PER_DAY: 5,
  DAY_MS: 24 * 60 * 60 * 1000,
};

export function hashIp(ip: string): string {
  // Lightweight obfuscation — we store this with previews for rate-limit auditing
  // but don't want raw IPs in the database. crypto for stronger guarantees.
  let h = 0;
  for (let i = 0; i < ip.length; i++) {
    h = (h * 31 + ip.charCodeAt(i)) | 0;
  }
  return `ip_${(h >>> 0).toString(36)}`;
}
