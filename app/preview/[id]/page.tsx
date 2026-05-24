import { notFound } from "next/navigation";
import Link from "next/link";
import { getPreview } from "@/lib/previews";
import { DEFAULT_PRODUCT } from "@/lib/products";
import { PreviewClient } from "./PreviewClient";

export const dynamic = "force-dynamic";

export default async function PreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const preview = await getPreview(id);
  if (!preview) notFound();

  const priceLabel = `$${(DEFAULT_PRODUCT.priceCents / 100).toFixed(0)}`;

  return (
    <section className="mx-auto max-w-5xl px-6 py-12">
      <div className="text-center max-w-xl mx-auto">
        <p className="text-sm uppercase tracking-[0.18em] text-frame">Your portrait</p>
        <h1 className="mt-4 font-display text-4xl tracking-tight">
          Here&rsquo;s how it&rsquo;s coming together
        </h1>
        <p className="mt-3 text-ink-soft">
          The preview has a light overlay. The framed canvas you receive will be clean,
          higher resolution, and printed on premium canvas.
        </p>
      </div>

      <div className="mt-12">
        <PreviewClient
          previewId={preview.id}
          initialStatus={preview.status}
          initialWatermarkedUrl={preview.watermarkedUrl}
          originalUrl={preview.originalUrl}
          priceLabel={priceLabel}
          productName={DEFAULT_PRODUCT.name}
        />
      </div>

      <p className="mt-12 text-center text-xs text-ink-soft">
        Not quite right?{" "}
        <Link href="/create" className="underline">
          Try a different photo
        </Link>
        .
      </p>
    </section>
  );
}
