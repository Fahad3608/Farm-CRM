import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="text-4xl">🐄</div>
      <h1 className="text-xl font-semibold">This page has wandered off</h1>
      <p className="text-[14px] text-muted">The page you were looking for does not exist.</p>
      <Link href="/" className="btn-primary mt-2">Back to the farm</Link>
    </main>
  );
}
