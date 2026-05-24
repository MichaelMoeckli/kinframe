import { z } from "zod";

// `.env.local` files routinely contain blank entries like `DATABASE_URL=` for
// vars that aren't configured yet. Treat those as undefined so optional URL
// fields don't fail validation. Applied to all string-ish fields below.
const optionalStr = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().optional(),
);
const optionalUrl = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().url().optional(),
);
const optionalEmail = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().email().optional(),
);

const serverSchema = z.object({
  DATABASE_URL: optionalUrl,
  BLOB_READ_WRITE_TOKEN: optionalStr,
  REPLICATE_API_TOKEN: optionalStr,
  REPLICATE_MODEL_VERSION: optionalStr,
  GEMINI_API_KEY: optionalStr,
  GEMINI_IMAGE_MODEL: optionalStr,
  STRIPE_SECRET_KEY: optionalStr,
  STRIPE_WEBHOOK_SECRET: optionalStr,
  STRIPE_PRICE_ID: optionalStr,
  PRINTFUL_API_KEY: optionalStr,
  PRINTFUL_VARIANT_ID: optionalStr,
  RESEND_API_KEY: optionalStr,
  RESEND_FROM_EMAIL: optionalEmail,
  UPSTASH_REDIS_REST_URL: optionalUrl,
  UPSTASH_REDIS_REST_TOKEN: optionalStr,
  META_CAPI_TOKEN: optionalStr,
  ADMIN_PASSWORD: optionalStr,
  SENTRY_DSN: optionalStr,
});

const clientSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_POSTHOG_KEY: optionalStr,
  NEXT_PUBLIC_META_PIXEL_ID: optionalStr,
});

export const env = {
  ...serverSchema.parse(process.env),
  ...clientSchema.parse({
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_META_PIXEL_ID: process.env.NEXT_PUBLIC_META_PIXEL_ID,
  }),
};

export function requireEnv<K extends keyof typeof env>(key: K): NonNullable<(typeof env)[K]> {
  const value = env[key];
  if (value === undefined || value === null || value === "") {
    throw new Error(`Missing required environment variable: ${String(key)}`);
  }
  return value as NonNullable<(typeof env)[K]>;
}
