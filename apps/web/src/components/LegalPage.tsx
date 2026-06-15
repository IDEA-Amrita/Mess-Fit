import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Shared shell for the public legal pages (Phase 9, task 9.7): a centered,
 * readable column on the dark theme with a back link and a "last updated" line.
 */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16">
      <Link
        href="/"
        className="text-xs transition-colors hover:text-neutral-300"
        style={{ color: "#666" }}
      >
        ← MessFit
      </Link>
      <h1 className="mt-6 text-3xl font-semibold" style={{ color: "#ededed" }}>
        {title}
      </h1>
      <p className="mt-2 text-xs" style={{ color: "#555" }}>
        Last updated {updated}
      </p>
      <div
        className="legal-prose mt-8 flex flex-col gap-5 text-sm leading-relaxed"
        style={{ color: "#b5b5b5" }}
      >
        {children}
      </div>
    </main>
  );
}

/** A titled section used inside LegalPage. */
export function LegalSection({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-base font-semibold" style={{ color: "#e0e0e0" }}>
        {heading}
      </h2>
      {children}
    </section>
  );
}
