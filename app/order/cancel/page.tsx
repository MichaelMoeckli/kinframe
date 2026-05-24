import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function OrderCancelPage({
  searchParams,
}: {
  searchParams: Promise<{ previewId?: string }>;
}) {
  const { previewId } = await searchParams;
  const previewHref = previewId ? `/preview/${previewId}` : "/create";

  return (
    <section className="mx-auto max-w-xl px-6 py-20 text-center">
      <p className="text-sm uppercase tracking-[0.18em] text-frame">Checkout cancelled</p>
      <h1 className="mt-4 font-display text-4xl tracking-tight">
        Your portrait is still waiting
      </h1>
      <p className="mt-4 text-ink-soft leading-relaxed">
        Nothing was charged. Your preview is saved &mdash; come back any time to finish your order.
      </p>
      <div className="mt-10 flex flex-col items-center gap-3">
        <Link
          href={previewHref}
          className="inline-block rounded-full bg-frame px-6 py-3 text-paper hover:bg-frame-dark"
        >
          Back to my portrait
        </Link>
        <Link href="/" className="text-sm text-ink-soft underline">
          Or return home
        </Link>
      </div>
    </section>
  );
}
