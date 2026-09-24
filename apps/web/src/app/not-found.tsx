import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-sm font-bold uppercase tracking-widest text-accent">404</p>
      <h1 className="text-h1 text-foreground">We couldn&apos;t find that page</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        The link may be old or mistyped. Head back and pick up where you left off.
      </p>
      <div className="mt-2 flex items-center gap-4">
        <Link
          href="/dashboard"
          className="rounded-full bg-accent px-6 py-3 text-[12px] font-black uppercase tracking-widest text-black transition-[filter] hover:brightness-110"
        >
          Go to dashboard
        </Link>
        <Link href="/" className="text-sm font-medium text-muted-foreground hover:text-foreground">
          Home
        </Link>
      </div>
    </main>
  );
}
