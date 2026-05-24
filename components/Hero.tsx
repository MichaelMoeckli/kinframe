import Link from "next/link";
import { BeforeAfter } from "./BeforeAfter";

export function Hero() {
  return (
    <section className="mx-auto max-w-6xl px-6 pt-20 pb-24 grid gap-16 lg:grid-cols-2 lg:items-center">
      <div>
        <p className="text-sm uppercase tracking-[0.18em] text-frame">
          Hand-illustrated portraits
        </p>
        <h1 className="mt-5 font-display text-5xl sm:text-6xl leading-[1.05] tracking-tight text-ink">
          A painting of your family,
          <br />
          <span className="italic text-frame-dark">for your wall.</span>
        </h1>
        <p className="mt-6 text-lg text-ink-soft max-w-md leading-relaxed">
          Send us your favorite photo. We&rsquo;ll paint it in a warm, storybook style,
          frame it on premium canvas, and ship it to your door.
        </p>
        <div className="mt-8 flex items-center gap-4">
          <Link
            href="/create"
            className="rounded-full bg-frame px-7 py-3.5 text-paper text-base hover:bg-frame-dark transition-colors"
          >
            Make your portrait
          </Link>
          <Link
            href="/#gallery"
            className="text-sm text-ink-soft hover:text-ink transition-colors underline underline-offset-4"
          >
            See the gallery
          </Link>
        </div>
        <p className="mt-5 text-sm text-ink-soft">
          From $99 · Framed canvas · Ships in 7–10 days
        </p>
      </div>
      <div className="lg:pl-8">
        <BeforeAfter />
      </div>
    </section>
  );
}
