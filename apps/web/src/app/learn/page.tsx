import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { Clock01Icon, BookOpen01Icon } from "@hugeicons/core-free-icons";
import { getAllArticles } from "@/lib/articles";

export const metadata = {
  title: "Learn — MessFit",
  description: "Practical, hostel-angled nutrition and fitness articles.",
};

export default function LearnIndexPage() {
  const articles = getAllArticles();

  return (
    <div className="min-h-screen bg-background">
      <header className="flex h-16 items-center border-b border-border px-6">
        <Link href="/" className="text-lg font-bold tracking-tight">
          <span className="text-foreground">Mess</span>
          <span className="text-accent">Fit</span>
        </Link>
        <span className="ml-3 text-sm text-muted-foreground">/ Learn</span>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-muted text-accent">
            <HugeiconsIcon icon={BookOpen01Icon} className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-h1 text-foreground">Learn</h1>
            <p className="text-sm text-muted-foreground">
              Nutrition &amp; training, written for hostel life.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {articles.map((a) => (
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
                  <span
                    key={t}
                    className="rounded-full bg-accent-muted px-2 py-0.5 text-[11px] font-medium text-accent"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
