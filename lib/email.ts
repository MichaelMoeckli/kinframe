import { Resend } from "resend";
import type { Order } from "@/lib/db/schema";
import { env } from "@/lib/env";

declare global {

  var __kinframeResend: Resend | undefined;
}

function getResend(): Resend | null {
  if (!env.RESEND_API_KEY) return null;
  if (!globalThis.__kinframeResend) {
    globalThis.__kinframeResend = new Resend(env.RESEND_API_KEY);
  }
  return globalThis.__kinframeResend;
}

function fromAddress(): string {
  return env.RESEND_FROM_EMAIL ?? "Kinframe <hello@kinframe.com>";
}

function formatPrice(cents: number, currency: string): string {
  const amount = (cents / 100).toFixed(2);
  return currency.toUpperCase() === "USD" ? `$${amount}` : `${amount} ${currency.toUpperCase()}`;
}

export async function sendOrderConfirmation(order: Order): Promise<void> {
  const resend = getResend();
  const subject = `Your Kinframe portrait is on its way`;
  const price = formatPrice(order.amountCents, order.currency);
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; color: #2a2620; line-height: 1.6;">
      <h1 style="font-family: Georgia, serif; font-size: 28px; margin: 0 0 16px;">Thank you</h1>
      <p>We've received your order and our painter is preparing your portrait. You'll get another email with a tracking link as soon as it ships — usually within 7&ndash;10 days.</p>
      <hr style="border: none; border-top: 1px solid #ece6dc; margin: 24px 0;" />
      <p style="margin: 0;"><strong>Order:</strong> ${order.id}</p>
      <p style="margin: 4px 0 0;"><strong>Total:</strong> ${price}</p>
      <p style="margin: 24px 0 0; font-size: 13px; color: #8a8276;">
        Replies to this email reach a real person. If anything looks off, just hit reply.
      </p>
    </div>
  `;
  const text = [
    `Thank you for your Kinframe order.`,
    ``,
    `Order: ${order.id}`,
    `Total: ${price}`,
    ``,
    `We'll email you tracking as soon as it ships (usually 7-10 days).`,
  ].join("\n");

  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set — skipping order confirmation", {
      to: order.email,
      orderId: order.id,
    });
    return;
  }

  try {
    await resend.emails.send({
      from: fromAddress(),
      to: order.email,
      subject,
      html,
      text,
    });
  } catch (err) {
    // Don't fail the webhook because an email send hiccuped — log and move on.
    console.error("[email] order confirmation failed", err);
  }
}
