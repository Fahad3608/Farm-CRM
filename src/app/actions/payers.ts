"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { reqStr, str } from "@/lib/form";

type State = { error?: string; ok?: string } | undefined;

/** Adds someone who funds the farm, so they can be picked on any entry. */
export async function createPayerAction(_prev: State, fd: FormData): Promise<State> {
  const user = await requireUser();
  if (!can.editFinance(user.role)) return { error: "Not permitted." };

  try {
    await prisma.payer.create({ data: { name: reqStr(fd, "name", "Name"), notes: str(fd, "notes") } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not save.";
    if (msg.includes("Unique constraint")) return { error: "That payer already exists." };
    return { error: msg };
  }

  revalidatePath("/finance");
  revalidatePath("/settings");
  return { ok: "Payer added." };
}

export async function deletePayerAction(fd: FormData) {
  const user = await requireUser();
  if (!can.editFinance(user.role)) throw new Error("Not permitted.");
  const id = reqStr(fd, "id");
  // Transactions keep the name they were saved with — this only removes the
  // suggestion, the same way deleting a category does.
  await prisma.payer.delete({ where: { id } });
  revalidatePath("/finance");
  revalidatePath("/settings");
}

/**
 * Renames a payer everywhere at once — the suggestion and every entry already
 * recorded under the old name — so a typo doesn't split one person's
 * investment across two totals.
 */
export async function renamePayerAction(_prev: State, fd: FormData): Promise<State> {
  const user = await requireUser();
  if (!can.editFinance(user.role)) return { error: "Not permitted." };

  try {
    const id = reqStr(fd, "id");
    const name = reqStr(fd, "name", "Name");
    const payer = await prisma.payer.findUniqueOrThrow({ where: { id }, select: { name: true } });
    if (payer.name === name) return { ok: "Nothing to change." };

    await prisma.$transaction([
      prisma.payer.update({ where: { id }, data: { name } }),
      prisma.transaction.updateMany({ where: { paidBy: payer.name }, data: { paidBy: name } }),
    ]);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not save.";
    if (msg.includes("Unique constraint")) return { error: "Another payer already has that name." };
    return { error: msg };
  }

  revalidatePath("/finance");
  revalidatePath("/settings");
  return { ok: "Payer renamed." };
}
