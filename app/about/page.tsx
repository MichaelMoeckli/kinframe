import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About — Kinframe",
};

export default function AboutPage() {
  return (
    <article className="mx-auto max-w-2xl px-6 py-20 prose-ink">
      <h1 className="font-display text-4xl tracking-tight">About Kinframe</h1>
      <p className="mt-6 text-lg text-ink-soft leading-relaxed">
        Kinframe makes hand-illustrated family portraits, painted from your favorite
        photo and framed on premium canvas. We started Kinframe because the photos that
        matter most usually live on a phone &mdash; and a phone is not a wall.
      </p>
      <p className="mt-4 text-ink-soft leading-relaxed">
        Each portrait is made with care, framed by hand, and shipped ready to hang. It&rsquo;s
        a small studio idea: take the moments that already mean something, and turn them
        into the kind of object you keep.
      </p>
    </article>
  );
}
