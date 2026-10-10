"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { CATEGORY_GROUPS } from "@/lib/domain";
import { enumOf, reqStr, str } from "@/lib/form";
import type { TxnType } from "@prisma/client";

type State = { error?: string; ok?: string } | undefined;

export async function createCategoryAction(_prev: State, fd: FormData): Promise<State> {
  const user = await requireUser();
  if (!can.editFinance(user.role)) return { error: "Not permitted." };

  try {
    const name = reqStr(fd, "name", "Category name");
    const type = enumOf<TxnType>(fd, "type", ["EXPENSE", "INCOME"] as const, "EXPENSE");
    const group = type === "EXPENSE" ? str(fd, "group") : null;
    if (group && !CATEGORY_GROUPS.includes(group as typeof CATEGORY_GROUPS[number])) return { error: "Choose a valid spending group." };
    await prisma.category.create({ data: { name, type, group } });
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

/**
 * Assigns an expense category to a group (Operational, Capital &
 * Construction, ...) so it rolls up correctly on the Finance page. The
 * category may be a built-in one or one only ever typed freeform on a
 * transaction — either way this is the first time it becomes its own row,
 * so it's an upsert rather than an update.
 */
export async function setCategoryGroupAction(fd: FormData) {
  const user = await requireUser();
  if (!can.editFinance(user.role)) throw new Error("Not permitted.");
  const name = reqStr(fd, "name");
  const group = reqStr(fd, "group");
  if (!CATEGORY_GROUPS.includes(group as typeof CATEGORY_GROUPS[number])) throw new Error("Choose a valid spending group.");
  await prisma.category.upsert({
    where: { name_type: { name, type: "EXPENSE" } },
    create: { name, type: "EXPENSE", group },
    update: { group },
  });
  revalidatePath("/finance");
  revalidatePath("/settings");
}

/** Form version gives the inline manager success and validation feedback. */
export async function saveExpenseCategoryGroupAction(_prev: State, fd: FormData): Promise<State> {
  try {
    await setCategoryGroupAction(fd);
    return { ok: "Group saved for all months." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save the group." };
  }
}
