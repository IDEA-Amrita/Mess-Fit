import Link from "next/link";

/**
 * Site-wide footer (Phase 9, task 9.7). Rendered from the root layout so it
 * appears on every page. Links to the legal pages + the public Learn hub.
 */
export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer
      className="mt-auto border-t px-6 py-6 text-xs"
      style={{ borderColor: "rgba(255,255,255,0.07)", color: "#555" }}
    >
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 sm:flex-row">
        <p>© {year} MessFit</p>
        <nav className="flex items-center gap-5">
          <Link href="/learn" className="transition-colors hover:text-neutral-300">
            Learn
          </Link>
          <Link href="/privacy" className="transition-colors hover:text-neutral-300">
            Privacy
          </Link>
          <Link href="/terms" className="transition-colors hover:text-neutral-300">
            Terms
          </Link>
        </nav>
      </div>
    </footer>
  );
}
