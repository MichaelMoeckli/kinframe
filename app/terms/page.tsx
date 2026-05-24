import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms — Kinframe",
};

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-2xl px-6 py-20">
      <h1 className="font-display text-4xl tracking-tight">Terms</h1>
      <p className="mt-4 text-sm text-ink-soft">Last updated: {new Date().getFullYear()}</p>

      <h2 className="font-display text-2xl mt-10">The portrait</h2>
      <p className="mt-3 text-ink-soft leading-relaxed">
        Your Kinframe portrait is a painterly interpretation of your photo, not a
        photographic likeness. By placing an order, you confirm that you have the right
        to use the photo you uploaded and that no people in the photo object to it being
        turned into a portrait.
      </p>

      <h2 className="font-display text-2xl mt-8">Our happiness guarantee</h2>
      <p className="mt-3 text-ink-soft leading-relaxed">
        If you&rsquo;re not delighted with your portrait, we&rsquo;ll re-do it. If you
        still aren&rsquo;t happy after a re-do, we&rsquo;ll refund your order in full.
      </p>

      <h2 className="font-display text-2xl mt-8">Shipping</h2>
      <p className="mt-3 text-ink-soft leading-relaxed">
        Orders typically ship in 7&ndash;10 business days. See our{" "}
        <a className="underline" href="/shipping">shipping page</a> for full details.
      </p>

      <h2 className="font-display text-2xl mt-8">Acceptable use</h2>
      <p className="mt-3 text-ink-soft leading-relaxed">
        Don&rsquo;t upload photos of people who haven&rsquo;t consented, or any photo
        that&rsquo;s illegal, hateful, or violent. We reserve the right to decline
        orders for any reason and refund.
      </p>
    </article>
  );
}
