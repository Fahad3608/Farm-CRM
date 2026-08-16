import { redirect } from "next/navigation";
import { getSession, homeFor } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Root() {
  const user = await getSession();
  redirect(user ? homeFor(user.role) : "/login");
}
