import Link from "next/link";
import { Clock, BookOpen } from "lucide-react";
import { getAllArticles } from "@/lib/articles";

export const metadata = {
  title: "Learn — MessFit",
  description: "Practical, hostel-angled nutrition and fitness articles.",
};

export default function LearnIndexPage() {
  const articles = getAllArticles();

  return (
    <div className="min-h-screen" style={{ background: "#080808" }}>
      <header
        className="flex h-16 items-center border-b px-6"
        style={{ borderColor: "rgba(255,255,255,0.07)" }}
      >
        <Link href="/" className="text-lg font-bold">
          <span style={{ color: "#f0f0f0" }}>Mess</span>
          <span style={{ color: "#f59e0b" }}>Fit</span>
        </Link>
        <span className="ml-3 text-sm" style={{ color: "#555" }}>
          / Learn
        </span>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="mb-8 flex items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-2xl"
            style={{ background: "rgba(245,158,11,0.1)" }}
          >
            <BookOpen className="h-5 w-5" style={{ color: "#f59e0b" }} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: "#f0f0f0" }}>
              Learn
            </h1>
            <p className="text-sm" style={{ color: "#555" }}>
              Nutrition & training, written for hostel life.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {articles.map((a) => (
            <Link
              key={a.slug}
              href={`/learn/${a.slug}`}
              className="flex flex-col gap-2 rounded-2xl p-5 transition-colors"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <h2 className="font-semibold leading-snug" style={{ color: "#e8e8e8" }}>
                {a.title}
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: "#666" }}>
                {a.description}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1 text-xs" style={{ color: "#555" }}>
                  <Clock className="h-3 w-3" />
                  {a.reading_time_min} min
                </span>
                {a.tags.slice(0, 3).map((t) => (
                  <span
                    key={t}
                    className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                    style={{ background: "rgba(245,158,11,0.1)", color: "#b88a2e" }}
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
