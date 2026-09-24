"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAnalyticsSummary } from "@/lib/analytics-api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const WINDOWS = [7, 14, 30] as const;

const LABELS: Record<string, string> = {
  session_start: "Sessions started",
  onboarding_completed: "Finished onboarding",
  plate_viewed: "Viewed a plate",
  meal_logged: "Logged a meal",
  weight_logged: "Logged weight",
  workout_saved: "Saved a workout",
  chat_message_sent: "Asked the coach",
  notifications_enabled: "Enabled notifications",
  pwa_installed: "Installed the app",
  article_opened: "Opened an article",
};

export default function AdminAnalyticsPage() {
  const [days, setDays] = useState<(typeof WINDOWS)[number]>(14);
  const summary = useQuery({
    queryKey: ["admin", "analytics", days],
    queryFn: () => getAnalyticsSummary(days),
    retry: 1,
    placeholderData: (prev) => prev,
  });
  const data = summary.data;
  const peak = Math.max(1, ...(data?.dau.map((d) => d.users) ?? [1]));

  return (
    <div className="container max-w-5xl space-y-8 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Usage</h1>
          <p className="text-muted-foreground">
            Feature usage from signed-in students who haven&apos;t opted out. Counts activity, never content.
          </p>
        </div>
        <div role="group" aria-label="Time window" className="flex gap-1 rounded-lg bg-surface-2 p-1">
          {WINDOWS.map((w) => (
            <button
              key={w}
              onClick={() => setDays(w)}
              aria-pressed={days === w}
              className={cn(
                "min-h-9 rounded-md px-3 text-sm font-semibold transition-colors",
                days === w ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {w}d
            </button>
          ))}
        </div>
      </div>

      {summary.isError ? (
        <ErrorState title="Couldn't load usage" error={summary.error} onRetry={() => summary.refetch()} />
      ) : !data ? (
        <div className="space-y-4" aria-busy="true" aria-label="Loading usage">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : data.total_events === 0 ? (
        <p role="status" className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          No usage recorded in the last {data.window_days} days yet.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">Active students</p>
              <p className="text-3xl font-bold tabular-nums">{data.active_users_window}</p>
              <p className="text-xs text-muted-foreground">in the last {data.window_days} days</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">Events</p>
              <p className="text-3xl font-bold tabular-nums">{data.total_events}</p>
              <p className="text-xs text-muted-foreground">in the last {data.window_days} days</p>
            </div>
          </div>

          <section aria-labelledby="dau-h" className="space-y-3">
            <h2 id="dau-h" className="text-lg font-semibold">
              Daily active students
            </h2>
            <ul className="space-y-1.5">
              {data.dau.map((d) => (
                <li key={d.day} className="flex items-center gap-3 text-sm">
                  <span className="w-24 shrink-0 tabular-nums text-muted-foreground">{d.day}</span>
                  <div className="h-5 flex-1 overflow-hidden rounded bg-surface-2">
                    <div className="h-full rounded bg-accent" style={{ width: `${(d.users / peak) * 100}%` }} />
                  </div>
                  <span className="w-8 shrink-0 text-right font-semibold tabular-nums">{d.users}</span>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="ev-h" className="space-y-3">
            <h2 id="ev-h" className="text-lg font-semibold">
              What students are doing
            </h2>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action</TableHead>
                    <TableHead className="text-right">Students</TableHead>
                    <TableHead className="text-right">Times</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.by_event.map((e) => (
                    <TableRow key={e.name}>
                      <TableCell className="font-medium">{LABELS[e.name] ?? e.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{e.users}</TableCell>
                      <TableCell className="text-right tabular-nums">{e.events}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
