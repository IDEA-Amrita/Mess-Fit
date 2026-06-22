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
          refetchConvs(); // Refresh list to get the new title if it was a new conversation
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
    setMessages([]); // Clear immediately while fetching
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

  // ── Rename logic ────────────────────────────────────────────────────────
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const editRef = useRef<HTMLInputElement>(null);

  function startEditing(c: Conversation) {
    setEditingId(c.id);
    setEditValue(c.title || "");
    // Focus after next render
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
      <div className="flex h-[calc(100vh-theme(spacing.16))] sm:h-auto sm:flex-1 relative overflow-hidden">
        {/* Sidebar */}
        <div
          className={`absolute inset-y-0 left-0 z-20 flex w-64 flex-col border-r border-border bg-background transition-transform sm:static sm:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between p-4">
            <h2 className="text-sm font-semibold text-foreground">Chat History</h2>
            <button
              onClick={startNew}
              className="rounded-lg p-2 text-muted-foreground hover:bg-surface hover:text-foreground transition-colors"
              title="New Chat"
            >
              <HugeiconsIcon icon={Add01Icon} className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-4">
            {!conversations?.length ? (
              <p className="px-2 py-4 text-xs text-muted-foreground">No past conversations.</p>
            ) : (
              <div className="flex flex-col gap-1">
                {conversations.map((c) => (
                  <div
                    key={c.id}
                    className={`group flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      c.id === convId
                        ? "bg-surface-2 text-foreground font-medium"
                        : "text-muted-foreground hover:bg-surface hover:text-foreground"
                    }`}
                  >
                    <HugeiconsIcon icon={Message01Icon} className="h-4 w-4 shrink-0" />
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
                        className="flex-1 min-w-0 bg-transparent text-sm text-foreground outline-none border-b border-accent px-1 py-0.5"
                        maxLength={120}
                      />
                    ) : (
                      <button
                        onClick={() => loadConversation(c)}
                        className="flex-1 min-w-0 truncate text-left"
                      >
                        {c.title || "New Conversation"}
                      </button>
                    )}
                    {editingId === c.id ? (
                      <button
                        onClick={() => commitRename(c.id)}
                        className="shrink-0 p-0.5 text-accent"
                        title="Confirm"
                      >
                        <HugeiconsIcon icon={Tick01Icon} className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); startEditing(c); }}
                        className="shrink-0 p-0.5 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity"
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
            className="absolute inset-0 z-10 bg-black/50 sm:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main Chat Area */}
        <div className="flex flex-1 flex-col relative z-0">
          <header className="flex h-16 shrink-0 items-center justify-between border-b border-border px-6">
            <div className="flex items-center gap-3">
              <button
                className="sm:hidden -ml-2 p-2 text-muted-foreground"
                onClick={() => setSidebarOpen(true)}
              >
                <HugeiconsIcon icon={Menu01Icon} className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-base font-semibold text-foreground">Coach</h1>
                <p className="text-xs text-muted-foreground">AI assistant · not medical advice</p>
              </div>
            </div>
            {convId && (
              <button
                onClick={startNew}
                className="hidden sm:flex rounded-lg px-3 py-1.5 text-xs font-medium bg-surface text-foreground hover:bg-surface-2 transition-colors"
              >
                New Chat
              </button>
            )}
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
        </div>
      </div>

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
        <HugeiconsIcon icon={SparklesIcon} className="h-7 w-7" />
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
                  <HugeiconsIcon icon={BookOpen01Icon} className="h-3 w-3" />
                  {label}
                </Link>
              ) : (
                <button key={c.chunk_id} onClick={() => onCitation(c)} className={chipClass}>
                  <HugeiconsIcon icon={BookOpen01Icon} className="h-3 w-3" />
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
          <HugeiconsIcon icon={SentIcon} className="h-4 w-4" />
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
            <HugeiconsIcon icon={BookOpen01Icon} className="h-4 w-4 text-indigo-400" />
            <p className="text-sm font-semibold text-foreground">
              {citation.title ?? "Source"}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            <HugeiconsIcon icon={Cancel01Icon} className="h-4 w-4" />
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
