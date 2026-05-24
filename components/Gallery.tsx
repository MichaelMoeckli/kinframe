const tiles = [
  { tone: "from-amber-100 via-orange-200 to-rose-300" },
  { tone: "from-emerald-100 via-teal-200 to-amber-200" },
  { tone: "from-rose-100 via-amber-200 to-orange-300" },
  { tone: "from-sky-100 via-cyan-100 to-amber-200" },
  { tone: "from-amber-200 via-rose-200 to-pink-300" },
  { tone: "from-orange-100 via-amber-100 to-yellow-200" },
];

export function Gallery() {
  return (
    <section id="gallery" className="mx-auto max-w-6xl px-6 py-20">
      <div className="max-w-2xl">
        <p className="text-sm uppercase tracking-[0.18em] text-frame">Gallery</p>
        <h2 className="mt-3 font-display text-4xl tracking-tight">
          A few portraits we&rsquo;ve made
        </h2>
        <p className="mt-4 text-ink-soft leading-relaxed">
          Every Kinframe is unique to the family in it. Here are some recent pieces &mdash;
          painted from real photos, framed and on walls around the country.
        </p>
      </div>
      <div className="mt-10 grid grid-cols-2 md:grid-cols-3 gap-4">
        {tiles.map((t, i) => (
          <div
            key={i}
            className={`aspect-[4/5] rounded-lg bg-gradient-to-br ${t.tone} ring-4 ring-frame/70 ring-offset-2 ring-offset-paper`}
            role="img"
            aria-label={`Portrait gallery placeholder ${i + 1}`}
          />
        ))}
      </div>
    </section>
  );
}
