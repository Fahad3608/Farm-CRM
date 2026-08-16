import Link from "next/link";
import { redirect } from "next/navigation";
import { firstRunState } from "@/lib/firstRun";
import SetupForm from "./SetupForm";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const state = await firstRunState();
  if (state === "ready") redirect("/login");

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" width={52} height={52} className="mx-auto rounded-2xl" />
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">Welcome to your Farm CRM</h1>
          <p className="mt-1.5 text-[14px] text-muted">
            Nothing is set up yet. Create your owner account and you&rsquo;re ready to go.
          </p>
        </div>

        {state === "no-database" ? (
          <div className="card p-5">
            <h2 className="font-semibold text-bad">Database not reachable</h2>
            <p className="mt-2 text-[13.5px] text-muted">
              The app is running, but it cannot reach your database. Check that{" "}
              <code className="font-mono text-ink">DATABASE_URL</code> is set correctly in your hosting
              environment, then redeploy. This page picks up automatically once the connection works.
            </p>
          </div>
        ) : (
          <div className="card p-5">
            <SetupForm />
          </div>
        )}

        <p className="mt-4 text-center text-[13px] text-muted">
          Already set this up? <Link href="/login" className="text-brand hover:underline">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
