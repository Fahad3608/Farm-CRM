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

    if (id) await prisma.transaction.update({ where: { id }, data });
    else await prisma.transaction.create({ data: { ...data, createdById: user.id } });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save." };
  }

  revalidatePath("/finance");
  revalidatePath("/dashboard");
  return { ok: "Transaction saved." };
}

export async function deleteTransactionAction(fd: FormData) {
  const user = await requireUser();
  if (!can.editFinance(user.role)) throw new Error("Not permitted.");
  const id = reqStr(fd, "id");
  const txn = await prisma.transaction.findUnique({ where: { id } });
  if (txn?.healthRecordId || txn?.feedLogId) {
    throw new Error("This entry comes from a health or feed record — delete it there instead.");
  }
  await prisma.transaction.delete({ where: { id } });
  revalidatePath("/finance");
  revalidatePath("/dashboard");
}
