import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { BookOpen01Icon } from "@hugeicons/core-free-icons";
import { getAllArticles } from "@/lib/articles";
import { ArticleGrid } from "@/components/learn/ArticleGrid";

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

        <ArticleGrid
          articles={articles.map(({ slug, title, description, reading_time_min, tags }) => ({
            slug,
            title,
            description,
            reading_time_min,
            tags,
          }))}
        />
      </main>
    </div>
  );
}
