"use client";

import { useEffect, useState } from "react";
import { Dish, getDishes } from "@/lib/mess-api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function AdminDishesPage() {
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDishes() {
      try {
        const data = await getDishes();
        setDishes(data);
      } catch (err) {
        console.error("Failed to load dishes:", err);
      } finally {
        setLoading(false);
      }
    }
    loadDishes();
  }, []);

  return (
    <div className="container max-w-6xl py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin: Dishes</h1>
        <p className="text-muted-foreground">Manage the central dish database.</p>
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
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Loading dishes...
                </TableCell>
              </TableRow>
            ) : dishes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No dishes found.
                </TableCell>
              </TableRow>
            ) : (
              dishes.map((dish) => (
                <TableRow key={dish.id}>
                  <TableCell className="font-medium">{dish.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">{dish.category}</Badge>
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
    </div>
  );
}
