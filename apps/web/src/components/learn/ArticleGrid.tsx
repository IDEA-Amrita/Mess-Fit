"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { Clock01Icon, Search01Icon } from "@hugeicons/core-free-icons";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

export type ArticleCard = {
  slug: string;
  title: string;
  description: string;
  reading_time_min: number;
  tags: string[];
};

/** Searchable, tag-filterable article list for /learn. */
export function ArticleGrid({ articles }: { articles: ArticleCard[] }) {
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<string | null>(null);

  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of articles) for (const t of a.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t);
  }, [articles]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return articles.filter(
      (a) =>
        (!tag || a.tags.includes(tag)) &&
        (!q || `${a.title} ${a.description} ${a.tags.join(" ")}`.toLowerCase().includes(q)),
    );
  }, [articles, query, tag]);

  return (
    <>
      <div className="mb-5 space-y-3">
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 focus-within:border-accent">
          <HugeiconsIcon icon={Search01Icon} size={16} className="text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search articles"
            placeholder="Search articles…"
            className="h-11 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="flex flex-wrap gap-2.5" role="group" aria-label="Filter by topic">
          {tags.map((t) => (
            <button
              key={t}
              onClick={() => setTag(tag === t ? null : t)}
              aria-pressed={tag === t}
              className={cn(
                "rounded-full px-3.5 py-2 text-xs font-medium transition-colors",
                tag === t ? "bg-accent text-accent-foreground" : "bg-accent-muted text-accent hover:brightness-125",
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <p className="sr-only" role="status">
        {shown.length} {shown.length === 1 ? "article" : "articles"} shown
      </p>

      {shown.length === 0 ? (
        <EmptyState
          title="No articles match"
          description="Try a different search or clear the topic filter."
          action={
            <button
              onClick={() => {
                setQuery("");
                setTag(null);
              }}
              className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-foreground hover:bg-white/15"
            >
              Clear filters
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {shown.map((a) => (
            <Link
              key={a.slug}
              href={`/learn/${a.slug}`}
              className="flex flex-col gap-2 rounded-xl border border-border bg-card p-5 transition-colors hover:border-border/70"
            >
              <h2 className="font-semibold leading-snug text-foreground">{a.title}</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">{a.description}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <HugeiconsIcon icon={Clock01Icon} className="h-3 w-3" />
                  {a.reading_time_min} min
                </span>
                {a.tags.slice(0, 3).map((t) => (
                  <span key={t} className="rounded-full bg-accent-muted px-2 py-0.5 text-[11px] font-medium text-accent">
                    {t}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
