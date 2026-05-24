import { createHmac, timingSafeEqual } from "node:crypto";
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
 * HMAC-SHA256 of the raw body using PRINTFUL_WEBHOOK_SECRET, compared to the
 * X-PF-Webhook-Signature header. When the secret is unset, we return true with
 * a warn so local/dev flows still work — production must set the secret.
 */
export function verifyPrintfulWebhook(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  if (!env.PRINTFUL_WEBHOOK_SECRET) {
    console.warn("[printful webhook] PRINTFUL_WEBHOOK_SECRET not set — accepting unsigned event");
    return true;
  }
  if (!signatureHeader) return false;

  const expected = createHmac("sha256", env.PRINTFUL_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");

  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(signatureHeader.trim(), "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
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
