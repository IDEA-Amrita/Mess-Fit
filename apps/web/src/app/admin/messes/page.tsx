"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getMesses } from "@/lib/mess-api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminMessesPage() {
  const messes = useQuery({ queryKey: ["admin", "messes"], queryFn: () => getMesses(), retry: 1 });

  return (
    <div className="container max-w-6xl space-y-6 py-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Messes</h1>
        <p className="text-muted-foreground">The registered messes. Menus are added by uploading a photo of the board.</p>
      </div>

      {messes.isError ? (
        <ErrorState title="Couldn't load messes" error={messes.error} onRetry={() => messes.refetch()} />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>College</TableHead>
                <TableHead>City</TableHead>
                <TableHead className="text-right">Menu</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {messes.isPending ? (
                [0, 1, 2].map((i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={4}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : messes.data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                    No messes found.
                  </TableCell>
                </TableRow>
              ) : (
                messes.data.map((mess) => (
                  <TableRow key={mess.id}>
                    <TableCell className="font-medium">{mess.name}</TableCell>
                    <TableCell>{mess.college}</TableCell>
                    <TableCell>{mess.city}</TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/admin/ocr?mess=${mess.id}`}
                        className="inline-flex min-h-11 items-center text-sm font-semibold text-accent hover:underline"
                      >
                        Upload menu photo
                      </Link>
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
