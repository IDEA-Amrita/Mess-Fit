"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, ArrowDown01Icon, Menu01Icon, SparklesIcon } from "@hugeicons/core-free-icons";
import { DashboardShell } from "@/components/DashboardShell";
import { Skeleton } from "@/components/ui/skeleton";
import { ChatBubble, ThinkingBubble } from "@/components/chat/ChatBubble";
import { CitationModal } from "@/components/chat/CitationModal";
import { Composer } from "@/components/chat/Composer";
import { ConversationList } from "@/components/chat/ConversationList";
import { newMsgId, type Msg } from "@/components/chat/types";
import { toast } from "@/lib/toast-store";
import { spring } from "@/lib/motion";
import { cn } from "@/lib/utils";
import {
  MAX_MESSAGE_LENGTH,
  createConversation,
  describeChatError,
  getMessages,
  listConversations,
  renameConversation,
  streamMessage,
  type Citation,
  type Conversation,
} from "@/lib/chat-api";

const SUGGESTIONS = [
  "Cheap protein sources in India?",
  "How do I bulk on a hostel mess?",
  "Why does progressive overload matter?",
  "Is creatine safe to take?",
];

/** Within this many px of the bottom counts as "reading the latest message". */
const STICK_THRESHOLD_PX = 80;

export default function ChatPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [streaming, setStreaming] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingConv, setLoadingConv] = useState(false);
  const [input, setInput] = useState("");
  const [convId, setConvId] = useState<string | null>(null);
  const [openCitation, setOpenCitation] = useState<Citation | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showJump, setShowJump] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  // Refs let long-lived callbacks (send/retry) read fresh values without
  // being re-created — which keeps memoised bubbles from re-rendering.
  const convIdRef = useRef<string | null>(null);
  const messagesRef = useRef<Msg[]>([]);
  const busyRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  /** Bumped whenever the active conversation changes so in-flight sends go stale. */
  const genRef = useRef(0);
  /** Bumped per conversation load so a slow earlier load can't overwrite a later one. */
  const loadRef = useRef(0);
  const stickRef = useRef(true);

  const {
    data: conversations,
    isLoading: convsLoading,
    refetch: refetchConvs,
  } = useQuery({ queryKey: ["chat", "conversations"], queryFn: listConversations });

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // ── scrolling: follow new content only while the user is at the bottom ──
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickRef.current) {
      // "auto" while streaming: a smooth-scroll animation per token queues up and janks.
      el.scrollTo({ top: el.scrollHeight, behavior: streaming ? "auto" : "smooth" });
    }
  }, [messages, streaming, busy]);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_THRESHOLD_PX;
    stickRef.current = near;
    setShowJump(!near);
  }

  function jumpToLatest() {
    stickRef.current = true;
    setShowJump(false);
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }

  useEffect(() => {
    if (!sidebarOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSidebarOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [sidebarOpen]);

  // Only pull focus into the composer where it won't pop a mobile keyboard.
  function focusComposer() {
    if (window.matchMedia("(pointer: fine)").matches) composerRef.current?.focus();
  }

  // ── sending ──────────────────────────────────────────────────────────────

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || content.length > MAX_MESSAGE_LENGTH || busyRef.current) return;

      const myGen = ++genRef.current;
      const stale = () => genRef.current !== myGen;
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      busyRef.current = true;
      stickRef.current = true;
      setShowJump(false);

      const userMsg: Msg = { id: newMsgId(), role: "user", content };
      setInput("");
      setBusy(true);
      setStreaming("");
      setMessages((m) => [...m, userMsg]);

      let acc = "";
      const markFailed = (error: string) =>
        setMessages((m) => m.map((x) => (x.id === userMsg.id ? { ...x, status: "failed", error } : x)));
      // Keep whatever arrived instead of silently discarding it.
      const keepPartial = (status: "interrupted" | "stopped", error?: string) => {
        if (acc.trim()) setMessages((m) => [...m, { id: newMsgId(), role: "assistant", content: acc, status, error }]);
        else if (status === "interrupted") markFailed(error ?? "No response received. Please try again.");
      };

      try {
        let id = convIdRef.current;
        if (!id) {
          id = (await createConversation()).id;
          if (stale()) return;
          convIdRef.current = id;
          setConvId(id);
        }
        const completed = await streamMessage(
          id,
          content,
          {
            onToken: (t) => {
              if (stale()) return;
              acc += t;
              setStreaming(acc);
            },
            onDone: (citations) => {
              if (stale()) return;
              setMessages((m) => [...m, { id: newMsgId(), role: "assistant", content: acc, citations }]);
              setStreaming("");
              refetchConvs();
            },
          },
          ctrl.signal,
        );
        if (stale()) return;
        // Stream ended without the server's `done` event: the answer is truncated.
        if (!completed) keepPartial("interrupted");
      } catch (err) {
        if (stale()) return;
        if (ctrl.signal.aborted) keepPartial("stopped");
        else if (acc.trim()) keepPartial("interrupted", describeChatError(err));
        else markFailed(describeChatError(err));
      } finally {
        if (!stale()) {
          busyRef.current = false;
          abortRef.current = null;
          setBusy(false);
          setStreaming("");
        }
      }
    },
    [refetchConvs],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  // Retry a failed send, or re-ask the question behind an interrupted answer.
  // The server only saves an exchange once it completes, so re-sending can't duplicate it.
  const retry = useCallback(
    (id: string) => {
      const list = messagesRef.current;
      const idx = list.findIndex((m) => m.id === id);
      if (idx < 0) return;
      const userIdx = list[idx].role === "user" ? idx : idx - 1;
      const userMsg = list[userIdx];
      if (!userMsg || userMsg.role !== "user") return;
      setMessages(list.slice(0, userIdx));
      void send(userMsg.content);
    },
    [send],
  );

  // ── switching conversations ──────────────────────────────────────────────

  /** Cancel any in-flight reply and make its late results irrelevant. */
  function cancelActive() {
    genRef.current++;
    abortRef.current?.abort();
    abortRef.current = null;
    busyRef.current = false;
    setBusy(false);
    setStreaming("");
  }

  async function loadConversation(c: Conversation) {
    if (c.id === convIdRef.current && messagesRef.current.length > 0) {
      setSidebarOpen(false);
      return;
    }
    cancelActive();
    setSidebarOpen(false);
    convIdRef.current = c.id;
    setConvId(c.id);
    setMessages([]);
    stickRef.current = true;
    const myLoad = ++loadRef.current;
    setLoadingConv(true);
    try {
      const msgs = await getMessages(c.id);
      if (loadRef.current !== myLoad) return; // user already moved on
      setMessages(
        msgs
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({ id: newMsgId(), role: m.role as "user" | "assistant", content: m.content, citations: m.citations })),
      );
    } catch {
      if (loadRef.current !== myLoad) return;
      toast.error("Failed to load conversation");
    } finally {
      if (loadRef.current === myLoad) setLoadingConv(false);
    }
  }

  function startNew() {
    cancelActive();
    loadRef.current++; // abandon any pending load
    setLoadingConv(false);
    setSidebarOpen(false);
    convIdRef.current = null;
    setConvId(null);
    setMessages([]);
    stickRef.current = true;
    focusComposer();
  }

  const rename = useCallback(
    async (id: string, title: string) => {
      try {
        await renameConversation(id, title);
        await refetchConvs();
      } catch {
        toast.error("Failed to rename");
      }
    },
    [refetchConvs],
  );

  const empty = messages.length === 0 && !busy && !loadingConv;
  const thinking = busy && !streaming;

  return (
    <DashboardShell>
      {/* Height = viewport minus the shell's chrome at each breakpoint:
          <sm  top bar (3.5rem) + bottom tab-bar padding (5rem)
          sm–lg same bars + the card's 1.5rem margins
          lg   sidebar layout, margins only. dvh tracks mobile browser bars. */}
      <div className="relative flex h-[calc(100dvh-8.5rem)] overflow-hidden border-white/5 bg-white/2 backdrop-blur-2xl sm:m-6 sm:h-[calc(100dvh-11.5rem)] sm:rounded-3xl sm:border lg:h-[calc(100dvh-3rem)]">
        {/* Conversations */}
        <aside
          className={cn(
            "absolute inset-y-0 left-0 z-20 w-72 border-r border-white/5 bg-black/60 backdrop-blur-xl transition-[transform,visibility] duration-200 sm:static sm:visible sm:translate-x-0 sm:bg-black/20",
            // `invisible` also removes the off-screen links from the tab order.
            sidebarOpen ? "translate-x-0" : "-translate-x-full max-sm:invisible",
          )}
        >
          <ConversationList
            conversations={conversations}
            loading={convsLoading}
            activeId={convId}
            onSelect={loadConversation}
            onNew={startNew}
            onRename={rename}
          />
        </aside>

        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-10 bg-black/60 backdrop-blur-sm sm:hidden"
              onClick={() => setSidebarOpen(false)}
              aria-hidden
            />
          )}
        </AnimatePresence>

        {/* Conversation */}
        <div className="relative z-0 flex min-w-0 flex-1 flex-col">
          <header className="flex h-18 shrink-0 items-center justify-between border-b border-white/5 bg-black/10 px-4 sm:px-6">
            <div className="flex items-center gap-3">
              <button
                className="-ml-2 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-white/10 sm:hidden"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open chat history"
              >
                <HugeiconsIcon icon={Menu01Icon} className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-[16px] font-bold text-white">AI Coach</h1>
                <p className="text-[12px] font-medium text-muted-foreground">Grounded in curated sources</p>
              </div>
            </div>
            <button
              onClick={startNew}
              className="rounded-full p-2 text-accent transition-colors hover:bg-white/10 sm:hidden"
              aria-label="New chat"
            >
              <HugeiconsIcon icon={Add01Icon} className="h-5 w-5" />
            </button>
          </header>

          <div className="relative flex-1 overflow-hidden">
            <div
              ref={scrollRef}
              onScroll={onScroll}
              role="log"
              aria-label="Conversation"
              aria-busy={busy}
              className="h-full space-y-6 overflow-y-auto p-4 sm:p-6 lg:p-8"
            >
              {loadingConv ? (
                <div className="mx-auto flex max-w-3xl flex-col gap-6" aria-busy="true" aria-label="Loading conversation">
                  <Skeleton className="ml-auto h-14 w-2/3 rounded-3xl" />
                  <Skeleton className="h-28 w-5/6 rounded-3xl" />
                  <Skeleton className="ml-auto h-14 w-1/2 rounded-3xl" />
                </div>
              ) : empty ? (
                <EmptyState onPick={send} />
              ) : (
                <div className="mx-auto flex max-w-3xl flex-col gap-6 pb-4">
                  {messages.map((m) => (
                    <ChatBubble key={m.id} msg={m} onCitation={setOpenCitation} onRetry={retry} />
                  ))}
                  {streaming && (
                    <ChatBubble
                      msg={{ id: "streaming", role: "assistant", content: streaming }}
                      streaming
                      onCitation={setOpenCitation}
                    />
                  )}
                  {thinking && <ThinkingBubble />}
                </div>
              )}
            </div>

            <AnimatePresence>
              {showJump && (
                <motion.button
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={spring.snappy}
                  onClick={jumpToLatest}
                  className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-border bg-popover px-4 py-2 text-[12px] font-bold text-white shadow-xl"
                >
                  <HugeiconsIcon icon={ArrowDown01Icon} className="h-4 w-4" />
                  Jump to latest
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          <Composer
            value={input}
            onChange={setInput}
            onSend={() => send(input)}
            onStop={stop}
            busy={busy}
            inputRef={composerRef}
          />
        </div>
      </div>

      <AnimatePresence>
        {openCitation && <CitationModal citation={openCitation} onClose={() => setOpenCitation(null)} />}
      </AnimatePresence>
    </DashboardShell>
  );
}

function EmptyState({ onPick }: { onPick: (t: string) => void }) {
  return (
    <div className="mx-auto flex min-h-full max-w-2xl flex-col items-center justify-center gap-8 pb-10 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={spring.soft}
        className="flex flex-col items-center gap-4"
      >
        <div className="flex h-20 w-20 items-center justify-center rounded-4xl border border-accent/20 bg-accent/10 text-accent shadow-[0_0_40px_rgba(204,255,0,0.1)]">
          <HugeiconsIcon icon={SparklesIcon} className="h-10 w-10" />
        </div>
        <div>
          <p className="text-[24px] font-extrabold tracking-tight text-white">Ask your AI Coach</p>
          <p className="mt-2 text-[14px] text-muted-foreground">Grounded in curated science. Not a substitute for a doctor.</p>
        </div>
      </motion.div>
      <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
        {SUGGESTIONS.map((s, i) => (
          <motion.button
            key={s}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring.soft, delay: 0.1 + i * 0.07 }}
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onPick(s)}
            className="rounded-2xl border border-white/6 bg-white/2 px-6 py-5 text-left text-[14px] font-medium text-zinc-200 transition-colors hover:bg-white/5"
          >
            {s}
          </motion.button>
        ))}
      </div>
    </div>
  );
}
