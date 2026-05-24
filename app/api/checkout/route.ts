import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { z } from "zod";
import { getPreview } from "@/lib/previews";
import { DEFAULT_PRODUCT } from "@/lib/products";
import { env } from "@/lib/env";
import { getStripe, siteUrl } from "@/lib/stripe";

export const runtime = "nodejs";

const inputSchema = z.object({
  previewId: z.string().uuid({ message: "Invalid previewId" }),
});

/**
 * POST { previewId } -> { url }
 *
 * Creates a Stripe Checkout Session for the framed-canvas product. We prefer
 * a real Stripe price (STRIPE_PRICE_ID) for clean reporting; fall back to
 * inline price_data so dev/staging works without a Stripe dashboard entry.
 */
export async function POST(req: NextRequest) {
  if (!env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      {
        error:
          "Checkout isn't wired up in this environment yet. Set STRIPE_SECRET_KEY to enable it.",
      },
      { status: 501 },
    );
  }

  const json = await req.json().catch(() => null);
  const parsed = inputSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }

  const preview = await getPreview(parsed.data.previewId);
  if (!preview) {
    return NextResponse.json({ error: "Preview not found" }, { status: 404 });
  }
  if (preview.status !== "ready") {
    return NextResponse.json(
      { error: "Preview isn't ready yet — give it a moment and try again." },
      { status: 409 },
    );
  }

  const product = DEFAULT_PRODUCT;
  const base = siteUrl();

  const lineItems: Stripe.Checkout.SessionCreateParams["line_items"] = [
    env.STRIPE_PRICE_ID
      ? { price: env.STRIPE_PRICE_ID, quantity: 1 }
      : {
          quantity: 1,
          price_data: {
            currency: product.currency,
            unit_amount: product.priceCents,
            product_data: {
              name: product.name,
              description: product.description,
            },
          },
        },
  ];

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      customer_email: preview.email ?? undefined,
      shipping_address_collection: {
        // First-order markets. Expand once fulfillment supports more.
        allowed_countries: ["US", "CA", "GB", "AU", "DE", "FR", "CH", "NL"],
      },
      phone_number_collection: { enabled: true },
      allow_promotion_codes: true,
      success_url: `${base}/order/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/order/cancel?previewId=${preview.id}`,
      metadata: {
        previewId: preview.id,
        productId: product.id,
      },
      payment_intent_data: {
        metadata: {
          previewId: preview.id,
          productId: product.id,
        },
      },
    });

    if (!session.url) {
      throw new Error("Stripe returned a session without a URL");
    }

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[checkout] failed", err);
    return NextResponse.json(
      { error: "Couldn't start checkout. Please try again." },
      { status: 500 },
    );
  }
}
