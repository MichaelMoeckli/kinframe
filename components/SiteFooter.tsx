import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-cream/80 bg-cream/30">
      <div className="mx-auto max-w-6xl px-6 py-12 grid gap-10 sm:grid-cols-3">
        <div>
          <div className="font-display text-xl tracking-tight">Kinframe</div>
          <p className="mt-3 text-sm text-ink-soft max-w-xs">
            A painting of your family, for your wall. Made from your favorite photo,
            framed and shipped to your door.
          </p>
        </div>
        <div className="text-sm">
          <div className="font-medium mb-3">Company</div>
          <ul className="space-y-2 text-ink-soft">
            <li>
              <Link href="/about" className="hover:text-ink">
                About
              </Link>
            </li>
            <li>
              <Link href="/shipping" className="hover:text-ink">
                Shipping &amp; returns
              </Link>
            </li>
          </ul>
        </div>
        <div className="text-sm">
          <div className="font-medium mb-3">Fine print</div>
          <ul className="space-y-2 text-ink-soft">
            <li>
              <Link href="/privacy" className="hover:text-ink">
                Privacy
              </Link>
            </li>
            <li>
              <Link href="/terms" className="hover:text-ink">
                Terms
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-6 pb-8 text-xs text-ink-soft">
        © {new Date().getFullYear()} Kinframe. Hand-illustrated portraits, made with care.
      </div>
    </footer>
  );
}
