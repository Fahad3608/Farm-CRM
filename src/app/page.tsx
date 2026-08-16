import { redirect } from "next/navigation";
import { getSession, homeFor } from "@/lib/auth";
import { firstRunState } from "@/lib/firstRun";

export const dynamic = "force-dynamic";

export default async function Root() {
  const user = await getSession();
  if (user) redirect(homeFor(user.role));
  redirect((await firstRunState()) === "ready" ? "/login" : "/setup");
}
