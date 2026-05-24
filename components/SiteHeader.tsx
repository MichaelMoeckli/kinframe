import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b border-cream/80">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link
          href="/"
          className="font-display text-2xl tracking-tight text-ink"
          aria-label="Kinframe — home"
        >
          Kinframe
        </Link>
        <nav className="flex items-center gap-8 text-sm text-ink-soft">
          <Link href="/#how" className="hover:text-ink transition-colors">
            How it works
          </Link>
          <Link href="/#gallery" className="hover:text-ink transition-colors">
            Gallery
          </Link>
          <Link
            href="/create"
            className="rounded-full bg-frame px-5 py-2 text-paper hover:bg-frame-dark transition-colors"
          >
            Make yours
          </Link>
        </nav>
      </div>
    </header>
  );
}
