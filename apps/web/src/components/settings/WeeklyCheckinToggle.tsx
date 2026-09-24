"use client";

import { useId } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { apiErrorMessage, apiFetch } from "@/lib/api";
import { toast } from "@/lib/toast-store";

type Prefs = { weekly_checkin: boolean };
const KEY = ["notification-preferences"];

/** Per-account opt-out for the Sunday-evening check-in push. */
export function WeeklyCheckinToggle() {
  const id = useId();
  const qc = useQueryClient();
  const prefs = useQuery({
    queryKey: KEY,
    queryFn: () => apiFetch<Prefs>("/api/v1/notifications/preferences"),
  });

  const save = useMutation({
    mutationFn: (weekly_checkin: boolean) =>
      apiFetch<Prefs>("/api/v1/notifications/preferences", {
        method: "PUT",
        body: JSON.stringify({ weekly_checkin }),
      }),
    // Flip immediately; put it back if the server refuses.
    onMutate: async (weekly_checkin) => {
      await qc.cancelQueries({ queryKey: KEY });
      const previous = qc.getQueryData<Prefs>(KEY);
      qc.setQueryData<Prefs>(KEY, { weekly_checkin });
      return { previous };
    },
    onError: (err, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(KEY, ctx.previous);
      toast.error(apiErrorMessage(err, "Couldn't save that change"));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });

  if (prefs.isPending) return <Skeleton className="mt-5 h-12 w-full" />;
  if (prefs.isError) {
    return (
      <p role="alert" className="mt-5 text-sm text-destructive">
        Couldn&apos;t load your reminder settings.{" "}
        <button type="button" onClick={() => prefs.refetch()} className="font-semibold underline underline-offset-4">
          Retry
        </button>
      </p>
    );
  }

  return (
    <div className="mt-5 flex items-center justify-between gap-4 border-t border-border pt-5">
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-semibold text-foreground">
          Weekly check-in reminder
        </label>
        <p className="text-sm text-muted-foreground">
          A Sunday-evening nudge to log your weight and review your week. Applies to all your devices.
        </p>
      </div>
      <Switch id={id} checked={prefs.data.weekly_checkin} onCheckedChange={(on) => save.mutate(on)} />
    </div>
  );
}
