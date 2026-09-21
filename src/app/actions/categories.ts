"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { enumOf, reqStr } from "@/lib/form";
import type { TxnType } from "@prisma/client";

type State = { error?: string; ok?: string } | undefined;

export async function createCategoryAction(_prev: State, fd: FormData): Promise<State> {
  const user = await requireUser();
  if (!can.editFinance(user.role)) return { error: "Not permitted." };

  try {
    const name = reqStr(fd, "name", "Category name");
    const type = enumOf<TxnType>(fd, "type", ["EXPENSE", "INCOME"] as const, "EXPENSE");
    await prisma.category.create({ data: { name, type } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not save.";
    if (msg.includes("Unique constraint")) return { error: "That category already exists." };
    return { error: msg };
  }

  revalidatePath("/finance");
  revalidatePath("/settings");
  return { ok: "Category added." };
}

export async function deleteCategoryAction(fd: FormData) {
  const user = await requireUser();
  if (!can.editFinance(user.role)) throw new Error("Not permitted.");
  const id = reqStr(fd, "id");
  await prisma.category.delete({ where: { id } });
  revalidatePath("/finance");
  revalidatePath("/settings");
}
