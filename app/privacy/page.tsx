import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy — Kinframe",
};

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-2xl px-6 py-20">
      <h1 className="font-display text-4xl tracking-tight">Privacy</h1>
      <p className="mt-4 text-sm text-ink-soft">Last updated: {new Date().getFullYear()}</p>

      <h2 className="font-display text-2xl mt-10">Photos you upload</h2>
      <p className="mt-3 text-ink-soft leading-relaxed">
        Photos you upload are used only to create your portrait. We store the original
        image and the generated portrait in encrypted storage. We never sell or share
        your photos. Original uploads are deleted 30 days after your order ships
        (or 30 days after upload if no order is placed).
      </p>

      <h2 className="font-display text-2xl mt-8">Information we collect</h2>
      <p className="mt-3 text-ink-soft leading-relaxed">
        When you place an order we collect your email and shipping address through
        Stripe in order to charge your payment method and ship your portrait. We use
        Resend to send order confirmation and shipping emails.
      </p>

      <h2 className="font-display text-2xl mt-8">Analytics</h2>
      <p className="mt-3 text-ink-soft leading-relaxed">
        We use privacy-respecting analytics to understand which pages people visit and
        how the funnel performs. We share anonymized conversion events with Meta to
        measure the effectiveness of our advertising.
      </p>

      <h2 className="font-display text-2xl mt-8">Contact</h2>
      <p className="mt-3 text-ink-soft leading-relaxed">
        Questions, deletion requests, or anything else &mdash; email hello@kinframe.com.
      </p>
    </article>
  );
}
