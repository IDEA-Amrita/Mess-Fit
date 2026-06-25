"use client";
import { HugeiconsIcon } from "@hugeicons/react";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  SentIcon,
  SparklesIcon,
  BookOpen01Icon,
  Cancel01Icon,
  Add01Icon,
  Message01Icon,
  Menu01Icon,
  PencilEdit01Icon,
  Tick01Icon,
} from "@hugeicons/core-free-icons";
import { DashboardShell } from "@/components/DashboardShell";
import { toast } from "@/lib/toast-store";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  createConversation,
  listConversations,
  getMessages,
  renameConversation,
  streamMessage,
  type ChatMessage,
  type Conversation,
  type Citation,
} from "@/lib/chat-api";

const SUGGESTIONS = [
  "Cheap protein sources in India?",
  "How do I bulk on a hostel mess?",
  "Why does progressive overload matter?",
  "Is creatine safe to take?",
];

type Msg = { role: "user" | "assistant"; content: string; citations?: Citation[] };

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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: conversations, refetch: refetchConvs } = useQuery({
    queryKey: ["chat", "conversations"],
    queryFn: listConversations,
  });

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
          refetchConvs(); 
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

  async function loadConversation(c: Conversation) {
    if (busy) return;
    setSidebarOpen(false);
    setConvId(c.id);
    setMessages([]); 
    try {
      const msgs = await getMessages(c.id);
      setMessages(
        msgs.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
          citations: m.citations,
        }))
      );
    } catch (err) {
      toast.error("Failed to load conversation");
    }
  }

  function startNew() {
    if (busy) return;
    setSidebarOpen(false);
    setConvId(null);
    setMessages([]);
  }

  // Rename logic
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const editRef = useRef<HTMLInputElement>(null);

  function startEditing(c: Conversation) {
    setEditingId(c.id);
    setEditValue(c.title || "");
    setTimeout(() => editRef.current?.focus(), 0);
  }

  const isRenaming = useRef(false);

  async function commitRename(id: string, valueToCommit?: string) {
    if (isRenaming.current) return;
    const trimmed = (valueToCommit ?? editValue).trim();
    setEditingId(null);
    if (!trimmed) return;
    
    isRenaming.current = true;
    try {
      await renameConversation(id, trimmed);
      refetchConvs();
    } catch {
      toast.error("Failed to rename");
    } finally {
      isRenaming.current = false;
    }
  }

  const empty = messages.length === 0 && !streaming;

  return (
    <DashboardShell>
      <div className="flex h-[calc(100vh-theme(spacing.16))] sm:h-[calc(100vh-theme(spacing.24))] sm:m-6 sm:rounded-3xl relative overflow-hidden glass-card">
        {/* Sidebar */}
        <div
          className={`absolute inset-y-0 left-0 z-20 flex w-72 flex-col border-r transition-transform sm:static sm:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
          style={{ background: "rgba(0,0,0,0.2)", borderColor: "rgba(255,255,255,0.05)" }}
        >
          <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
            <h2 className="label-caps" style={{ color: "#a1a1aa" }}>Chat History</h2>
            <button
              onClick={startNew}
              className="rounded-full p-2 transition-colors hover:bg-white/10"
              style={{ color: "#f59e0b" }}
              title="New Chat"
            >
              <HugeiconsIcon icon={Add01Icon} className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {!conversations?.length ? (
              <p className="px-3 py-4 text-[13px]" style={{ color: "#71717a" }}>No past conversations.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {conversations.map((c) => (
                  <div
                    key={c.id}
                    className={`group flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all ${
                      c.id === convId
                        ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                        : "hover:bg-white/5 text-zinc-400 hover:text-zinc-200 border border-transparent"
                    }`}
                  >
                    <HugeiconsIcon icon={Message01Icon} className="h-4 w-4 shrink-0 opacity-70" />
                    {editingId === c.id ? (
                      <input
                         ref={editRef}
                         value={editValue}
                         onChange={(e) => setEditValue(e.target.value)}
                         onKeyDown={(e) => {
                           if (e.key === "Enter") {
                             e.preventDefault();
                             commitRename(c.id, editValue);
                           }
                           if (e.key === "Escape") setEditingId(null);
                         }}
                         onBlur={() => commitRename(c.id, editValue)}
                         className="flex-1 min-w-0 bg-transparent text-[13px] font-medium outline-none border-b border-amber-500 pb-0.5"
                         style={{ color: "#f4f4f5" }}
                         maxLength={120}
                      />
                    ) : (
                      <button
                        onClick={() => loadConversation(c)}
                        className="flex-1 min-w-0 truncate text-left text-[13px] font-medium"
                      >
                        {c.title || "New Conversation"}
                      </button>
                    )}
                    {editingId === c.id ? (
                      <button
                        onClick={() => commitRename(c.id)}
                        className="shrink-0 p-1 rounded-md text-amber-500 hover:bg-amber-500/20"
                        title="Confirm"
                      >
                        <HugeiconsIcon icon={Tick01Icon} className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); startEditing(c); }}
                        className="shrink-0 p-1 rounded-md opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-zinc-300 hover:bg-white/10 transition-all"
                        title="Rename"
                      >
                        <HugeiconsIcon icon={PencilEdit01Icon} className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Overlay for mobile */}
        {sidebarOpen && (
          <div
            className="absolute inset-0 z-10 bg-black/60 backdrop-blur-sm sm:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main Chat Area */}
        <div className="flex flex-1 flex-col relative z-0 bg-transparent">
          <header className="flex h-[72px] shrink-0 items-center justify-between border-b px-6" style={{ borderColor: "rgba(255,255,255,0.05)", background: "rgba(0,0,0,0.1)" }}>
            <div className="flex items-center gap-4">
              <button
                className="sm:hidden -ml-2 p-2 rounded-lg transition-colors hover:bg-white/10"
                style={{ color: "#a1a1aa" }}
                onClick={() => setSidebarOpen(true)}
              >
                <HugeiconsIcon icon={Menu01Icon} className="h-5 w-5" />
              </button>
              <div>
                <h1 style={{ fontSize: "16px", fontWeight: 700, color: "#f4f4f5" }}>AI Coach</h1>
                <p className="text-[12px] font-medium" style={{ color: "#71717a" }}>Digital Athlete Intelligence</p>
              </div>
            </div>
          </header>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
            {empty ? (
              <EmptyState onPick={send} />
            ) : (
              <div className="mx-auto flex max-w-3xl flex-col gap-6 pb-4">
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
        </div>
      </div>

      {openCitation && (
        <CitationModal citation={openCitation} onClose={() => setOpenCitation(null)} />
      )}

      <style jsx global>{`
        .glass-card {
          position: relative;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(40px);
          -webkit-backdrop-filter: blur(40px);
        }
        .label-caps {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.15em;
          text-transform: uppercase;
        }
        .msg-user {
          background: rgba(245, 158, 11, 0.1);
          border: 1px solid rgba(245, 158, 11, 0.2);
          color: #f4f4f5;
        }
        .msg-ai {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #d4d4d8;
        }
      `}</style>
    </DashboardShell>
  );
}

// ── components ────────────────────────────────────────────────────────────────

function EmptyState({ onPick }: { onPick: (t: string) => void }) {
  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center gap-8 text-center pb-20">
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-[2rem]" style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.2)", boxShadow: "0 0 40px rgba(245,158,11,0.1)" }}>
          <HugeiconsIcon icon={SparklesIcon} className="h-10 w-10" />
        </div>
        <div>
          <p style={{ fontSize: "24px", fontWeight: 800, color: "#f4f4f5", letterSpacing: "-0.02em" }}>Ask your AI Coach</p>
          <p className="mt-2 text-[14px]" style={{ color: "#a1a1aa" }}>
            Grounded in curated science. Not a substitute for a doctor.
          </p>
        </div>
      </div>
      <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 mt-4">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="rounded-2xl px-6 py-5 text-left text-[14px] font-medium transition-all hover:-translate-y-1 hover:bg-white/5"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", color: "#e2e2e2" }}
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
        className={`max-w-[85%] rounded-[1.5rem] px-6 py-4 text-[15px] leading-relaxed shadow-sm ${
          isUser ? "msg-user rounded-tr-sm" : "msg-ai rounded-tl-sm"
        }`}
      >
        <p className="whitespace-pre-wrap">
          {msg.content}
          {streaming && <span className="ml-1 animate-pulse" style={{ color: "#f59e0b" }}>▌</span>}
        </p>
        {msg.citations && msg.citations.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2 pt-3 border-t border-white/5">
            {dedupeCitations(msg.citations).map((c, i) => {
              const label = `${i + 1}. ${c.title ?? c.source ?? "Source"}`;
              const chipClass =
                "flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold transition-all hover:-translate-y-0.5";
              const chipStyle = { background: "rgba(99,102,241,0.15)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.2)" };

              return c.slug ? (
                <Link key={c.chunk_id} href={`/learn/${c.slug}`} className={chipClass} style={chipStyle}>
                  <HugeiconsIcon icon={BookOpen01Icon} className="h-3.5 w-3.5" />
                  {label}
                </Link>
              ) : (
                <button key={c.chunk_id} onClick={() => onCitation(c)} className={chipClass} style={chipStyle}>
                  <HugeiconsIcon icon={BookOpen01Icon} className="h-3.5 w-3.5" />
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
    <div className="shrink-0 p-4 sm:p-6" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)" }}>
      <div className="mx-auto flex max-w-3xl items-end gap-3 rounded-[2rem] p-2 pr-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(20px)" }}>
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
          placeholder="Message Coach..."
          className="max-h-32 flex-1 resize-none bg-transparent px-5 py-4 text-[15px] font-medium text-foreground outline-none placeholder:text-zinc-500"
        />
        <button
          onClick={onSend}
          disabled={busy || !value.trim()}
          aria-label="Send"
          className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-full transition-all disabled:opacity-30 hover:scale-105 active:scale-95 mb-0.5"
          style={{ background: value.trim() && !busy ? "#f59e0b" : "rgba(255,255,255,0.1)", color: value.trim() && !busy ? "#1b1304" : "#a1a1aa", boxShadow: value.trim() && !busy ? "0 0 20px rgba(245,158,11,0.3)" : "none" }}
        >
          <HugeiconsIcon icon={SentIcon} className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

function CitationModal({ citation, onClose }: { citation: Citation; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-label="Source"
    >
      <div
        className="mf-rise w-full max-w-md rounded-3xl p-6"
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#18181b", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)" }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "rgba(99,102,241,0.1)", color: "#818cf8" }}>
               <HugeiconsIcon icon={BookOpen01Icon} className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[15px] font-bold text-foreground">
                {citation.title ?? "Source"}
              </p>
              <p className="text-[11px] font-bold uppercase tracking-wider mt-1" style={{ color: "#71717a" }}>
                {citation.source ?? "knowledge base"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-2 transition-colors hover:bg-white/10"
            style={{ color: "#a1a1aa" }}
          >
            <HugeiconsIcon icon={Cancel01Icon} className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-5 rounded-xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
          <p className="text-[13px] leading-relaxed" style={{ color: "#a1a1aa" }}>
            This answer drew on the curated MessFit knowledge base. Full article text is
            available in the knowledge base under this title.
          </p>
        </div>
        <button
           onClick={onClose}
           className="mt-6 w-full rounded-full py-3 text-[14px] font-bold transition-all hover:bg-white/10"
           style={{ background: "rgba(255,255,255,0.05)", color: "#f4f4f5" }}
        >
           Close
        </button>
      </div>
    </div>
  );
}
