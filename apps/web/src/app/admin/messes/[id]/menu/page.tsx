"use client";

// `params` isn't read yet (menu upload is a stub), but Next 15+ types every
// dynamic route's params as a Promise, even for a "use client" page — this
// only surfaced under a --webpack build; Turbopack's typegen didn't catch it.
export default function AdminMessMenuPage({ params: _params }: { params: Promise<{ id: string }> }) {
  return (
    <div className="container max-w-6xl py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Manage Mess Menu</h1>
        <p className="text-muted-foreground">Upload or edit the 7-day cyclic menu for this mess.</p>
      </div>

      <div className="rounded-md border p-8 text-center text-muted-foreground">
        <p>Menu upload functionality coming soon.</p>
        <p className="text-sm">For now, menus are seeded via backend scripts.</p>
      </div>
    </div>
  );
}
