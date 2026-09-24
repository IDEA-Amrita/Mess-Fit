"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/admin/ocr", label: "Menu OCR" },
  { href: "/admin/messes", label: "Messes" },
  { href: "/admin/dishes", label: "Dishes" },
  { href: "/admin/analytics", label: "Usage" },
];

/** Shared chrome for /admin/* (access itself is enforced in src/proxy.ts). */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border bg-surface">
        <div className="container flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-1 py-2">
          <span className="text-xs font-bold uppercase tracking-widest text-accent">Admin</span>
          <nav aria-label="Admin" className="flex flex-1 flex-wrap items-center gap-1">
            {LINKS.map((l) => {
              const active = pathname.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold transition-colors",
                    active ? "bg-accent-muted text-accent" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
          <Link href="/dashboard" className="inline-flex min-h-11 items-center text-sm font-medium text-muted-foreground hover:text-foreground">
            ← Back to app
          </Link>
        </div>
      </header>
      {children}
    </div>
  );
}
