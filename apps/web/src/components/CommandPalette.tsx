"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { spring } from "@/lib/motion";

export type PaletteCommand = {
  id: string;
  label: string;
  hint?: string;
  icon: typeof Search01Icon;
  keywords?: string;
  run: () => void;
};

/**
 * Global ⌘K / Ctrl+K launcher — jump to any screen or run an action from the
 * keyboard. The controlled `open` state lives in the caller so a visible
 * button can open it too (discoverability: shortcuts nobody knows about
 * don't get used).
 *
 * Accessibility: dialog + combobox/listbox pattern with aria-activedescendant,
 * so screen readers follow the highlighted row while focus stays in the input.
 */
export function CommandPalette({
  open,
  onOpenChange,
  commands,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commands: PaletteCommand[];
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => `${c.label} ${c.keywords ?? ""}`.toLowerCase().includes(q));
  }, [commands, query]);

  // Global shortcut.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  // Reset on open; lock background scroll while open.
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    inputRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => setActive(0), [query]);

  // Keep the highlighted row visible when arrowing through a long list.
  useEffect(() => {
    listRef.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function choose(cmd: PaletteCommand | undefined) {
    if (!cmd) return;
    onOpenChange(false);
    cmd.run();
  }

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (results.length ? (i + 1) % results.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (results.length ? (i - 1 + results.length) % results.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(results[active]);
    } else if (e.key === "Escape") {
      onOpenChange(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[14vh]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => onOpenChange(false)}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            initial={{ opacity: 0, y: -12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={spring.snappy}
            className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-popover shadow-2xl"
          >
            <div className="flex items-center gap-3 border-b border-border px-4">
              <HugeiconsIcon icon={Search01Icon} size={18} className="text-muted-foreground" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onInputKey}
                placeholder="Jump to a page or run an action…"
                role="combobox"
                aria-expanded="true"
                aria-controls="cmdk-list"
                aria-activedescendant={results[active] ? `cmdk-${results[active].id}` : undefined}
                className="h-14 flex-1 bg-transparent text-[15px] font-medium text-white outline-none placeholder:text-muted-foreground"
              />
              <kbd className="rounded-md border border-border px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                ESC
              </kbd>
            </div>

            <ul id="cmdk-list" ref={listRef} role="listbox" className="max-h-80 overflow-y-auto p-2">
              {results.length === 0 && (
                <li className="px-3 py-8 text-center text-sm font-medium text-muted-foreground">
                  No matches for &ldquo;{query}&rdquo;
                </li>
              )}
              {results.map((c, i) => (
                <li
                  key={c.id}
                  id={`cmdk-${c.id}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseMove={() => setActive(i)}
                  onClick={() => choose(c)}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-bold transition-colors",
                    i === active ? "bg-accent text-black" : "text-muted-foreground",
                  )}
                >
                  <HugeiconsIcon icon={c.icon} size={18} strokeWidth={2} />
                  <span className="flex-1 truncate">{c.label}</span>
                  {c.hint && (
                    <span className={cn("text-[11px] font-bold", i === active ? "text-black/60" : "text-muted-foreground/60")}>
                      {c.hint}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
