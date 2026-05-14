export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center">
      <h1 className="text-4xl font-bold">MessFit</h1>
      <p className="mt-2 text-muted-foreground">Eat well from what your mess serves.</p>
      <div className="mt-6 flex gap-3">
        <a href="/auth/signup" className="rounded bg-primary px-4 py-2 text-primary-foreground">Get Started</a>
        <a href="/auth/login" className="rounded border px-4 py-2">Log In</a>
      </div>
    </main>
  );
}