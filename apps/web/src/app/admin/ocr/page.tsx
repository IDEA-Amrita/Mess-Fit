"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Mess, getMesses } from "@/lib/mess-api";
import {
  OcrJobSummary,
  OcrStatus,
  listOcrJobs,
  uploadMenuPhoto,
} from "@/lib/ocr-api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const STATUS_VARIANT: Record<OcrStatus, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  processing: "secondary",
  ready_for_review: "default",
  approved: "outline",
  rejected: "destructive",
  failed: "destructive",
};

export default function AdminOcrPage() {
  const [messes, setMesses] = useState<Mess[]>([]);
  const [messId, setMessId] = useState<string>("");
  const [jobs, setJobs] = useState<OcrJobSummary[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getMesses().then((m) => {
      setMesses(m);
      if (m.length && !messId) setMessId(m[0].id);
    }).catch(() => {});
  }, [messId]);

  const refreshJobs = useCallback(async () => {
    try {
      setJobs(await listOcrJobs());
    } catch (e) {
      console.error("Failed to load OCR jobs", e);
    }
  }, []);

  useEffect(() => {
    refreshJobs();
    // Poll while any job is still being processed so the list reflects the worker.
    const t = setInterval(refreshJobs, 4000);
    return () => clearInterval(t);
  }, [refreshJobs]);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Choose a menu photo first.");
      return;
    }
    if (!messId) {
      setError("Select a mess.");
      return;
    }
    setError(null);
    setUploading(true);
    try {
      await uploadMenuPhoto(messId, file);
      if (fileRef.current) fileRef.current.value = "";
      await refreshJobs();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="container max-w-5xl py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin: Menu OCR</h1>
        <p className="text-muted-foreground">
          Upload a photo of a mess menu board; the parser extracts a weekly menu
          for you to review and approve.
        </p>
      </div>

      {/* Upload */}
      <form onSubmit={handleUpload} className="rounded-lg border p-4 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1">
            <label className="text-sm font-medium">Mess</label>
            <select
              value={messId}
              onChange={(e) => setMessId(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              {messes.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} — {m.college}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 space-y-1">
            <label className="text-sm font-medium">Menu photo</label>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/heic"
              className="w-full text-sm file:mr-3 file:rounded-md file:border file:bg-muted file:px-3 file:py-1.5"
            />
          </div>
          <Button type="submit" disabled={uploading}>
            {uploading ? "Uploading…" : "Upload & parse"}
          </Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </form>

      {/* Job list */}
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
            {jobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  No OCR jobs yet.
                </TableCell>
              </TableRow>
            ) : (
              jobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell className="font-mono text-xs">{job.id.slice(0, 8)}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[job.status]}>
                      {job.status.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                    {job.error_message ?? ""}
                  </TableCell>
                  <TableCell className="text-right">
                    {job.status === "ready_for_review" || job.status === "failed" ? (
                      <Link href={`/admin/ocr/${job.id}`}>
                        <Badge variant="secondary" className="cursor-pointer">Review</Badge>
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
    </div>
  );
}
