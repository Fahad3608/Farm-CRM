"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { dec, reqDate, reqStr, str } from "@/lib/form";

type State = { error?: string; ok?: string } | undefined;

export async function saveBatchAction(_prev: State, fd: FormData): Promise<State> {
  const user = await requireUser();
  if (!can.editFinance(user.role)) return { error: "Not permitted." };

  const id = str(fd, "id");
  let newId = id;
  try {
    const data = {
      name: reqStr(fd, "name", "Batch name"),
      date: reqDate(fd, "date", "Date"),
      notes: str(fd, "notes"),
    };

    if (id) {
      await prisma.purchaseBatch.update({ where: { id }, data });
    } else {
      const batch = await prisma.purchaseBatch.create({ data });
      newId = batch.id;
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save." };
  }

  revalidatePath("/batches");
  if (newId && newId !== id) redirect(`/batches/${newId}`);
  if (id) revalidatePath(`/batches/${id}`);
  return { ok: "Batch saved." };
}

export async function addBatchCostAction(_prev: State, fd: FormData): Promise<State> {
  const user = await requireUser();
  if (!can.editFinance(user.role)) return { error: "Not permitted." };

  const batchId = reqStr(fd, "batchId");
  try {
    const amount = dec(fd, "amount");
    if (!amount || amount <= 0) return { error: "Enter an amount greater than zero." };

    const description = reqStr(fd, "description", "Description");
    const batch = await prisma.purchaseBatch.findUniqueOrThrow({ where: { id: batchId }, select: { name: true, date: true } });
    const cost = await prisma.batchCost.create({ data: { batchId, description, amount } });

    await prisma.transaction.create({
      data: {
        date: batch.date,
        type: "EXPENSE",
        category: "Batch Cost",
        amount,
        description: `${description} — ${batch.name}`,
        notAnimalSpecific: true,
        batchCostId: cost.id,
        createdById: user.id,
      },
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save." };
  }

  revalidatePath(`/batches/${batchId}`);
  revalidatePath("/finance");
  return { ok: "Cost added." };
}

export async function deleteBatchCostAction(fd: FormData) {
  const user = await requireUser();
  if (!can.editFinance(user.role)) throw new Error("Not permitted.");
  const id = reqStr(fd, "id");
  const cost = await prisma.batchCost.findUnique({ where: { id }, select: { batchId: true } });
  await prisma.batchCost.delete({ where: { id } });
  if (cost) revalidatePath(`/batches/${cost.batchId}`);
  revalidatePath("/finance");
}

export async function addAnimalToBatchAction(_prev: State, fd: FormData): Promise<State> {
  const user = await requireUser();
  if (!can.editFinance(user.role)) return { error: "Not permitted." };

  const batchId = reqStr(fd, "batchId");
  const animalId = reqStr(fd, "animalId", "Animal");

  const already = await prisma.animal.findUnique({ where: { id: animalId }, select: { purchaseBatchId: true } });
  if (already?.purchaseBatchId === batchId) return { error: "Already in this batch." };
  if (already?.purchaseBatchId) return { error: "This animal is already in another batch. Remove it there first." };

  await prisma.animal.update({ where: { id: animalId }, data: { purchaseBatchId: batchId } });
  revalidatePath(`/batches/${batchId}`);
  revalidatePath(`/animals/${animalId}`);
  return { ok: "Animal added to batch." };
}

export async function removeAnimalFromBatchAction(fd: FormData) {
  const user = await requireUser();
  if (!can.editFinance(user.role)) throw new Error("Not permitted.");
  const animalId = reqStr(fd, "animalId");
  const batchId = reqStr(fd, "batchId");
  await prisma.animal.update({ where: { id: animalId }, data: { purchaseBatchId: null } });
  revalidatePath(`/batches/${batchId}`);
  revalidatePath(`/animals/${animalId}`);
}

export async function deleteBatchAction(fd: FormData) {
  const user = await requireUser();
  if (!can.editFinance(user.role)) throw new Error("Not permitted.");
  const id = reqStr(fd, "id");
  await prisma.$transaction([
    prisma.animal.updateMany({ where: { purchaseBatchId: id }, data: { purchaseBatchId: null } }),
    prisma.purchaseBatch.delete({ where: { id } }),
  ]);
  revalidatePath("/batches");
  revalidatePath("/finance");
  redirect("/batches");
}

export async function backfillBatchCostTransactionsAction(_prev: State, _fd: FormData): Promise<State> {
  const user = await requireUser();
  if (!can.editFinance(user.role)) return { error: "Not permitted." };

  const costs = await prisma.batchCost.findMany({
    where: { transaction: null },
    include: { batch: { select: { name: true, date: true } } },
  });

  let added = 0;
  for (const cost of costs) {
    await prisma.transaction.create({
      data: {
        date: cost.batch.date,
        type: "EXPENSE",
        category: "Batch Cost",
        amount: cost.amount,
        description: `${cost.description} — ${cost.batch.name}`,
        notAnimalSpecific: true,
        batchCostId: cost.id,
        createdById: user.id,
      },
    });
    added++;
  }

  revalidatePath("/finance");
  revalidatePath("/dashboard");
  return {
    ok: added > 0
      ? `Added ${added} missing batch cost${added === 1 ? "" : "s"} to Finance.`
      : "Nothing to fix — every batch cost already has a Finance entry.",
  };
}
