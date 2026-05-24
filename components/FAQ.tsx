const faqs = [
  {
    q: "How long does it take?",
    a: "Most orders ship within 7–10 business days. You'll see your portrait before you pay, and we'll email you a tracking link once it leaves the studio.",
  },
  {
    q: "What size and frame do I get?",
    a: "A 16×20\" canvas, hand-finished in a warm wooden frame. Ready to hang straight out of the box. More sizes coming soon.",
  },
  {
    q: "What kind of photo works best?",
    a: "Anything with good, soft light — outdoor afternoons, window light at home, a candid moment. Faces should be clearly visible. Phone photos are perfect.",
  },
  {
    q: "Will it look like us?",
    a: "Yes. The portrait is a painterly interpretation, not a photo, but the people, the warmth, and the feeling of the moment all come through.",
  },
  {
    q: "What if I don't love it?",
    a: "We'll re-do it. If you're still not happy, we'll refund you in full. The portrait is meant to live on your wall — we want you to love it.",
  },
];

export function FAQ() {
  return (
    <section className="bg-cream/40 border-y border-cream">
      <div className="mx-auto max-w-3xl px-6 py-20">
        <h2 className="font-display text-4xl tracking-tight">Questions</h2>
        <dl className="mt-10 divide-y divide-cream">
          {faqs.map((f) => (
            <div key={f.q} className="py-6">
              <dt className="font-display text-xl text-ink">{f.q}</dt>
              <dd className="mt-2 text-ink-soft leading-relaxed">{f.a}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
