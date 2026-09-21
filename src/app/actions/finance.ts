"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { dec, enumOf, reqDate, reqStr, str } from "@/lib/form";
import type { TxnType } from "@prisma/client";

type State = { error?: string; ok?: string } | undefined;

export async function saveTransactionAction(_prev: State, fd: FormData): Promise<State> {
  const user = await requireUser();
  if (!can.editFinance(user.role)) return { error: "Not permitted." };

  const id = str(fd, "id");
  let animalId: string | null = null;
  try {
    const amount = dec(fd, "amount");
    if (!amount || amount <= 0) return { error: "Enter an amount greater than zero." };

    const data = {
      date: reqDate(fd, "date", "Date"),
      type: enumOf<TxnType>(fd, "type", ["INCOME", "EXPENSE"] as const, "EXPENSE"),
      category: reqStr(fd, "category", "Category"),
      amount,
      description: str(fd, "description"),
      vendor: str(fd, "vendor"),
      paymentMethod: str(fd, "paymentMethod"),
      reference: str(fd, "reference"),
      animalId: str(fd, "animalId"),
    };
    animalId = data.animalId;

    if (id) await prisma.transaction.update({ where: { id }, data });
    else await prisma.transaction.create({ data: { ...data, createdById: user.id } });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save." };
  }

  revalidatePath("/finance");
  revalidatePath("/dashboard");
  if (animalId) revalidatePath(`/animals/${animalId}`);
  return { ok: "Transaction saved." };
}

/**
 * Records several transactions at once from a pasted list — e.g. a spreadsheet
 * of startup or one-off costs — sharing one date, type, category and animal.
 * Each line is "description, amount"; all-or-nothing so a typo on one line
 * doesn't leave a half-entered batch.
 */
export async function saveBulkTransactionsAction(_prev: State, fd: FormData): Promise<State> {
  const user = await requireUser();
  if (!can.editFinance(user.role)) return { error: "Not permitted." };

  try {
    const date = reqDate(fd, "date", "Date");
    const type = enumOf<TxnType>(fd, "type", ["INCOME", "EXPENSE"] as const, "EXPENSE");
    const category = reqStr(fd, "category", "Category");
    const animalId = str(fd, "animalId");
    const linesRaw = reqStr(fd, "lines", "Expenses");

    const rows = linesRaw
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line, i) => {
        const idx = line.lastIndexOf(",");
        if (idx === -1) throw new Error(`Line ${i + 1} needs a comma before the amount: "${line}"`);
        const description = line.slice(0, idx).trim();
        const amount = Number(line.slice(idx + 1).trim().replace(/,/g, ""));
        if (!description) throw new Error(`Line ${i + 1} is missing a description.`);
        if (!Number.isFinite(amount) || amount <= 0) throw new Error(`Line ${i + 1} has an invalid amount: "${line}"`);
        return { description, amount };
      });

    if (rows.length === 0) return { error: "Add at least one line." };

    await prisma.transaction.createMany({
      data: rows.map((r) => ({
        date, type, category, amount: r.amount, description: r.description,
        animalId, notAnimalSpecific: !animalId, createdById: user.id,
      })),
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save." };
  }

  revalidatePath("/finance");
  revalidatePath("/dashboard");
  return { ok: "Saved." };
}

/** Links an existing unlinked expense to an animal, from the "needs review" list. */
export async function linkTransactionAnimalAction(fd: FormData) {
  const user = await requireUser();
  if (!can.editFinance(user.role)) throw new Error("Not permitted.");
  const id = reqStr(fd, "id");
  const animalId = reqStr(fd, "animalId", "Animal");
  await prisma.transaction.update({ where: { id }, data: { animalId, notAnimalSpecific: false } });
  revalidatePath("/finance");
  revalidatePath(`/animals/${animalId}`);
}

/** Marks an expense as genuinely farm-wide, so it stops showing up as "needs review". */
export async function markNotAnimalSpecificAction(fd: FormData) {
  const user = await requireUser();
  if (!can.editFinance(user.role)) throw new Error("Not permitted.");
  const id = reqStr(fd, "id");
  await prisma.transaction.update({ where: { id }, data: { notAnimalSpecific: true } });
  revalidatePath("/finance");
}

/**
 * Deletes every transaction matching the Finance page's current filter
 * (date range, type, one or more categories) in one go, e.g. to undo a bulk
 * paste that went in under the wrong category. No categories checked means
 * the filter isn't applied. Auto-linked rows (from a health or feed record)
 * are left alone, same as the single delete.
 */
