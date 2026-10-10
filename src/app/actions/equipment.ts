"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { dec, reqDate, reqStr, str } from "@/lib/form";
import { EQUIPMENT_COST_CATEGORIES, EQUIPMENT_KIND, EQUIPMENT_STATUS, LINKABLE_EQUIPMENT_EXPENSE } from "@/lib/equipment";
import type { EquipmentKind, EquipmentStatus } from "@prisma/client";

type State = { error?: string; ok?: string } | undefined;
function refresh() {
  revalidatePath("/equipment", "layout");
  revalidatePath("/finance");
  revalidatePath("/dashboard");
}

export async function saveEquipmentAction(_prev: State, fd: FormData): Promise<State> {
  const user = await requireUser();
  if (!can.editFinance(user.role)) return { error: "Not permitted." };
  const id = str(fd, "id");
  let savedId: string;
  try {
    const kind = reqStr(fd, "kind") as EquipmentKind;
    const status = reqStr(fd, "status") as EquipmentStatus;
    if (!Object.hasOwn(EQUIPMENT_KIND, kind) || !Object.hasOwn(EQUIPMENT_STATUS, status)) return { error: "Choose a valid type and status." };
    const data = { name: reqStr(fd, "name", "Item name"), kind, status, location: str(fd, "location"), notes: str(fd, "notes") };
    const item = id ? await prisma.equipment.update({ where: { id }, data }) : await prisma.equipment.create({ data });
    savedId = item.id;
  } catch {
    return { error: "Could not save this item. Please try again." };
  }
  refresh();
  if (!id) redirect(`/equipment/${savedId}`);
  return { ok: "Item saved." };
}

export async function addEquipmentExpenseAction(_prev: State, fd: FormData): Promise<State> {
  const user = await requireUser();
  if (!can.editFinance(user.role)) return { error: "Not permitted." };
  try {
    const equipmentId = reqStr(fd, "equipmentId");
    const amount = dec(fd, "amount");
    if (!amount || amount <= 0) return { error: "Enter an amount greater than zero." };
    const category = reqStr(fd, "category", "Category");
    if (!(EQUIPMENT_COST_CATEGORIES as readonly string[]).includes(category)) return { error: "Choose a construction or material category." };
    await prisma.transaction.create({ data: {
      equipmentId, type: "EXPENSE", category, amount, date: reqDate(fd, "date", "Date"),
      description: reqStr(fd, "description", "Description"), vendor: str(fd, "vendor"),
      paidBy: str(fd, "paidBy"), notAnimalSpecific: true, createdById: user.id,
    } });
  } catch (e) {
    return { error: e instanceof Error && !e.message.includes("prisma") ? e.message : "Could not add the expense. Check that the item still exists." };
  }
  refresh();
  return { ok: "Expense added to this item and Finance." };
}

export async function linkEquipmentExpenseAction(_prev: State, fd: FormData): Promise<State> {
  const user = await requireUser();
  if (!can.editFinance(user.role)) return { error: "Not permitted." };
  try {
    const equipmentId = reqStr(fd, "equipmentId");
    const id = reqStr(fd, "transactionId", "Expense");
    const result = await prisma.transaction.updateMany({
      where: { id, ...LINKABLE_EQUIPMENT_EXPENSE }, data: { equipmentId, notAnimalSpecific: true },
    });
    if (!result.count) return { error: "This expense is no longer available. It may already be linked." };
  } catch {
    return { error: "Could not link the expense. Please refresh and try again." };
  }
  refresh();
  return { ok: "Existing expense linked. No new ledger entry was created." };
}

export async function unlinkEquipmentExpenseAction(fd: FormData) {
  const user = await requireUser();
  if (!can.editFinance(user.role)) throw new Error("Not permitted.");
  await prisma.transaction.updateMany({
    where: { id: reqStr(fd, "transactionId"), equipmentId: reqStr(fd, "equipmentId") },
    data: { equipmentId: null },
  });
  refresh();
}

export async function deleteEquipmentAction(fd: FormData) {
  const user = await requireUser();
  if (!can.editFinance(user.role)) throw new Error("Not permitted.");
  await prisma.equipment.delete({ where: { id: reqStr(fd, "id") } });
  refresh();
  redirect("/equipment");
}
