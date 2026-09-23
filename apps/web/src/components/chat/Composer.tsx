"use client";

import { useLayoutEffect, type RefObject } from "react";
import { motion } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import { SentIcon, StopIcon } from "@hugeicons/core-free-icons";
import { MAX_MESSAGE_LENGTH } from "@/lib/chat-api";
import { spring } from "@/lib/motion";
import { cn } from "@/lib/utils";

const MAX_HEIGHT_PX = 144;
/** Show the character counter once the user is within this many chars of the limit. */
const COUNTER_THRESHOLD = 200;

/**
 * Message box + send/stop button.
 *
 * The textarea stays editable while a reply streams (so you can draft the next
 * question); only *sending* is blocked. While busy the send button becomes Stop.
 */
export function Composer({
  value,
  onChange,
  onSend,
  onStop,
  busy,
  inputRef,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  busy: boolean;
  inputRef: RefObject<HTMLTextAreaElement | null>;
}) {
  // Grow with the content up to a cap, then scroll.
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT_PX)}px`;
  }, [value, inputRef]);

  const canSend = !busy && value.trim().length > 0;
  const remaining = MAX_MESSAGE_LENGTH - value.length;

  return (
    <div className="shrink-0 bg-gradient-to-t from-black/80 to-transparent p-4 sm:p-6">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-end gap-3 rounded-4xl border border-white/10 bg-white/3 p-2 backdrop-blur-xl transition-colors focus-within:border-accent/40">
          <textarea
            ref={inputRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              // isComposing: Enter while picking an IME candidate must not send.
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                if (canSend) onSend();
              }
            }}
            rows={1}
            maxLength={MAX_MESSAGE_LENGTH}
            aria-label="Message"
            placeholder="Message Coach..."
            className="flex-1 resize-none bg-transparent px-5 py-3.5 text-[15px] font-medium text-foreground outline-none placeholder:text-zinc-500"
          />
          {busy ? (
            <motion.button
              whileTap={{ scale: 0.92 }}
              transition={spring.snappy}
              onClick={onStop}
              aria-label="Stop generating"
              className="mb-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-black"
            >
              <HugeiconsIcon icon={StopIcon} className="h-5 w-5" />
            </motion.button>
          ) : (
            <motion.button
              whileTap={{ scale: 0.92 }}
              transition={spring.snappy}
              onClick={onSend}
              disabled={!canSend}
              aria-label="Send"
              className={cn(
                "mb-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-colors",
                canSend
                  ? "bg-accent text-[#1b1304] shadow-[0_0_20px_rgba(204,255,0,0.3)]"
                  : "bg-white/10 text-muted-foreground",
              )}
            >
              <HugeiconsIcon icon={SentIcon} className="h-5 w-5" />
            </motion.button>
          )}
        </div>
        <div className="mt-2 flex items-center justify-between px-2 text-[11px] font-medium text-muted-foreground/70">
          <span>Coach can make mistakes. Not medical advice.</span>
          {remaining <= COUNTER_THRESHOLD && (
            <span className={cn("tabular-nums", remaining <= 20 && "text-[#FF6B60]")} aria-live="polite">
              {remaining.toLocaleString()} left
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
