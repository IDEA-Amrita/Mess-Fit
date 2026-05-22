"use client";

import { useEffect, useState } from "react";
import { Mess, getMesses } from "@/lib/mess-api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function AdminMessesPage() {
  const [messes, setMesses] = useState<Mess[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMesses() {
      try {
        const data = await getMesses();
        setMesses(data);
      } catch (err) {
        console.error("Failed to load messes:", err);
      } finally {
        setLoading(false);
      }
    }
    loadMesses();
  }, []);

  return (
    <div className="container max-w-6xl py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin: Messes</h1>
        <p className="text-muted-foreground">Manage the registered messes.</p>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>College</TableHead>
              <TableHead>City</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  Loading messes...
                </TableCell>
              </TableRow>
            ) : messes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  No messes found.
                </TableCell>
              </TableRow>
            ) : (
              messes.map((mess) => (
                <TableRow key={mess.id}>
                  <TableCell className="font-medium">{mess.name}</TableCell>
                  <TableCell>{mess.college}</TableCell>
                  <TableCell>{mess.city}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant="secondary" className="cursor-pointer">Manage Menu</Badge>
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
