"use client";

import { useEffect, useState } from "react";

type Status = "pending" | "generating" | "ready" | "failed";

type Props = {
  previewId: string;
  initialStatus: Status;
  initialWatermarkedUrl: string | null;
  originalUrl: string;
  priceLabel: string;
  productName: string;
  /** width / height, e.g. 0.8 for a 16×20" portrait canvas. */
  aspectRatio: number;
  /** Human label like "16×20"" — shown next to the framed preview. */
  dimensionsLabel: string;
};

export function PreviewClient({
  previewId,
  initialStatus,
  initialWatermarkedUrl,
  originalUrl,
  priceLabel,
  productName,
  aspectRatio,
  dimensionsLabel,
}: Props) {
  const [status, setStatus] = useState<Status>(initialStatus);
  const [watermarkedUrl, setWatermarkedUrl] = useState<string | null>(
    initialWatermarkedUrl,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);

  useEffect(() => {
    if (status === "ready" || status === "failed") return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/preview/${previewId}/status`, { cache: "no-store" });
        if (!res.ok) return;
        const body = (await res.json()) as {
          status: Status;
          watermarkedUrl: string | null;
          errorMessage: string | null;
        };
        if (cancelled) return;
        setStatus(body.status);
        setWatermarkedUrl(body.watermarkedUrl);
        setErrorMessage(body.errorMessage);
      } catch {

      }
    };
    const interval = setInterval(tick, 2500);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [previewId, status]);

  async function onCheckout() {
    setCheckingOut(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ previewId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `Checkout failed (${res.status})`);
      }
      const { url } = (await res.json()) as { url: string };
      window.location.href = url;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Couldn't start checkout.";
      setErrorMessage(msg);
      setCheckingOut(false);
    }
  }

  if (status === "failed") {
    return (
      <div className="text-center max-w-md mx-auto py-12">
        <p className="text-ink">We couldn&rsquo;t paint that one.</p>
        <p className="mt-2 text-sm text-ink-soft">
          {errorMessage ?? "Try a different photo with clearer faces and better light."}
        </p>
        <a
          href="/create"
          className="mt-6 inline-block rounded-full bg-frame px-6 py-3 text-paper hover:bg-frame-dark"
        >
          Try another photo
        </a>
      </div>
    );
  }

  if (status !== "ready" || !watermarkedUrl) {
    return (
      <div className="mx-auto max-w-md py-16">
        <div
          className="mx-auto rounded-lg bg-cream/40 ring-1 ring-cream flex items-center justify-center"
          style={{ aspectRatio, width: "min(100%, 360px)" }}
        >
          <div>
            <div className="text-center animate-pulse">
              <div className="h-2 w-2 rounded-full bg-frame inline-block mx-1" />
              <div className="h-2 w-2 rounded-full bg-frame inline-block mx-1" />
              <div className="h-2 w-2 rounded-full bg-frame inline-block mx-1" />
            </div>
            <p className="mt-4 font-display text-2xl text-center">Painting your portrait…</p>
            <p className="mt-2 text-sm text-ink-soft text-center px-4">
              This usually takes about a minute. Keep this tab open.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr] items-start">
      <figure
        className="rounded-lg overflow-hidden bg-cream/40 ring-1 ring-cream shadow-sm relative"
        style={{ aspectRatio }}
      >
        { }
        <img
          src={watermarkedUrl}
          alt="Your Kinframe preview"
          className="absolute inset-0 w-full h-full object-cover"
        />
      </figure>
      <div>
        <h2 className="font-display text-3xl tracking-tight">{productName}</h2>
        <p className="mt-3 text-ink-soft leading-relaxed">
          Hand-finished frame, premium canvas, ready to hang. The portrait above is shown at
          the exact {dimensionsLabel} framing that will be printed — same crop, same proportions.
          The light overlay is removed and resolution upscaled to gallery quality before printing.
        </p>
        <div className="mt-6">
          <div className="font-display text-3xl text-frame-dark">{priceLabel}</div>
          <p className="text-sm text-ink-soft mt-1">Free shipping. Ships in 7–10 days.</p>
        </div>
        <button
          type="button"
          onClick={onCheckout}
          disabled={checkingOut}
          className="mt-8 w-full rounded-full bg-frame px-6 py-3.5 text-paper hover:bg-frame-dark transition-colors disabled:opacity-50"
        >
          {checkingOut ? "Opening checkout…" : "Order my framed portrait"}
        </button>
        {errorMessage && (
          <p className="mt-4 text-sm text-red-700" role="alert">
            {errorMessage}
          </p>
        )}
        <details className="mt-8 text-sm text-ink-soft">
          <summary className="cursor-pointer hover:text-ink">Compare with original</summary>
          <div className="mt-3">
            { }
            <img src={originalUrl} alt="Original photo" className="rounded w-full h-auto" />
          </div>
        </details>
      </div>
    </div>
  );
}
