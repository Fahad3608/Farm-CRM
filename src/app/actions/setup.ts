"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { createSession, hashPassword } from "@/lib/auth";
import { reqStr, str } from "@/lib/form";

type State = { error?: string } | undefined;

/**
 * Creates the very first account. Only works while the farm has no users at
 * all — once an owner exists this closes permanently, so the page cannot be
 * used to mint a second owner.
 */
export async function completeSetupAction(_prev: State, fd: FormData): Promise<State> {
  let userId: string;

  try {
    if ((await prisma.user.count()) > 0) {
      return { error: "This farm is already set up. Please sign in instead." };
    }

    const password = reqStr(fd, "password", "Password");
    if (password.length < 8) return { error: "Use a password of at least 8 characters." };
    if (password !== str(fd, "confirm")) return { error: "The two passwords do not match." };

    const farmName = reqStr(fd, "farmName", "Farm name");
    const currency = (str(fd, "currency") ?? "PKR").toUpperCase().slice(0, 3);

    const owner = await prisma.user.create({
      data: {
        name: reqStr(fd, "name", "Your name"),
        email: reqStr(fd, "email", "Email").toLowerCase(),
        phone: str(fd, "phone"),
        role: "OWNER",
        passwordHash: await hashPassword(password),
      },
    });
    userId = owner.id;

    for (const [key, value] of [["farmName", farmName], ["currency", currency], ["weightUnit", "kg"]]) {
      await prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
    }

    await createSession({ id: owner.id, email: owner.email, name: owner.name, role: owner.role });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not complete setup.";
    if (msg.includes("Unique constraint")) return { error: "That email is already in use." };
    if (msg.includes("does not exist") || msg.includes("Can't reach database")) {
      return { error: "The database is not reachable. Check DATABASE_URL and redeploy." };
    }
    return { error: msg };
  }

  revalidatePath("/", "layout");
  if (userId) redirect("/dashboard");
}
