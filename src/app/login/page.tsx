import { redirect } from "next/navigation";
import { getSession, homeFor } from "@/lib/auth";
import { firstRunState } from "@/lib/firstRun";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect(homeFor(session.role));

  // A brand-new install has no accounts yet — send them to first-run setup.
  const state = await firstRunState();
  if (state === "needs-setup") redirect("/setup");

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-7 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" width={52} height={52} className="mx-auto rounded-2xl" />
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">Farm CRM</h1>
          <p className="mt-1 text-[14px] text-muted">Livestock, health, feed and finances.</p>
        </div>

        <div className="card p-5">
          <LoginForm />
        </div>

        {state === "no-database" && (
          <p className="mt-4 rounded-xl border border-bad/30 bg-bad/10 px-4 py-3 text-[13px] text-bad">
            Cannot reach the database. Check that <code className="font-mono">DATABASE_URL</code> is set
            correctly, then redeploy.
          </p>
        )}
      </div>
    </main>
  );
}
