import { env } from "@/lib/env";
import { getOrder, updateOrder } from "@/lib/orders";
import { getPreview } from "@/lib/previews";
import { DEFAULT_PRODUCT } from "@/lib/products";
import { buildPrintReady } from "@/lib/fulfillment/printReady";
import {
  createPrintfulOrder,
  mapStripeShippingToPrintful,
} from "@/lib/fulfillment/printful";

/**
 * Build the print-ready file, submit the order to Printful, and persist the
 * resulting printfulOrderId. Errors are caught and recorded as
 * `fulfillment_failed` so callers (e.g. the Stripe webhook) never throw.
 */
export async function submitToFulfillment(orderId: string): Promise<void> {
  try {
    const order = await getOrder(orderId);
    if (!order) {
      console.error("[fulfillment] submit: order not found", { orderId });
      return;
    }
    if (order.status !== "paid") {
      // Defensive: re-fires from waitUntil/Stripe retries shouldn't re-submit.
      console.warn("[fulfillment] submit: order not in paid state, skipping", {
        orderId,
        status: order.status,
      });
      return;
    }

    const preview = await getPreview(order.previewId);
    if (!preview || !preview.generatedUrl) {
      await updateOrder(orderId, { status: "fulfillment_failed" });
      console.error("[fulfillment] submit: preview missing generatedUrl", {
        orderId,
        previewId: order.previewId,
      });
      return;
    }

    // Build the high-res JPEG and persist its URL up front so we keep the
    // artifact even if the Printful call fails afterwards.
    const printReady = await buildPrintReady(preview.generatedUrl, DEFAULT_PRODUCT);
    await updateOrder(orderId, { printReadyUrl: printReady.url });

    if (!env.PRINTFUL_API_KEY || !env.PRINTFUL_VARIANT_ID) {
      // Dev / sandbox path — mock the submission so the rest of the flow runs.
      const mockId = `dev-mock-${order.id}`;
      await updateOrder(orderId, { printfulOrderId: mockId, status: "submitted" });
      console.warn("[fulfillment] PRINTFUL_API_KEY/VARIANT_ID not set — mocked submission", {
        orderId,
        printfulOrderId: mockId,
      });
      return;
    }

    const recipient = mapStripeShippingToPrintful(order.shippingAddress);
    const { printfulOrderId } = await createPrintfulOrder({
      externalId: order.id,
      recipient,
      variantId: env.PRINTFUL_VARIANT_ID,
      fileUrl: printReady.url,
    });

    await updateOrder(orderId, { printfulOrderId, status: "submitted" });
  } catch (err) {
    await updateOrder(orderId, { status: "fulfillment_failed" }).catch(() => undefined);
    console.error("[fulfillment] submit failed", {
      orderId,
      err: err instanceof Error ? { message: err.message, stack: err.stack } : err,
    });
  }
}
