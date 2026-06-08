import { after, NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { env } from "@/lib/env";
import { getStripe } from "@/lib/stripe";
import { createOrderIdempotent, getOrderByStripeSessionId } from "@/lib/orders";
import { sendOrderConfirmation } from "@/lib/email";
import { DEFAULT_PRODUCT } from "@/lib/products";
import { submitToFulfillment } from "@/lib/fulfillment/submit";

export const runtime = "nodejs";
// Webhook signature verification needs the raw body. Disable any caching.
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) {
    // Returning 200 prevents Stripe from indefinitely retrying against an
    // intentionally-unconfigured environment. Log loud so we notice.
    console.warn("[stripe webhook] not configured — ignoring event");
    return NextResponse.json({ received: true, configured: false });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  const rawBody = await req.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid signature";
    console.error("[stripe webhook] signature verification failed", msg);
    return NextResponse.json({ error: `Webhook Error: ${msg}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        await handleCheckoutCompleted(event.data.object);
        break;
      }
      default:
        // Other event types are no-ops for now. Logged at debug volume.
        break;
    }
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error(`[stripe webhook] handler failed for ${event.type}`, err);
    // 500 tells Stripe to retry — appropriate for transient DB/email failures.
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }
}

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
): Promise<void> {
  if (session.payment_status !== "paid") {
    // Async payment methods (e.g. bank debits) emit this event before money
    // actually moves. Wait for the async_succeeded event instead.
    return;
  }

  const previewId = session.metadata?.previewId;
  const productId = session.metadata?.productId ?? DEFAULT_PRODUCT.id;
  if (!previewId) {
    console.error("[stripe webhook] checkout.session.completed missing previewId metadata", {
      sessionId: session.id,
    });
    return;
  }

  // Short-circuit on the read path so we skip the insert + email entirely
  // when Stripe retries an already-processed event.
  const alreadyProcessed = await getOrderByStripeSessionId(session.id);
  if (alreadyProcessed) return;

  const email =
    session.customer_details?.email ?? session.customer_email ?? "";
  if (!email) {
    console.error("[stripe webhook] no customer email on session", {
      sessionId: session.id,
    });
  }

  const amountCents = session.amount_total ?? DEFAULT_PRODUCT.priceCents;
  const currency = (session.currency ?? DEFAULT_PRODUCT.currency).toLowerCase();
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

  const order = await createOrderIdempotent({
    previewId,
    productId,
    email,
    amountCents,
    currency,
    stripeSessionId: session.id,
    stripePaymentIntentId: paymentIntentId,
    shippingAddress: serializeShipping(session),
  });

  await sendOrderConfirmation(order);

  // Fire-and-forget after the 200 has gone back to Stripe. submitToFulfillment
  // swallows its own errors and records `fulfillment_failed` if anything blows up.
  after(() => submitToFulfillment(order.id));
}

function serializeShipping(session: Stripe.Checkout.Session): unknown {
  // Stripe split shipping out of customer_details on newer API versions;
  // collected_information.shipping_details is the current field on `dahlia`.
  const collected = (
    session as Stripe.Checkout.Session & {
      collected_information?: {
        shipping_details?: {
          name?: string | null;
          address?: Stripe.Address | null;
        } | null;
      } | null;
    }
  ).collected_information?.shipping_details;

  if (collected) {
    return {
      name: collected.name ?? null,
      address: collected.address ?? null,
      phone: session.customer_details?.phone ?? null,
    };
  }
  return {
    name: session.customer_details?.name ?? null,
    address: null,
    phone: session.customer_details?.phone ?? null,
  };
}
