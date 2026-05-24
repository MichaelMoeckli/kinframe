const steps = [
  {
    n: "01",
    title: "Upload a photo",
    body: "Pick the photo that feels like home. Anything with good light works — a family afternoon, a quiet morning, the dog included.",
  },
  {
    n: "02",
    title: "We paint it",
    body: "Our artists, working with a careful illustration process, turn your photo into a warm, painterly portrait. You see it before you buy.",
  },
  {
    n: "03",
    title: "Framed at your door",
    body: "We print it on premium canvas, frame it by hand, and ship it ready to hang. 7–10 days from order.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="bg-cream/40 border-y border-cream">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="font-display text-4xl tracking-tight text-ink max-w-xl">
          How a Kinframe is made
        </h2>
        <div className="mt-12 grid gap-10 sm:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n}>
              <div className="font-display text-3xl text-frame">{s.n}</div>
              <h3 className="mt-3 font-display text-2xl text-ink">{s.title}</h3>
              <p className="mt-3 text-ink-soft leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
