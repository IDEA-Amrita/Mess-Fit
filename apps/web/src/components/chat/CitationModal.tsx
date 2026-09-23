"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import { BookOpen01Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import type { Citation } from "@/lib/chat-api";
import { spring } from "@/lib/motion";

/** Details for a citation that has no article page to link to. */
export function CitationModal({ citation, onClose }: { citation: Citation; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  // Parents pass inline arrows; a ref keeps the effect from re-running each render.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCloseRef.current();
    }
    document.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Source"
    >
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.98 }}
        transition={spring.sheet}
        className="w-full max-w-md rounded-3xl border border-border bg-popover p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-[#818cf8]">
              <HugeiconsIcon icon={BookOpen01Icon} className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[15px] font-bold text-foreground">{citation.title ?? "Source"}</p>
              <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                {citation.source ?? "knowledge base"}
              </p>
            </div>
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-white/10 hover:text-white"
          >
            <HugeiconsIcon icon={Cancel01Icon} className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-5 rounded-xl border border-border bg-white/3 p-4">
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            This answer drew on the curated MessFit knowledge base. Full article text is available in the
            knowledge base under this title.
          </p>
        </div>
        <button
          onClick={onClose}
          className="mt-6 w-full rounded-full bg-white/5 py-3 text-[14px] font-bold text-white transition-colors hover:bg-white/10"
        >
          Close
        </button>
      </motion.div>
    </motion.div>
  );
}
