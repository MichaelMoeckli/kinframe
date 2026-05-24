export function BeforeAfter() {
  return (
    <div className="grid grid-cols-2 gap-4">
      <figure className="space-y-2">
        <div
          className="aspect-[4/5] rounded-lg bg-gradient-to-br from-zinc-200 to-zinc-400 shadow-sm"
          role="img"
          aria-label="Photo placeholder"
        />
        <figcaption className="text-xs uppercase tracking-wider text-ink-soft text-center">
          Your photo
        </figcaption>
      </figure>
      <figure className="space-y-2">
        <div
          className="aspect-[4/5] rounded-lg bg-gradient-to-br from-amber-100 via-orange-200 to-rose-300 shadow-md ring-8 ring-frame/80 ring-offset-2 ring-offset-paper"
          role="img"
          aria-label="Painted portrait placeholder"
        />
        <figcaption className="text-xs uppercase tracking-wider text-frame text-center">
          Your Kinframe
        </figcaption>
      </figure>
    </div>
  );
}
