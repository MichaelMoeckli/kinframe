import { after, NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { getOrder, updateOrder } from "@/lib/orders";
import { sendShippingNotification } from "@/lib/email";
import { verifyPrintfulWebhook } from "@/lib/fulfillment/printful";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PrintfulShipment = {
  tracking_url?: string | null;
  tracking_number_url?: string | null;
};

type PrintfulOrderRef = {
  external_id?: string | null;
};

type PrintfulEvent = {
  type?: string;
  data?: {
    order?: PrintfulOrderRef | null;
    shipment?: PrintfulShipment | null;
  } | null;
};

export async function POST(req: NextRequest) {
  if (!env.PRINTFUL_WEBHOOK_SECRET) {
    // Mirror the Stripe-unconfigured path: don't have Printful retry forever,
    // but stay loud in logs and reject in prod-shaped envs.
    console.warn("[printful webhook] PRINTFUL_WEBHOOK_SECRET not set — ignoring event");
    return NextResponse.json({ received: true, configured: false });
  }

  const token = req.nextUrl.searchParams.get("token");
  if (!verifyPrintfulWebhook(token)) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  const rawBody = await req.text();

  let event: PrintfulEvent;
  try {
    event = JSON.parse(rawBody) as PrintfulEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const externalId = event.data?.order?.external_id ?? null;
  if (!externalId) {
    console.warn("[printful webhook] event missing data.order.external_id", { type: event.type });
    // 200 — Printful shouldn't retry an event we can't correlate.
    return NextResponse.json({ received: true });
  }

  const order = await getOrder(externalId);
  if (!order) {
    console.error("[printful webhook] no matching order for external_id", { externalId });
    return NextResponse.json({ received: true });
  }

  try {
    switch (event.type) {
      case "package_shipped": {
        const trackingUrl =
          event.data?.shipment?.tracking_url ??
          event.data?.shipment?.tracking_number_url ??
          null;
        const updated = await updateOrder(order.id, {
          status: "shipped",
          trackingUrl,
        });
        if (updated && updated.trackingUrl) {
          after(() => sendShippingNotification(updated));
        } else {
          console.warn("[printful webhook] package_shipped without trackingUrl", {
            orderId: order.id,
          });
        }
        break;
      }
      case "package_returned": {
        await updateOrder(order.id, { status: "fulfillment_failed" });
        console.error("[printful webhook] package_returned — needs ops review", {
          orderId: order.id,
        });
        break;
      }
      case "order_failed":
      case "order_canceled": {
        await updateOrder(order.id, { status: "fulfillment_failed" });
        console.error(`[printful webhook] ${event.type} — needs ops review`, {
          orderId: order.id,
        });
        break;
      }
      default:
        // Ignored event types (order_updated, order_put_hold, etc.).
        break;
    }
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error(`[printful webhook] handler failed for ${event.type}`, err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }
}
