"use client";

import { useActionState } from "react";
import { submitEmailSignup, type SignupState } from "@/app/actions/signup";

const initial: SignupState = { status: "idle" };

export function EmailSignup({ source = "landing-footer" }: { source?: string }) {
  const [state, formAction, pending] = useActionState(submitEmailSignup, initial);

  return (
    <section className="mx-auto max-w-3xl px-6 py-20 text-center">
      <h2 className="font-display text-3xl sm:text-4xl tracking-tight">
        Not ready to order yet?
      </h2>
      <p className="mt-3 text-ink-soft">
        Leave your email and we&rsquo;ll send you a small token of thanks &mdash; and a
        reminder when you&rsquo;re ready.
      </p>
      <form
        action={formAction}
        className="mt-8 flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
      >
        <input type="hidden" name="source" value={source} />
        <input
          type="email"
          name="email"
          required
          placeholder="you@example.com"
          aria-label="Email"
          className="flex-1 rounded-full border border-cream bg-paper px-5 py-3 text-ink placeholder:text-ink-soft/60 focus:outline-none focus:ring-2 focus:ring-frame"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-frame px-6 py-3 text-paper hover:bg-frame-dark transition-colors disabled:opacity-50"
        >
          {pending ? "Sending…" : "Keep me posted"}
        </button>
      </form>
      {state.status === "success" && (
        <p className="mt-4 text-sm text-frame-dark">
          Thanks — we&rsquo;ll be in touch.
        </p>
      )}
      {state.status === "error" && (
        <p className="mt-4 text-sm text-red-700" role="alert">
          {state.message}
        </p>
      )}
    </section>
  );
}
