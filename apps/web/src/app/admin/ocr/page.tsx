"use client";

import { Suspense, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getMesses } from "@/lib/mess-api";
import { OcrJobSummary, OcrStatus, listOcrJobs, uploadMenuPhoto } from "@/lib/ocr-api";
import { apiErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorState } from "@/components/ui/error-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const STATUS_VARIANT: Record<OcrStatus, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  processing: "secondary",
  ready_for_review: "default",
  approved: "outline",
  rejected: "destructive",
  failed: "destructive",
};

const inFlight = (jobs: OcrJobSummary[] | undefined) =>
  !!jobs?.some((j) => j.status === "pending" || j.status === "processing");

export default function AdminOcrPage() {
  return (
    <Suspense>
      <OcrJobs />
    </Suspense>
  );
}

function OcrJobs() {
  const queryClient = useQueryClient();
  const params = useSearchParams();
  const approved = params.get("approved");
  const [chosenMess, setChosenMess] = useState<string | null>(params.get("mess"));
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const messes = useQuery({ queryKey: ["admin", "messes"], queryFn: () => getMesses(), retry: 1 });
  // Poll only while the worker still has something to do, and only while the
  // tab is visible (react-query pauses interval refetches in the background).
  const jobs = useQuery({
    queryKey: ["admin", "ocr-jobs"],
    queryFn: () => listOcrJobs(),
    retry: 1,
    refetchInterval: (q) => (inFlight(q.state.data) ? 4000 : false),
  });

  const messId = chosenMess ?? messes.data?.[0]?.id ?? "";

  const upload = useMutation({
    mutationFn: ({ mess, file }: { mess: string; file: File }) => uploadMenuPhoto(mess, file),
    onSuccess: () => {
      if (fileRef.current) fileRef.current.value = "";
      return queryClient.invalidateQueries({ queryKey: ["admin", "ocr-jobs"] });
    },
    onError: (e) => setUploadError(apiErrorMessage(e, "Upload failed")),
  });

  function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return setUploadError("Choose a menu photo first.");
    if (!messId) return setUploadError("Select a mess.");
    setUploadError(null);
    upload.mutate({ mess: messId, file });
  }

  return (
    <div className="container max-w-5xl space-y-8 py-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Menu OCR</h1>
        <p className="text-muted-foreground">
          Upload a photo of a mess menu board; the parser extracts a weekly menu for you to review and approve.
        </p>
      </div>

      {approved && (
        <p role="status" className="rounded-md border border-accent/30 bg-accent-muted px-4 py-3 text-sm font-medium text-accent">
          Menu approved — {approved} menu {approved === "1" ? "row" : "rows"} added.
        </p>
      )}

      <form onSubmit={handleUpload} className="space-y-4 rounded-lg border p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1">
            <label htmlFor="ocr-mess" className="text-sm font-medium">
              Mess
            </label>
            <select
              id="ocr-mess"
              value={messId}
              onChange={(e) => setChosenMess(e.target.value)}
              disabled={messes.isPending}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              {(messes.data ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} — {m.college}
                </option>
              ))}
            </select>
            {messes.isError && (
              <p role="alert" className="text-xs text-destructive">
                Couldn&apos;t load messes.{" "}
                <button type="button" onClick={() => messes.refetch()} className="underline">
                  Retry
                </button>
              </p>
            )}
          </div>
          <div className="flex-1 space-y-1">
            <label htmlFor="ocr-photo" className="text-sm font-medium">
              Menu photo
            </label>
            <input
              id="ocr-photo"
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/heic"
              className="w-full text-sm file:mr-3 file:rounded-md file:border file:bg-muted file:px-3 file:py-1.5"
            />
          </div>
          <Button type="submit" disabled={upload.isPending}>
            {upload.isPending ? "Uploading…" : "Upload & parse"}
          </Button>
        </div>
        {uploadError && (
          <p role="alert" className="text-sm text-destructive">
            {uploadError}
          </p>
        )}
      </form>

      {jobs.isError ? (
        <ErrorState title="Couldn't load OCR jobs" error={jobs.error} onRetry={() => jobs.refetch()} />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Note</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.isPending ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                    Loading jobs…
                  </TableCell>
                </TableRow>
              ) : jobs.data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                    No OCR jobs yet.
                  </TableCell>
                </TableRow>
              ) : (
                jobs.data.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="font-mono text-xs">{job.id.slice(0, 8)}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[job.status]}>{job.status.replace(/_/g, " ")}</Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                      {job.error_message ?? ""}
                    </TableCell>
                    <TableCell className="text-right">
                      {job.status === "ready_for_review" || job.status === "failed" ? (
                        <Link
                          href={`/admin/ocr/${job.id}`}
                          className="inline-flex min-h-11 items-center text-sm font-semibold text-accent hover:underline"
                        >
                          Review
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