export async function deleteFilteredTransactionsAction(fd: FormData) {
  const user = await requireUser();
  if (!can.editFinance(user.role)) throw new Error("Not permitted.");

  const from = reqStr(fd, "from", "From");
  const to = reqStr(fd, "to", "To");
  const type = str(fd, "type");
  const categories = fd.getAll("category").map(String).filter(Boolean);

  await prisma.transaction.deleteMany({
    where: {
      date: { gte: new Date(`${from}T00:00:00`), lte: new Date(`${to}T23:59:59`) },
      ...(categories.length > 0 ? { category: { in: categories } } : {}),
      ...(type && type !== "ALL" ? { type: type as TxnType } : {}),
      healthRecordId: null,
      feedLogId: null,
      batchCostId: null,
    },
  });

  revalidatePath("/finance");
  revalidatePath("/dashboard");
}

/**
 * Applies a new date and/or category to every transaction matching the
 * Finance page's current filter — the same multi-category checklist as the
 * filtered delete, so a whole family of categories (Material cost, Labour
 * cost...) can be corrected together without selecting each row by hand.
 * Auto-linked rows are left alone.
 */
export async function editFilteredTransactionsAction(fd: FormData) {
  const user = await requireUser();
  if (!can.editFinance(user.role)) throw new Error("Not permitted.");

  const from = reqStr(fd, "from", "From");
  const to = reqStr(fd, "to", "To");
  const type = str(fd, "type");
  const categories = fd.getAll("category").map(String).filter(Boolean);

  const setDate = str(fd, "setDate");
  const setCategory = str(fd, "setCategory");
  const data: { date?: Date; category?: string } = {};
  if (setDate) data.date = new Date(`${setDate}T12:00:00`);
  if (setCategory) data.category = setCategory;
  if (Object.keys(data).length === 0) return;

  await prisma.transaction.updateMany({
    where: {
      date: { gte: new Date(`${from}T00:00:00`), lte: new Date(`${to}T23:59:59`) },
      ...(categories.length > 0 ? { category: { in: categories } } : {}),
      ...(type && type !== "ALL" ? { type: type as TxnType } : {}),
      healthRecordId: null,
      feedLogId: null,
      batchCostId: null,
    },
    data,
  });

  revalidatePath("/finance");
  revalidatePath("/dashboard");
}

/**
 * Applies a new date and/or category to every transaction checked off in the
 * ledger — e.g. a batch of items entered under the wrong date can be fixed
 * in one go instead of editing each row by hand. Only the fields actually
 * filled in are changed; auto-linked (health/feed) rows are left alone.
 */
export async function bulkEditSelectedTransactionsAction(fd: FormData) {
  const user = await requireUser();
  if (!can.editFinance(user.role)) throw new Error("Not permitted.");

  const ids = fd.getAll("ids").map(String).filter(Boolean);
  if (ids.length === 0) return;

  const dateStr = str(fd, "date");
  const category = str(fd, "category");
  const data: { date?: Date; category?: string } = {};
  if (dateStr) data.date = new Date(`${dateStr}T12:00:00`);
  if (category) data.category = category;
  if (Object.keys(data).length === 0) return;

  await prisma.transaction.updateMany({
    where: { id: { in: ids }, healthRecordId: null, feedLogId: null, batchCostId: null },
    data,
  });

  revalidatePath("/finance");
  revalidatePath("/dashboard");
}

/** Deletes whichever transactions were checked off in the ledger, regardless of filter. */
export async function deleteSelectedTransactionsAction(fd: FormData) {
  const user = await requireUser();
  if (!can.editFinance(user.role)) throw new Error("Not permitted.");

  const ids = fd.getAll("ids").map(String).filter(Boolean);
  if (ids.length === 0) return;

  await prisma.transaction.deleteMany({
    where: { id: { in: ids }, healthRecordId: null, feedLogId: null, batchCostId: null },
  });

  revalidatePath("/finance");
  revalidatePath("/dashboard");
}

export async function deleteTransactionAction(fd: FormData) {
  const user = await requireUser();
  if (!can.editFinance(user.role)) throw new Error("Not permitted.");
  const id = reqStr(fd, "id");
  const txn = await prisma.transaction.findUnique({ where: { id } });
  if (txn?.healthRecordId || txn?.feedLogId || txn?.batchCostId) {
    throw new Error("This entry comes from a health, feed, or batch cost record — delete it there instead.");
  }
  await prisma.transaction.delete({ where: { id } });
  revalidatePath("/finance");
  revalidatePath("/dashboard");
}
