import Link from "next/link";

/**
 * Site-wide footer (Phase 9, task 9.7). Rendered from the root layout so it
 * appears on every page. Links to the legal pages + the public Learn hub.
 */
export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer
      // pb-24 below lg: signed-in pages have a fixed ~68px bottom tab bar that
      // would otherwise cover these links when scrolled to the end.
      className="mt-auto border-t border-border px-6 pb-24 pt-6 text-xs text-muted-foreground lg:pb-6"
    >
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 sm:flex-row">
        <p>© {year} MessFit</p>
        <nav className="flex items-center gap-2">
          <Link href="/learn" className="rounded-md px-3 py-3 transition-colors hover:text-foreground">
            Learn
          </Link>
          <Link href="/privacy" className="rounded-md px-3 py-3 transition-colors hover:text-foreground">
            Privacy
          </Link>
          <Link href="/terms" className="rounded-md px-3 py-3 transition-colors hover:text-foreground">
            Terms
          </Link>
        </nav>
      </div>
    </footer>
  );
}
