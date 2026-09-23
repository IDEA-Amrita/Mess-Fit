"use client";

import { memo, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Alert01Icon,
  BookOpen01Icon,
  Copy01Icon,
  RefreshIcon,
  SparklesIcon,
  Tick01Icon,
} from "@hugeicons/core-free-icons";
import type { Citation } from "@/lib/chat-api";
import { groupCitations, stripMarkers } from "@/lib/citations";
import { spring } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { ChatMarkdown } from "./ChatMarkdown";
import type { Msg } from "./types";

const CHIP_CLASS =
  "flex items-center gap-1.5 rounded-full border border-indigo-400/20 bg-indigo-500/15 px-3 py-1 text-[11px] font-bold text-[#818cf8] transition-transform hover:-translate-y-0.5";

function AssistantAvatar() {
  return (
    <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-accent/20 bg-accent/10 text-accent">
      <HugeiconsIcon icon={SparklesIcon} className="h-4 w-4" />
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
        } catch {
          /* clipboard blocked (insecure context / permissions) — nothing useful to do */
        }
      }}
      aria-label={copied ? "Copied" : "Copy answer"}
      className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-bold text-muted-foreground transition-colors hover:bg-white/5 hover:text-white"
    >
      <HugeiconsIcon icon={copied ? Tick01Icon : Copy01Icon} className={cn("h-3.5 w-3.5", copied && "text-accent")} />
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function SourceChips({ citations, onCitation }: { citations: Citation[]; onCitation: (c: Citation) => void }) {
  const groups = groupCitations(citations);
  if (groups.length === 0) return null;
  return (
    <div className="mt-4 flex flex-wrap gap-2 border-t border-white/5 pt-3" aria-label="Sources">
      {groups.map((g) => {
        // Label with the source numbers the answer's inline [N] badges use.
        const label = `${g.numbers.join(", ")} · ${g.citation.title ?? g.citation.source ?? "Source"}`;
        return g.citation.slug ? (
          <Link key={g.key} href={`/learn/${g.citation.slug}`} className={CHIP_CLASS}>
            <HugeiconsIcon icon={BookOpen01Icon} className="h-3.5 w-3.5" />
            {label}
          </Link>
        ) : (
          <button key={g.key} type="button" onClick={() => onCitation(g.citation)} className={CHIP_CLASS}>
            <HugeiconsIcon icon={BookOpen01Icon} className="h-3.5 w-3.5" />
            {label}
          </button>
        );
      })}
    </div>
  );
}

function Notice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="mt-2 flex flex-wrap items-center gap-2 text-[12px] font-medium text-[#FF6B60]">
      <HugeiconsIcon icon={Alert01Icon} className="h-4 w-4 shrink-0" />
      <span>{message}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-1 font-bold text-white transition-colors hover:bg-white/10"
        >
          <HugeiconsIcon icon={RefreshIcon} className="h-3.5 w-3.5" />
          Retry
        </button>
      )}
    </div>
  );
}

/** Shown between sending and the first token — retrieval + embedding take a moment. */
export function ThinkingBubble() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      // No exit animation on purpose: it must vanish the instant the first token
      // arrives, otherwise it overlaps the answer bubble and shifts the layout.
      transition={spring.soft}
      className="flex gap-3"
      role="status"
      aria-label="Coach is thinking"
    >
      <AssistantAvatar />
      <div className="flex items-center gap-3 rounded-3xl rounded-tl-sm border border-white/8 bg-white/3 px-5 py-4">
        <span className="flex gap-1" aria-hidden>
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="h-2 w-2 rounded-full bg-accent"
              animate={{ y: [0, -5, 0], opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
            />
          ))}
        </span>
        <span className="text-[13px] font-medium text-muted-foreground">Searching the knowledge base…</span>
      </div>
    </motion.div>
  );
}

/**
 * One chat message. Memoised (with stable callbacks from the page) so streaming
 * a new token re-renders only the streaming bubble, not the whole history.
 */
export const ChatBubble = memo(function ChatBubble({
  msg,
  streaming,
  onCitation,
  onRetry,
}: {
  msg: Msg;
  streaming?: boolean;
  onCitation: (c: Citation) => void;
  onRetry?: (id: string) => void;
}) {
  const isUser = msg.role === "user";

  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring.soft}
        className="flex flex-col items-end"
      >
        <div
          className={cn(
            "max-w-[85%] whitespace-pre-wrap rounded-3xl rounded-tr-sm border px-5 py-3.5 text-[15px] leading-relaxed text-white shadow-sm",
            msg.status === "failed" ? "border-[#FF3B30]/40 bg-[#FF3B30]/10" : "border-accent/20 bg-accent/10",
          )}
        >
          {msg.content}
        </div>
        {msg.status === "failed" && (
          <Notice message={msg.error ?? "Couldn't send."} onRetry={onRetry ? () => onRetry(msg.id) : undefined} />
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring.soft}
      className="group flex gap-3"
    >
      <AssistantAvatar />
      <div className="min-w-0 max-w-[85%]">
        <div className="rounded-3xl rounded-tl-sm border border-white/8 bg-white/3 px-5 py-4 text-[15px] leading-relaxed text-zinc-300 shadow-sm">
          <ChatMarkdown text={msg.content} citations={msg.citations} streaming={streaming} onCitation={onCitation} />
          {streaming && <span className="animate-caret ml-0.5 inline-block text-accent">▌</span>}
          {msg.citations && msg.citations.length > 0 && <SourceChips citations={msg.citations} onCitation={onCitation} />}
        </div>

        {msg.status === "stopped" && (
          <p className="mt-2 text-[12px] font-medium text-muted-foreground">Stopped. This reply wasn&apos;t saved.</p>
        )}
        {msg.status === "interrupted" && (
          <Notice
            message={msg.error ?? "The connection dropped before the answer finished."}
            onRetry={onRetry ? () => onRetry(msg.id) : undefined}
          />
        )}

        {!streaming && msg.content.trim() && (
          <div className="mt-1 flex opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
            <CopyButton text={stripMarkers(msg.content)} />
          </div>
        )}
      </div>
    </motion.div>
  );
});
