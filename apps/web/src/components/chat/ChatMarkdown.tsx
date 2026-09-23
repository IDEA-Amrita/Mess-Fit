"use client";

import { memo, useMemo } from "react";
import Link from "next/link";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Citation } from "@/lib/chat-api";
import { prepareAnswer } from "@/lib/citations";
import { cn } from "@/lib/utils";

const CITE_HREF = /^#cite-(\d+)$/;

const MARK_CLASS =
  "relative -top-1 mx-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-md border border-indigo-400/25 bg-indigo-500/15 px-1 text-[10px] font-black text-[#818cf8] no-underline transition-colors hover:bg-indigo-500/30";

/** Inline `[Source N]` badge. Inert while the answer streams (citations unknown yet). */
function CiteMark({
  n,
  citation,
  onCitation,
}: {
  n: number;
  citation?: Citation;
  onCitation: (c: Citation) => void;
}) {
  if (!citation) {
    return (
      <span className={MARK_CLASS} aria-label={`Source ${n}`}>
        {n}
      </span>
    );
  }
  const label = `Source ${n}: ${citation.title ?? citation.source ?? "article"}`;
  return citation.slug ? (
    <Link href={`/learn/${citation.slug}`} className={MARK_CLASS} aria-label={label} title={label}>
      {n}
    </Link>
  ) : (
    <button type="button" onClick={() => onCitation(citation)} className={MARK_CLASS} aria-label={label} title={label}>
      {n}
    </button>
  );
}

/**
 * Renders an assistant answer as markdown (the model writes lists/bold) with
 * inline citation badges. react-markdown escapes raw HTML by default, so model
 * output can't inject markup.
 *
 * Memoised: the page re-renders on every streamed token, and re-parsing every
 * earlier message each time would be wasted work.
 */
export const ChatMarkdown = memo(function ChatMarkdown({
  text,
  citations,
  streaming,
  onCitation,
}: {
  text: string;
  citations?: Citation[];
  streaming?: boolean;
  onCitation: (c: Citation) => void;
}) {
  const prepared = useMemo(
    () => prepareAnswer(text, { sourceCount: citations ? citations.length : null, streaming }),
    [text, citations, streaming],
  );

  const components = useMemo<Components>(
    () => ({
      a({ href, children }) {
        const m = href?.match(CITE_HREF);
        if (m) {
          const n = Number(m[1]);
          return <CiteMark n={n} citation={citations?.[n - 1]} onCitation={onCitation} />;
        }
        return (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-accent underline underline-offset-2"
          >
            {children}
          </a>
        );
      },
      p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
      ul: ({ children }) => <ul className="mb-3 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>,
      ol: ({ children }) => <ol className="mb-3 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>,
      li: ({ children }) => <li className="pl-0.5">{children}</li>,
      strong: ({ children }) => <strong className="font-bold text-white">{children}</strong>,
      em: ({ children }) => <em className="italic">{children}</em>,
      h1: ({ children }) => <h3 className="mb-2 mt-4 text-[16px] font-bold text-white first:mt-0">{children}</h3>,
      h2: ({ children }) => <h3 className="mb-2 mt-4 text-[16px] font-bold text-white first:mt-0">{children}</h3>,
      h3: ({ children }) => <h4 className="mb-2 mt-3 text-[15px] font-bold text-white first:mt-0">{children}</h4>,
      blockquote: ({ children }) => (
        <blockquote className="mb-3 border-l-2 border-accent/50 pl-4 text-zinc-400 last:mb-0">{children}</blockquote>
      ),
      hr: () => <hr className="my-4 border-border" />,
      code: ({ className, children }) => (
        <code
          className={cn(
            "rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-[13px] text-white",
            className,
          )}
        >
          {children}
        </code>
      ),
      pre: ({ children }) => (
        <pre className="mb-3 overflow-x-auto rounded-xl border border-border bg-black/40 p-4 text-[13px] last:mb-0 [&_code]:bg-transparent [&_code]:p-0">
          {children}
        </pre>
      ),
      table: ({ children }) => (
        <div className="mb-3 overflow-x-auto last:mb-0">
          <table className="w-full border-collapse text-left text-[13px]">{children}</table>
        </div>
      ),
      th: ({ children }) => <th className="border-b border-border px-3 py-2 font-bold text-white">{children}</th>,
      td: ({ children }) => <td className="border-b border-border/50 px-3 py-2">{children}</td>,
    }),
    [citations, onCitation],
  );

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {prepared}
    </ReactMarkdown>
  );
});
