import Stripe from "stripe";
import { env } from "@/lib/env";

declare global {

  var __kinframeStripe: Stripe | undefined;
}

export function getStripe(): Stripe {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  if (!globalThis.__kinframeStripe) {
    globalThis.__kinframeStripe = new Stripe(env.STRIPE_SECRET_KEY, {
      // Pin the API version so a Stripe-side upgrade can't silently change behavior.
      // Update this deliberately alongside the SDK.
      apiVersion: "2026-04-22.dahlia",
      typescript: true,
    });
  }
  return globalThis.__kinframeStripe;
}

export function siteUrl(): string {
  return env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
}
