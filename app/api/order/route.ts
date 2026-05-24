import { NextResponse, type NextRequest } from "next/server";
import { getOrderByStripeSessionId } from "@/lib/orders";

export const runtime = "nodejs";

/**
 * GET /api/order?session_id=cs_...
 *
 * Read-only lookup the /order/success page polls until the webhook has
 * recorded the order. Returns 404 until the matching row exists.
 */
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("session_id");
  if (!sessionId) {
    return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
  }

  const order = await getOrderByStripeSessionId(sessionId);
  if (!order) {
    return NextResponse.json({ status: "pending" }, { status: 404 });
  }

  return NextResponse.json({
    id: order.id,
    status: order.status,
    email: order.email,
    amountCents: order.amountCents,
    currency: order.currency,
  });
}
