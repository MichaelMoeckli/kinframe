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
};

export function PreviewClient({
  previewId,
  initialStatus,
  initialWatermarkedUrl,
  originalUrl,
  priceLabel,
  productName,
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
      <div className="text-center max-w-md mx-auto py-16">
        <div className="inline-block animate-pulse">
          <div className="h-2 w-2 rounded-full bg-frame inline-block mx-1" />
          <div className="h-2 w-2 rounded-full bg-frame inline-block mx-1" />
          <div className="h-2 w-2 rounded-full bg-frame inline-block mx-1" />
        </div>
        <p className="mt-4 font-display text-2xl">Painting your portrait…</p>
        <p className="mt-2 text-sm text-ink-soft">
          This usually takes about a minute. Keep this tab open.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr] items-start">
      <figure className="rounded-lg overflow-hidden bg-cream/40 ring-1 ring-cream shadow-sm">
        { }
        <img src={watermarkedUrl} alt="Your Kinframe preview" className="w-full h-auto" />
      </figure>
      <div>
        <h2 className="font-display text-3xl tracking-tight">{productName}</h2>
        <p className="mt-3 text-ink-soft leading-relaxed">
          Hand-finished frame, premium canvas, ready to hang. The portrait above is a low-res
          preview with an overlay — what arrives at your door is sharp, clean, and printed at
          gallery quality.
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
