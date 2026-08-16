import { redirect } from "next/navigation";
import { getSession, homeFor } from "@/lib/auth";
import { prisma } from "@/lib/db";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect(homeFor(session.role));

  const userCount = await prisma.user.count().catch(() => -1);

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

        {userCount === 0 && (
          <p className="mt-4 rounded-xl border border-warn/30 bg-warn/10 px-4 py-3 text-[13px] text-warn">
            No accounts exist yet. Run <code className="font-mono">npm run db:seed</code> to create the owner login.
          </p>
        )}
        {userCount === -1 && (
          <p className="mt-4 rounded-xl border border-bad/30 bg-bad/10 px-4 py-3 text-[13px] text-bad">
            Cannot reach the database. Check <code className="font-mono">DATABASE_URL</code> in your .env file.
          </p>
        )}
      </div>
    </main>
  );
}
