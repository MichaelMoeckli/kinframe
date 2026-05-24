import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shipping & returns — Kinframe",
};

export default function ShippingPage() {
  return (
    <article className="mx-auto max-w-2xl px-6 py-20">
      <h1 className="font-display text-4xl tracking-tight">Shipping &amp; returns</h1>

      <h2 className="font-display text-2xl mt-10">Timing</h2>
      <p className="mt-3 text-ink-soft leading-relaxed">
        Most orders ship within 7&ndash;10 business days of being placed. You&rsquo;ll
        receive a tracking link by email as soon as your portrait leaves the studio.
      </p>

      <h2 className="font-display text-2xl mt-8">Where we ship</h2>
      <p className="mt-3 text-ink-soft leading-relaxed">
        We currently ship within the United States. International shipping is coming
        soon &mdash; join our list at the bottom of the home page and we&rsquo;ll tell
        you when it opens up.
      </p>

      <h2 className="font-display text-2xl mt-8">Returns</h2>
      <p className="mt-3 text-ink-soft leading-relaxed">
        Because each portrait is made for you, we don&rsquo;t accept general returns.
        But our happiness guarantee covers you: if you&rsquo;re not delighted, we&rsquo;ll
        re-do it, and if you&rsquo;re still not happy, we&rsquo;ll refund you in full.
      </p>

      <h2 className="font-display text-2xl mt-8">Damaged in transit</h2>
      <p className="mt-3 text-ink-soft leading-relaxed">
        If your portrait arrives damaged, send us a photo within 7 days and we&rsquo;ll
        ship a replacement right away.
      </p>
    </article>
  );
}
