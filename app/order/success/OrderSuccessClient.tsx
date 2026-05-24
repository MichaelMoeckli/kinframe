"use client";

import { useEffect, useState } from "react";

type OrderState =
  | { status: "loading" }
  | { status: "ready"; orderId: string; email: string; amountLabel: string }
  | { status: "delayed" };

const POLL_INTERVAL_MS = 2000;
const MAX_ATTEMPTS = 20; // ~40s before we tell the user we'll email them

function formatAmount(cents: number, currency: string): string {
  const amount = (cents / 100).toFixed(2);
  return currency.toUpperCase() === "USD" ? `$${amount}` : `${amount} ${currency.toUpperCase()}`;
}

export function OrderSuccessClient({ sessionId }: { sessionId: string }) {
  const [state, setState] = useState<OrderState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    const tick = async (): Promise<void> => {
      attempts += 1;
      try {
        const res = await fetch(
          `/api/order?session_id=${encodeURIComponent(sessionId)}`,
          { cache: "no-store" },
        );
        if (cancelled) return;
        if (res.ok) {
          const body = (await res.json()) as {
            id: string;
            email: string;
            amountCents: number;
            currency: string;
          };
          setState({
            status: "ready",
            orderId: body.id,
            email: body.email,
            amountLabel: formatAmount(body.amountCents, body.currency),
          });
          return;
        }
      } catch {

      }
      if (attempts >= MAX_ATTEMPTS) {
        if (!cancelled) setState({ status: "delayed" });
        return;
      }
      setTimeout(tick, POLL_INTERVAL_MS);
    };

    tick();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (state.status === "loading") {
    return (
      <div className="text-center py-4">
        <div className="inline-block animate-pulse">
          <div className="h-2 w-2 rounded-full bg-frame inline-block mx-1" />
          <div className="h-2 w-2 rounded-full bg-frame inline-block mx-1" />
          <div className="h-2 w-2 rounded-full bg-frame inline-block mx-1" />
        </div>
        <p className="mt-3 text-sm text-ink-soft">Finalizing your order…</p>
      </div>
    );
  }

  if (state.status === "delayed") {
    return (
      <p className="text-sm text-ink-soft">
        Payment received. Your confirmation email is on its way — if you don&rsquo;t
        see it in a few minutes, check spam or email{" "}
        <a className="underline" href="mailto:hello@kinframe.com">
          hello@kinframe.com
        </a>{" "}
        and we&rsquo;ll sort it out.
      </p>
    );
  }

  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
      <dt className="text-ink-soft">Order</dt>
      <dd className="font-mono text-ink">{state.orderId}</dd>
      <dt className="text-ink-soft">Email</dt>
      <dd className="text-ink">{state.email}</dd>
      <dt className="text-ink-soft">Total</dt>
      <dd className="text-ink">{state.amountLabel}</dd>
    </dl>
  );
}
