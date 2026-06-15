"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ApprovePayload,
  OcrJobDetail,
  ParsedResult,
  approveOcrJob,
  dayNameToIndex,
  getOcrJob,
  rejectOcrJob,
} from "@/lib/ocr-api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/** Local editable state: a parsed dish plus whether the admin keeps the match. */
interface EditDish {
  name: string;
  matchedDishId: string | null;
  matchedName: string | null;
  matchScore: number | null;
  confidenceLow: boolean;
  link: boolean; // keep the matched dish vs. create a new draft
}
interface EditMeal {
  type: "breakfast" | "lunch" | "snack" | "dinner";
  dishes: EditDish[];
}
interface EditDay {
  day: string;
  dayIndex: number | null;
  meals: EditMeal[];
}

function toEditModel(parsed: ParsedResult): EditDay[] {
  return parsed.weekly.map((d) => ({
    day: d.day,
    dayIndex: dayNameToIndex(d.day),
    meals: d.meals.map((m) => ({
      type: m.type,
      dishes: m.dishes.map((dish) => ({
        name: dish.name,
        matchedDishId: dish.matched_dish_id,
        matchedName: dish.matched_name,
        matchScore: dish.match_score,
        confidenceLow: dish.confidence_low,
        link: dish.matched_dish_id !== null, // default: keep a found match
      })),
    })),
  }));
}

function defaultMonday(): string {
  const d = new Date();
  const diff = (d.getDay() + 6) % 7; // days since Monday
  d.setDate(d.getDate() - diff);
  return d.toISOString().slice(0, 10);
}

export default function OcrReviewPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<OcrJobDetail | null>(null);
  const [days, setDays] = useState<EditDay[]>([]);
  const [effectiveFrom, setEffectiveFrom] = useState(defaultMonday());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await getOcrJob(id);
    setJob(data);
    if (data.parsed_result) setDays(toEditModel(data.parsed_result));
    return data;
  }, [id]);

  useEffect(() => {
    let stop = false;
    load().then((d) => {
      // Poll while the worker is still parsing.
      if (!stop && (d.status === "pending" || d.status === "processing")) {
        const t = setInterval(async () => {
          const fresh = await load();
          if (fresh.status !== "pending" && fresh.status !== "processing") {
            clearInterval(t);
          }
        }, 3000);
        return () => clearInterval(t);
      }
    });
    return () => {
      stop = true;
    };
  }, [load]);

  function setDishName(di: number, mi: number, dishi: number, name: string) {
    setDays((prev) => {
      const next = structuredClone(prev);
      next[di].meals[mi].dishes[dishi].name = name;
      return next;
    });
  }
  function toggleLink(di: number, mi: number, dishi: number) {
    setDays((prev) => {
      const next = structuredClone(prev);
      const d = next[di].meals[mi].dishes[dishi];
      if (d.matchedDishId) d.link = !d.link;
      return next;
    });
  }

  const unmappedDays = useMemo(
    () => days.filter((d) => d.dayIndex === null).map((d) => d.day),
    [days],
  );

  async function handleApprove() {
    if (unmappedDays.length) {
      setError(`Unrecognized day name(s): ${unmappedDays.join(", ")}`);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const payload: ApprovePayload = {
        effective_from: effectiveFrom,
        weekly: days.map((d) => ({
          day_of_week: d.dayIndex as number,
          meals: d.meals.map((m) => ({
            type: m.type,
            dishes: m.dishes.map((dish) => ({
              name: dish.name,
              dish_id: dish.link ? dish.matchedDishId : null,
            })),
          })),
        })),
      };
      const res = await approveOcrJob(id, payload);
      router.push(`/admin/ocr?approved=${res.menu_rows_added}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approve failed");
      setBusy(false);
    }
  }

  async function handleReject() {
    setBusy(true);
    try {
      await rejectOcrJob(id);
      router.push("/admin/ocr");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reject failed");
      setBusy(false);
    }
  }

  if (!job) {
    return <div className="container max-w-5xl py-8 text-muted-foreground">Loading…</div>;
  }

  if (job.status === "pending" || job.status === "processing") {
    return (
      <div className="container max-w-5xl py-8 space-y-2">
        <h1 className="text-2xl font-bold">Parsing menu…</h1>
        <p className="text-muted-foreground">
          The OCR worker is reading the photo. This page refreshes automatically.
        </p>
      </div>
    );
  }

  if (job.status === "failed") {
    return (
      <div className="container max-w-5xl py-8 space-y-4">
        <h1 className="text-2xl font-bold">OCR failed</h1>
        <p className="text-sm text-destructive">{job.error_message}</p>
        <Button variant="secondary" onClick={() => router.push("/admin/ocr")}>
          Back to jobs
        </Button>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Review parsed menu</h1>
        <Badge variant="default">{job.status.replace(/_/g, " ")}</Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Parsed structure (editable) */}
        <div className="space-y-4 order-2 lg:order-1">
          <div className="flex items-end gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Effective from</label>
              <input
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                className="rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>

          {days.map((day, di) => (
            <div key={di} className="rounded-lg border p-3 space-y-3">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">{day.day}</h3>
                {day.dayIndex === null && (
                  <Badge variant="destructive">unrecognized day</Badge>
                )}
              </div>
              {day.meals.map((meal, mi) => (
                <div key={mi} className="space-y-1.5">
                  <p className="text-xs font-medium uppercase text-muted-foreground">
                    {meal.type}
                  </p>
                  {meal.dishes.map((dish, dishi) => (
                    <div
                      key={dishi}
                      className="flex flex-wrap items-center gap-2 rounded-md border px-2 py-1.5"
                      style={
                        dish.confidenceLow || (!dish.matchedDishId)
                          ? { background: "rgba(245,158,11,0.08)" }
                          : undefined
                      }
                    >
                      <input
                        value={dish.name}
                        onChange={(e) => setDishName(di, mi, dishi, e.target.value)}
                        className="flex-1 min-w-32 rounded border bg-background px-2 py-1 text-sm"
                      />
                      {dish.matchedDishId ? (
                        <button
                          type="button"
                          onClick={() => toggleLink(di, mi, dishi)}
                          className="text-xs"
                          title="Toggle: link to existing dish, or create a new one"
                        >
                          <Badge variant={dish.link ? "default" : "outline"}>
                            {dish.link
                              ? `→ ${dish.matchedName} (${Math.round((dish.matchScore ?? 0) * 100)}%)`
                              : "new dish"}
                          </Badge>
                        </button>
                      ) : (
                        <Badge variant="secondary">new dish</Badge>
                      )}
                      {dish.confidenceLow && <Badge variant="destructive">low conf</Badge>}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Raw photo */}
        <div className="order-1 lg:order-2">
          <div className="sticky top-4 rounded-lg border p-2">
            {job.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={job.image_url}
                alt="Uploaded mess menu photo being reviewed for OCR"
                loading="lazy"
                className="w-full rounded"
              />
            ) : (
              <p className="p-8 text-center text-sm text-muted-foreground">
                Image unavailable
              </p>
            )}
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-3">
        <Button onClick={handleApprove} disabled={busy}>
          {busy ? "Saving…" : "Approve into menu"}
        </Button>
        <Button variant="outline" onClick={handleReject} disabled={busy}>
          Reject
        </Button>
      </div>
    </div>
  );
}
