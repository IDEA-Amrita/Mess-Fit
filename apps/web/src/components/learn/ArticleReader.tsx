"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft, Clock } from "lucide-react";

interface Meta {
  slug: string;
  title: string;
  description: string;
  reading_time_min: number;
  tags: string[];
}

export interface ArticleReaderProps {
  article: Meta & { content: string };
  related: Meta[];
}

function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (node && typeof node === "object" && "props" in node) {
    return textOf((node as { props: { children?: ReactNode } }).props.children);
  }
  return "";
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

interface Heading {
  id: string;
  text: string;
  level: 2 | 3;
}

function extractHeadings(md: string): Heading[] {
  const out: Heading[] = [];
  for (const line of md.split("\n")) {
    const m = /^(#{2,3})\s+(.*)$/.exec(line.trim());
    if (m) {
      const text = m[2].trim();
      out.push({ id: slugify(text), text, level: m[1].length === 2 ? 2 : 3 });
    }
  }
  return out;
}

export function ArticleReader({ article, related }: ArticleReaderProps) {
  const [progress, setProgress] = useState(0);
  const headings = extractHeadings(article.content);

  useEffect(() => {
    function onScroll() {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      setProgress(max > 0 ? Math.min(100, (h.scrollTop / max) * 100) : 0);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen" style={{ background: "#080808" }}>
      {/* Sticky header + progress */}
      <header
        className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b px-5 backdrop-blur"
        style={{ borderColor: "rgba(255,255,255,0.07)", background: "rgba(8,8,8,0.85)" }}
      >
        <Link href="/learn" className="flex items-center gap-1.5 text-sm" style={{ color: "#888" }}>
          <ArrowLeft className="h-4 w-4" />
          Learn
        </Link>
        <div className="absolute inset-x-0 bottom-0 h-0.5" style={{ background: "rgba(255,255,255,0.05)" }}>
          <div className="h-full" style={{ width: `${progress}%`, background: "#f59e0b", transition: "width 100ms linear" }} />
        </div>
      </header>

      <div className="mx-auto flex max-w-5xl gap-8 px-6 py-10">
        {/* TOC (desktop) */}
        {headings.length > 1 && (
          <aside className="hidden w-56 shrink-0 lg:block">
            <div className="sticky top-20">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#444" }}>
                On this page
              </p>
              <nav className="flex flex-col gap-1.5">
                {headings.map((h) => (
                  <a
                    key={h.id}
                    href={`#${h.id}`}
                    className="text-sm leading-snug transition-colors"
                    style={{ color: "#666", paddingLeft: h.level === 3 ? 12 : 0 }}
                  >
                    {h.text}
                  </a>
                ))}
              </nav>
            </div>
          </aside>
        )}

        {/* Article */}
        <article className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold leading-tight" style={{ color: "#f0f0f0" }}>
            {article.title}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1 text-xs" style={{ color: "#555" }}>
              <Clock className="h-3 w-3" />
              {article.reading_time_min} min read
            </span>
            {article.tags.map((t) => (
              <span key={t} className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: "rgba(245,158,11,0.1)", color: "#b88a2e" }}>
                {t}
              </span>
            ))}
          </div>

          <div className="mt-6 space-y-4">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD}>
              {article.content}
            </ReactMarkdown>
          </div>

          {related.length > 0 && (
            <div className="mt-12 border-t pt-6" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
              <p className="mb-3 text-sm font-semibold" style={{ color: "#c0c0c0" }}>
                Related articles
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {related.map((r) => (
                  <Link
                    key={r.slug}
                    href={`/learn/${r.slug}`}
                    className="rounded-xl p-3 text-sm transition-colors"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: "#aaa" }}
                  >
                    {r.title}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </article>
      </div>
    </div>
  );
}

// Markdown element styling (dark theme, no typography plugin). h2/h3 get ids for the TOC.
const MD = {
  h2: ({ children }: { children?: ReactNode }) => (
    <h2 id={slugify(textOf(children))} className="pt-4 text-lg font-semibold" style={{ color: "#e8e8e8" }}>
      {children}
    </h2>
  ),
  h3: ({ children }: { children?: ReactNode }) => (
    <h3 id={slugify(textOf(children))} className="pt-2 text-base font-semibold" style={{ color: "#d8d8d8" }}>
      {children}
    </h3>
  ),
  p: ({ children }: { children?: ReactNode }) => (
    <p className="text-sm leading-relaxed" style={{ color: "#bdbdbd" }}>
      {children}
    </p>
  ),
  ul: ({ children }: { children?: ReactNode }) => (
    <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed" style={{ color: "#bdbdbd" }}>
      {children}
    </ul>
  ),
  ol: ({ children }: { children?: ReactNode }) => (
    <ol className="list-decimal space-y-1 pl-5 text-sm leading-relaxed" style={{ color: "#bdbdbd" }}>
      {children}
    </ol>
  ),
  strong: ({ children }: { children?: ReactNode }) => (
    <strong style={{ color: "#f0f0f0" }}>{children}</strong>
  ),
  a: ({ children, href }: { children?: ReactNode; href?: string }) => (
    <a href={href} style={{ color: "#f59e0b" }} className="underline underline-offset-2">
      {children}
    </a>
  ),
  // "Hostel context" callout — articles use a blockquote for it.
  blockquote: ({ children }: { children?: ReactNode }) => (
    <blockquote
      className="rounded-xl px-4 py-3 text-sm leading-relaxed"
      style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.18)", color: "#cbb892" }}
    >
      {children}
    </blockquote>
  ),
};
