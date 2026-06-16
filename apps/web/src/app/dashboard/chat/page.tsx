"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Send, Sparkles, BookOpen, X } from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { toast } from "@/lib/toast-store";
import { ApiError } from "@/lib/api";
import {
  createConversation,
  streamMessage,
  type ChatMessage,
  type Citation,
} from "@/lib/chat-api";

const SUGGESTIONS = [
  "Cheap protein sources in India?",
  "How do I bulk on a hostel mess?",
  "Why does progressive overload matter?",
  "Is creatine safe to take?",
];

type Msg = { role: "user" | "assistant"; content: string; citations?: Citation[] };

// Multiple retrieved chunks can come from the same article; show each source once.
function dedupeCitations(citations: Citation[]): Citation[] {
  const seen = new Set<string>();
  const out: Citation[] = [];
  for (const c of citations) {
    const key = c.slug ?? c.title ?? c.chunk_id;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [streaming, setStreaming] = useState("");
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const [convId, setConvId] = useState<string | null>(null);
  const [openCitation, setOpenCitation] = useState<Citation | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    setInput("");
    setBusy(true);
    setMessages((m) => [...m, { role: "user", content }]);
    setStreaming("");

    try {
      let id = convId;
      if (!id) {
        id = (await createConversation()).id;
        setConvId(id);
      }
      let acc = "";
      await streamMessage(id, content, {
        onToken: (t) => {
          acc += t;
          setStreaming(acc);
        },
        onDone: (citations) => {
          setMessages((m) => [...m, { role: "assistant", content: acc, citations }]);
          setStreaming("");
        },
      });
    } catch (err) {
      const detail = err instanceof ApiError ? err.detail : "Something went wrong.";
      toast.error(detail);
      setStreaming("");
    } finally {
      setBusy(false);
    }
  }

  const empty = messages.length === 0 && !streaming;

  return (
    <DashboardShell>
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-border px-6">
        <div>
          <h1 className="text-base font-semibold text-foreground">Coach</h1>
          <p className="text-xs text-muted-foreground">AI assistant · not medical advice</p>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6">
        {empty ? (
          <EmptyState onPick={send} />
        ) : (
          <div className="mx-auto flex max-w-2xl flex-col gap-4">
            {messages.map((m, i) => (
              <ChatBubble key={i} msg={m} onCitation={setOpenCitation} />
            ))}
            {streaming && (
              <ChatBubble msg={{ role: "assistant", content: streaming }} streaming onCitation={setOpenCitation} />
            )}
          </div>
        )}
      </div>

      <ChatInput value={input} onChange={setInput} onSend={() => send(input)} busy={busy} />

      {openCitation && (
        <CitationModal citation={openCitation} onClose={() => setOpenCitation(null)} />
      )}
    </DashboardShell>
  );
}

// ── components ────────────────────────────────────────────────────────────────

function EmptyState({ onPick }: { onPick: (t: string) => void }) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center justify-center gap-5 pt-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-muted text-accent">
        <Sparkles className="h-7 w-7" />
      </div>
      <div>
        <p className="font-semibold text-foreground">Ask your nutrition &amp; fitness coach</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Grounded in curated sources. Not a substitute for a doctor.
        </p>
      </div>
      <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="rounded-xl border border-border bg-surface-2 px-4 py-3 text-left text-sm text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function ChatBubble({
  msg,
  streaming,
  onCitation,
}: {
  msg: Msg;
  streaming?: boolean;
  onCitation: (c: Citation) => void;
}) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? "border border-accent/20 bg-accent-muted text-foreground"
            : "border border-border bg-surface-2 text-foreground/90"
        }`}
      >
        <p className="whitespace-pre-wrap">
          {msg.content}
          {streaming && <span className="ml-0.5 animate-pulse text-accent">▌</span>}
        </p>
        {msg.citations && msg.citations.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {dedupeCitations(msg.citations).map((c, i) => {
              const label = `${i + 1}. ${c.title ?? c.source ?? "Source"}`;
              // Citations use indigo to read as "source", distinct from the amber UI.
              const chipClass =
                "flex items-center gap-1 rounded-full bg-indigo-500/10 px-2 py-0.5 text-[11px] font-medium text-indigo-400 transition-colors hover:bg-indigo-500/20";
              // Curated articles deep-link to their /learn page; anything else
              // opens the lightweight source modal.
              return c.slug ? (
                <Link key={c.chunk_id} href={`/learn/${c.slug}`} className={chipClass}>
                  <BookOpen className="h-3 w-3" />
                  {label}
                </Link>
              ) : (
                <button key={c.chunk_id} onClick={() => onCitation(c)} className={chipClass}>
                  <BookOpen className="h-3 w-3" />
                  {label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ChatInput({
  value,
  onChange,
  onSend,
  busy,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  busy: boolean;
}) {
  return (
    <div className="shrink-0 border-t border-border p-4">
      <div className="mx-auto flex max-w-2xl items-end gap-2">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          rows={1}
          aria-label="Message"
          placeholder="Ask about nutrition or training…"
          className="max-h-30 flex-1 resize-none rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-ring"
        />
        <button
          onClick={onSend}
          disabled={busy || !value.trim()}
          aria-label="Send"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground transition-colors hover:brightness-110 disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function CitationModal({ citation, onClose }: { citation: Citation; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
      role="dialog"
      aria-label="Source"
    >
      <div
        className="mf-rise w-full max-w-md rounded-2xl border border-border bg-popover p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-indigo-400" />
            <p className="text-sm font-semibold text-foreground">
              {citation.title ?? "Source"}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-2 text-xs uppercase tracking-wider text-muted-foreground/60">
          {citation.source ?? "knowledge base"}
        </p>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          This answer drew on the curated MessFit knowledge base. Full article text is
          available in the knowledge base under this title.
        </p>
      </div>
    </div>
  );
}
