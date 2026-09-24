"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getDishes } from "@/lib/mess-api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminDishesPage() {
  const dishes = useQuery({ queryKey: ["admin", "dishes"], queryFn: () => getDishes(), retry: 1 });
  const [search, setSearch] = useState("");

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    const all = dishes.data ?? [];
    return q ? all.filter((d) => `${d.name} ${d.category}`.toLowerCase().includes(q)) : all;
  }, [dishes.data, search]);

  return (
    <div className="container max-w-6xl space-y-6 py-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dishes</h1>
        <p className="text-muted-foreground">The central dish database.</p>
      </div>

      {dishes.isError ? (
        <ErrorState title="Couldn't load dishes" error={dishes.error} onRetry={() => dishes.refetch()} />
      ) : (
        <>
          <div className="flex items-center gap-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search dishes"
              placeholder="Search by name or category…"
              className="h-11 w-full max-w-sm rounded-md border bg-background px-3 text-sm"
            />
            {dishes.data && (
              <p role="status" className="text-sm text-muted-foreground">
                {shown.length} of {dishes.data.length}
              </p>
            )}
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Serving</TableHead>
                  <TableHead className="text-right">Kcal</TableHead>
                  <TableHead className="text-right">Protein</TableHead>
                  <TableHead className="text-right">Carbs</TableHead>
                  <TableHead className="text-right">Fats</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dishes.isPending ? (
                  [0, 1, 2, 3, 4].map((i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={7}>
                        <Skeleton className="h-6 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : shown.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      {search ? "No dishes match your search." : "No dishes found."}
                    </TableCell>
                  </TableRow>
                ) : (
                  shown.map((dish) => (
                    <TableRow key={dish.id}>
                      <TableCell className="font-medium">{dish.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {dish.category}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {dish.default_serving_grams}g ({dish.default_serving_unit})
                      </TableCell>
                      <TableCell className="text-right">{dish.kcal}</TableCell>
                      <TableCell className="text-right">{dish.protein_g}g</TableCell>
                      <TableCell className="text-right">{dish.carbs_g}g</TableCell>
                      <TableCell className="text-right">{dish.fats_g}g</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
