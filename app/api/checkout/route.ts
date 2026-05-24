import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

/**
 * Stripe Checkout session creator. Stubbed until M3 wires up Stripe.
 *
 * The contract is: POST { previewId } -> { url: stripeCheckoutUrl }.
 * The PreviewClient navigates to `url`.
 */
export async function POST(_req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      {
        error:
          "Checkout isn't wired up yet — we're shipping it in the next milestone.",
      },
      { status: 501 },
    );
  }

  return NextResponse.json(
    { error: "Checkout implementation pending." },
    { status: 501 },
  );
}
