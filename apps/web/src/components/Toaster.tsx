"use client";
import { HugeiconsIcon } from "@hugeicons/react";

import { CheckmarkCircle01Icon, Alert01Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { useToastStore } from "@/lib/toast-store";

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2">
      {toasts.map((t) => {
        const isError = t.variant === "error";
        return (
          <div
            key={t.id}
            className="flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium shadow-lg"
            style={{
              background: "#141414",
              border: `1px solid ${isError ? "rgba(248,113,113,0.3)" : "rgba(204,255,0,0.3)"}`,
              color: "#e8e8e8",
            }}
          >
            {isError ? (
              <HugeiconsIcon icon={Alert01Icon} className="h-4 w-4 shrink-0" style={{ color: "#f87171" }} />
            ) : (
              <HugeiconsIcon icon={CheckmarkCircle01Icon} className="h-4 w-4 shrink-0" style={{ color: "#ccff00" }} />
            )}
            <span>{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="ml-1 shrink-0"
              style={{ color: "#555" }}
            >
              <HugeiconsIcon icon={Cancel01Icon} className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
