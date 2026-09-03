import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

const PRINTFUL_API_BASE = "https://api.printful.com";

export type PrintfulRecipient = {
  name: string;
  address1: string;
  address2: string | null;
  city: string;
  state_code: string | null;
  country_code: string;
  zip: string;
  phone: string | null;
};

export type CreatePrintfulOrderInput = {
  externalId: string;
  recipient: PrintfulRecipient;
  variantId: string;
  fileUrl: string;
};

export type CreatePrintfulOrderResult = {
  printfulOrderId: string;
};

export class PrintfulApiError extends Error {
  status: number;
  body: string;
  constructor(status: number, body: string) {
    super(`Printful API ${status}: ${body.slice(0, 500)}`);
    this.name = "PrintfulApiError";
    this.status = status;
    this.body = body;
  }
}

export async function createPrintfulOrder(
  input: CreatePrintfulOrderInput,
): Promise<CreatePrintfulOrderResult> {
  if (!env.PRINTFUL_API_KEY) {
    throw new Error("PRINTFUL_API_KEY is not set");
  }

  const body = {
    external_id: input.externalId,
    recipient: input.recipient,
    items: [
      {
        variant_id: Number(input.variantId),
        quantity: 1,
        files: [{ url: input.fileUrl, type: "default" }],
      },
    ],
  };

  const res = await fetch(`${PRINTFUL_API_BASE}/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.PRINTFUL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new PrintfulApiError(res.status, text);
  }

  const parsed = JSON.parse(text) as { result?: { id?: number | string } };
  const id = parsed.result?.id;
  if (id === undefined || id === null) {
    throw new PrintfulApiError(res.status, `Missing result.id in response: ${text.slice(0, 500)}`);
  }
  return { printfulOrderId: String(id) };
}

/**
 * Printful doesn't sign webhook payloads (no HMAC, no signature header), so
 * the only way to keep the endpoint from accepting spoofed requests is a
 * shared secret embedded in the webhook URL itself — register the webhook
 * as `.../api/printful/webhook?token=<PRINTFUL_WEBHOOK_SECRET>` in Printful.
 * When the secret is unset, we return true with a warn so local/dev flows
 * still work — production must set the secret.
 */
export function verifyPrintfulWebhook(tokenParam: string | null): boolean {
  if (!env.PRINTFUL_WEBHOOK_SECRET) {
    console.warn("[printful webhook] PRINTFUL_WEBHOOK_SECRET not set — accepting unauthenticated event");
    return true;
  }
  if (!tokenParam) return false;

  const expected = Buffer.from(env.PRINTFUL_WEBHOOK_SECRET);
  const actual = Buffer.from(tokenParam);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

type StripeShipping = {
  name?: string | null;
  address?: {
    line1?: string | null;
    line2?: string | null;
    city?: string | null;
    state?: string | null;
    postal_code?: string | null;
    country?: string | null;
  } | null;
  phone?: string | null;
};

export function mapStripeShippingToPrintful(
  shippingAddress: unknown,
): PrintfulRecipient {
  const ship = shippingAddress as StripeShipping | null;
  const addr = ship?.address ?? null;
  if (!ship || !addr || !addr.line1 || !addr.city || !addr.country || !addr.postal_code) {
    throw new Error("Shipping address is incomplete — cannot submit to Printful");
  }

  return {
    name: ship.name ?? "",
    address1: addr.line1,
    address2: addr.line2 ?? null,
    city: addr.city,
    state_code: addr.state ?? null,
    country_code: addr.country,
    zip: addr.postal_code,
    phone: ship.phone ?? null,
  };
}
