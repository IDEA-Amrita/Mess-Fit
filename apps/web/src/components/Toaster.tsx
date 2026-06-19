"use client";

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
              border: `1px solid ${isError ? "rgba(248,113,113,0.3)" : "rgba(245,158,11,0.3)"}`,
              color: "#e8e8e8",
            }}
          >
            {isError ? (
              <Alert01Icon className="h-4 w-4 shrink-0" style={{ color: "#f87171" }} />
            ) : (
              <CheckmarkCircle01Icon className="h-4 w-4 shrink-0" style={{ color: "#f59e0b" }} />
            )}
            <span>{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="ml-1 shrink-0"
              style={{ color: "#555" }}
            >
              <Cancel01Icon className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
