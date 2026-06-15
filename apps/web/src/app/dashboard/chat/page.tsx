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
      <header
        className="flex h-16 shrink-0 items-center justify-between border-b px-6"
        style={{ borderColor: "rgba(255,255,255,0.07)" }}
      >
        <div>
          <h1 className="text-base font-semibold" style={{ color: "#f0f0f0" }}>
            Coach
          </h1>
          <p className="text-xs" style={{ color: "#444" }}>
            AI assistant · not medical advice
          </p>
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
      <div
        className="flex h-14 w-14 items-center justify-center rounded-2xl"
        style={{ background: "rgba(245,158,11,0.1)" }}
      >
        <Sparkles className="h-7 w-7" style={{ color: "#f59e0b" }} />
      </div>
      <div>
        <p className="font-semibold" style={{ color: "#d0d0d0" }}>
          Ask your nutrition & fitness coach
        </p>
        <p className="mt-1 text-sm" style={{ color: "#555" }}>
          Grounded in curated sources. Not a substitute for a doctor.
        </p>
      </div>
      <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="rounded-xl px-4 py-3 text-left text-sm transition-colors"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: "#aaa" }}
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
        className="max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed"
        style={
          isUser
            ? { background: "rgba(245,158,11,0.14)", color: "#f0e0c0" }
            : { background: "rgba(255,255,255,0.04)", color: "#d8d8d8", border: "1px solid rgba(255,255,255,0.06)" }
        }
      >
        <p className="whitespace-pre-wrap">
          {msg.content}
          {streaming && <span className="ml-0.5 animate-pulse">▌</span>}
        </p>
        {msg.citations && msg.citations.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {dedupeCitations(msg.citations).map((c, i) => {
              const label = `${i + 1}. ${c.title ?? c.source ?? "Source"}`;
              const chipStyle = {
                background: "rgba(129,140,248,0.12)",
                color: "#818cf8",
              };
              // Curated articles deep-link to their /learn page; anything else
              // opens the lightweight source modal.
              return c.slug ? (
                <Link
                  key={c.chunk_id}
                  href={`/learn/${c.slug}`}
                  className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                  style={chipStyle}
                >
                  <BookOpen className="h-3 w-3" />
                  {label}
                </Link>
              ) : (
                <button
                  key={c.chunk_id}
                  onClick={() => onCitation(c)}
                  className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                  style={chipStyle}
                >
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
    <div className="shrink-0 border-t p-4" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
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
          className="flex-1 resize-none rounded-xl px-4 py-3 text-sm outline-none"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#e8e8e8", maxHeight: 120 }}
        />
        <button
          onClick={onSend}
          disabled={busy || !value.trim()}
          aria-label="Send"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors disabled:opacity-40"
          style={{ background: "#f59e0b", color: "#1a1300" }}
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.8)" }}
      onClick={onClose}
      role="dialog"
      aria-label="Source"
    >
      <div
        className="w-full max-w-md rounded-2xl p-5"
        style={{ background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" style={{ color: "#818cf8" }} />
            <p className="text-sm font-semibold" style={{ color: "#e8e8e8" }}>
              {citation.title ?? "Source"}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ color: "#888" }}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-2 text-xs uppercase tracking-wider" style={{ color: "#555" }}>
          {citation.source ?? "knowledge base"}
        </p>
        <p className="mt-3 text-xs leading-relaxed" style={{ color: "#666" }}>
          This answer drew on the curated MessFit knowledge base. Full article text is
          available in the knowledge base under this title.
        </p>
      </div>
    </div>
  );
}
