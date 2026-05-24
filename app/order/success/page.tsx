import Link from "next/link";
import { OrderSuccessClient } from "./OrderSuccessClient";

export const dynamic = "force-dynamic";

export default async function OrderSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id: sessionId } = await searchParams;

  return (
    <section className="mx-auto max-w-2xl px-6 py-20">
      <div className="text-center">
        <p className="text-sm uppercase tracking-[0.18em] text-frame">Order confirmed</p>
        <h1 className="mt-4 font-display text-4xl tracking-tight">
          Your portrait is on the way
        </h1>
        <p className="mt-4 text-ink-soft leading-relaxed">
          Our painter is preparing your framed canvas. You&rsquo;ll get a tracking
          email as soon as it ships &mdash; usually within 7&ndash;10 days.
        </p>
      </div>

      <div className="mt-12 rounded-lg bg-cream/40 ring-1 ring-cream p-6">
        {sessionId ? (
          <OrderSuccessClient sessionId={sessionId} />
        ) : (
          <p className="text-sm text-ink-soft">
            We couldn&rsquo;t find a Stripe session in this URL. If you just paid and
            this looks wrong, please email{" "}
            <a className="underline" href="mailto:hello@kinframe.com">
              hello@kinframe.com
            </a>
            .
          </p>
        )}
      </div>

      <p className="mt-12 text-center text-sm text-ink-soft">
        <Link href="/" className="underline">
          Back to Kinframe
        </Link>
      </p>
    </section>
  );
}
