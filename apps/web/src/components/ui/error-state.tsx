"use client";

import type { ReactNode } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert01Icon, WifiDisconnected01Icon } from "@hugeicons/core-free-icons";
import { ApiError, apiErrorMessage } from "@/lib/api";
import { useOnlineStatus } from "@/lib/use-online-status";
import { cn } from "@/lib/utils";

/**
 * What to tell the user about a failed request. A raw server detail such as
 * "Internal Server Error" or a browser's "Failed to fetch" is noise, so 5xx
 * and network failures get plain sentences; 4xx details are written for
 * people by the API and pass through.
 */
export function describeError(error: unknown, online: boolean, fallback = "Please try again."): string {
  if (!online) return "You're offline. Reconnect and try again.";
  if (error instanceof ApiError) {
    if (error.status >= 500) return "Something went wrong on our side. Try again in a moment.";
    return apiErrorMessage(error, fallback);
  }
  if (error instanceof TypeError) return "Couldn't reach MessFit. Check your connection and try again.";
  return fallback;
}

/**
 * The one failed-to-load state. Offline-aware, announced to screen readers,
 * with a retry and an optional replacement action (e.g. "Set up profile").
 */
export function ErrorState({
  title,
  error,
  onRetry,
  action,
  description,
  className,
}: {
  title: ReactNode;
  error?: unknown;
  onRetry?: () => void;
  /** Replaces the retry button when retrying can't help. */
  action?: ReactNode;
  /** Overrides the message derived from `error`. */
  description?: ReactNode;
  className?: string;
}) {
  const online = useOnlineStatus();
  const offline = !online;

  return (
    <div
      role="alert"
      className={cn("surface-card mx-auto flex max-w-md flex-col items-center justify-center px-6 py-14 text-center", className)}
    >
      <div
        className={cn(
          "mb-5 flex h-14 w-14 items-center justify-center rounded-full",
          offline ? "bg-white/10 text-muted-foreground" : "bg-[#FF3B30]/10 text-[#FF3B30]",
        )}
      >
        <HugeiconsIcon icon={offline ? WifiDisconnected01Icon : Alert01Icon} size={28} />
      </div>
      <h2 className="mb-2 text-lg font-bold text-foreground">{title}</h2>
      <p className="mb-6 max-w-sm text-sm text-muted-foreground">{description ?? describeError(error, online)}</p>
      {action ??
        (onRetry && (
          <button
            onClick={onRetry}
            className="rounded-full bg-accent px-6 py-3 text-[12px] font-black uppercase tracking-widest text-black transition-[filter,transform] hover:brightness-110 active:scale-95"
          >
            Try again
          </button>
        ))}
    </div>
  );
}
