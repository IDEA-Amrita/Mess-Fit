"use client";

import { useMemo, useRef, useState } from "react";
import { isToday, isYesterday, parseISO } from "date-fns";
import { motion } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, Message01Icon, PencilEdit01Icon, Tick01Icon } from "@hugeicons/core-free-icons";
import { Skeleton } from "@/components/ui/skeleton";
import type { Conversation } from "@/lib/chat-api";
import { spring } from "@/lib/motion";
import { cn } from "@/lib/utils";

const GROUP_ORDER = ["Today", "Yesterday", "Earlier"] as const;
type Group = (typeof GROUP_ORDER)[number];

function groupOf(c: Conversation): Group {
  const d = parseISO(c.updated_at);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return "Earlier";
}

export function ConversationList({
  conversations,
  loading,
  activeId,
  onSelect,
  onNew,
  onRename,
}: {
  conversations: Conversation[] | undefined;
  loading: boolean;
  activeId: string | null;
  onSelect: (c: Conversation) => void;
  onNew: () => void;
  onRename: (id: string, title: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  // Escape must cancel. Removing the focused input can still fire a blur, and
  // blur commits — so Escape marks the edit as cancelled first.
  const cancelledRef = useRef(false);

  const grouped = useMemo(() => {
    const map = new Map<Group, Conversation[]>();
    for (const c of conversations ?? []) {
      const g = groupOf(c);
      map.set(g, [...(map.get(g) ?? []), c]);
    }
    return GROUP_ORDER.filter((g) => map.has(g)).map((g) => ({ group: g, items: map.get(g)! }));
  }, [conversations]);

  function startEditing(c: Conversation) {
    cancelledRef.current = false;
    setEditingId(c.id);
    setEditValue(c.title || "");
  }

  function commit(id: string) {
    if (cancelledRef.current) return;
    const trimmed = editValue.trim();
    const current = conversations?.find((c) => c.id === id)?.title ?? "";
    setEditingId(null);
    if (trimmed && trimmed !== current) onRename(id, trimmed);
  }

  return (
    <nav aria-label="Conversations" className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-white/5 p-5">
        <h2 className="label-caps">Chat History</h2>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onNew}
          className="rounded-full p-2 text-accent transition-colors hover:bg-white/10"
          aria-label="New chat"
          title="New chat"
        >
          <HugeiconsIcon icon={Add01Icon} className="h-5 w-5" />
        </motion.button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {loading ? (
          <div className="space-y-2 p-1" aria-busy="true" aria-label="Loading conversations">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-11 rounded-xl" />
            ))}
          </div>
        ) : !conversations?.length ? (
          <p className="px-3 py-4 text-[13px] text-muted-foreground">No past conversations.</p>
        ) : (
          grouped.map(({ group, items }) => (
            <section key={group} className="mb-4 last:mb-0">
              <h3 className="px-3 pb-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                {group}
              </h3>
              <ul className="flex flex-col gap-1">
                {items.map((c) => {
                  const active = c.id === activeId;
                  const editing = editingId === c.id;
                  return (
                    <motion.li
                      key={c.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={spring.soft}
                      className={cn(
                        "group flex items-center gap-3 rounded-xl border px-4 py-2.5 text-left transition-colors",
                        active
                          ? "border-accent/20 bg-accent/10 text-accent"
                          : "border-transparent text-zinc-400 hover:bg-white/5 hover:text-zinc-200",
                      )}
                    >
                      <HugeiconsIcon icon={Message01Icon} className="h-4 w-4 shrink-0 opacity-70" />
                      {editing ? (
                        <input
                          autoFocus
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              commit(c.id);
                            }
                            if (e.key === "Escape") {
                              cancelledRef.current = true;
                              setEditingId(null);
                            }
                          }}
                          onBlur={() => commit(c.id)}
                          aria-label="Conversation title"
                          maxLength={120}
                          className="min-w-0 flex-1 border-b border-accent bg-transparent pb-0.5 text-[13px] font-medium text-white outline-none"
                        />
                      ) : (
                        <button
                          onClick={() => onSelect(c)}
                          aria-current={active ? "true" : undefined}
                          className="min-w-0 flex-1 truncate text-left text-[13px] font-medium"
                        >
                          {c.title || "New Conversation"}
                        </button>
                      )}
                      {editing ? (
                        <button
                          // mousedown, not click: click fires after blur has already committed.
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => commit(c.id)}
                          className="shrink-0 rounded-md p-1 text-accent hover:bg-accent/20"
                          aria-label="Confirm rename"
                        >
                          <HugeiconsIcon icon={Tick01Icon} className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => startEditing(c)}
                          className="shrink-0 rounded-md p-1 text-zinc-500 opacity-0 transition-all hover:bg-white/10 hover:text-zinc-300 focus:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
                          aria-label={`Rename ${c.title || "conversation"}`}
                        >
                          <HugeiconsIcon icon={PencilEdit01Icon} className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </motion.li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </div>
    </nav>
  );
}
