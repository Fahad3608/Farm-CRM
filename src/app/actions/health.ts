"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { bool, date, dec, enumOf, reqDate, reqStr, str } from "@/lib/form";
import type { HealthRecordType } from "@prisma/client";

const TYPES = ["VACCINATION", "INJECTION", "DEWORMING", "TREATMENT", "CHECKUP", "SURGERY", "LAB_TEST", "HOOF_CARE", "PREGNANCY_CHECK", "DEATH_REPORT", "OTHER"] as const;

type State = { error?: string; ok?: string } | undefined;

/**
 * Creates/updates a health record and keeps the ledger in sync.
 * Medicine cost + vet fee roll up into one linked EXPENSE transaction,
 * so nothing is ever counted twice.
 */
export async function saveHealthRecordAction(_prev: State, fd: FormData): Promise<State> {
  const user = await requireUser();
  if (!can.writeHealth(user.role)) return { error: "You do not have permission to add health records." };

  const id = str(fd, "id");
  const animalId = reqStr(fd, "animalId", "Animal");

  try {
    const data = {
      animalId,
      type: enumOf<HealthRecordType>(fd, "type", TYPES, "TREATMENT"),
      date: reqDate(fd, "date", "Date"),
      title: reqStr(fd, "title", "Title"),
      medicine: str(fd, "medicine"),
      brand: str(fd, "brand"),
      batchNo: str(fd, "batchNo"),
      dosage: str(fd, "dosage"),
      route: str(fd, "route"),
      diagnosis: str(fd, "diagnosis"),
      treatment: str(fd, "treatment"),
      symptoms: str(fd, "symptoms"),
      temperatureC: dec(fd, "temperatureC"),
      weightKg: dec(fd, "weightKg"),
      withdrawalUntil: date(fd, "withdrawalUntil"),
      nextDueDate: date(fd, "nextDueDate"),
      followUpDone: bool(fd, "followUpDone"),
      medicineCost: dec(fd, "medicineCost"),
      vetFee: dec(fd, "vetFee"),
      vetName: str(fd, "vetName") ?? (user.role === "VET" ? user.name : null),
      vetId: user.role === "VET" ? user.id : (str(fd, "vetId") ?? null),
      notes: str(fd, "notes"),
    };

    const record = id
      ? await prisma.healthRecord.update({ where: { id }, data })
      : await prisma.healthRecord.create({ data: { ...data, createdById: user.id } });

    // Keep a weight entry in the growth chart when the vet weighed the animal.
    if (data.weightKg && !id) {
      await prisma.weightRecord.create({
        data: { animalId, date: data.date, weightKg: data.weightKg, notes: `Recorded during: ${data.title}` },
      });
    }

    const total = (data.medicineCost ?? 0) + (data.vetFee ?? 0);
    const existing = await prisma.transaction.findUnique({ where: { healthRecordId: record.id } });

    if (total > 0) {
      const txn = {
        date: data.date,
        type: "EXPENSE" as const,
        category: data.type === "VACCINATION" || data.type === "DEWORMING" || data.type === "INJECTION" ? "Medicine" : "Veterinary",
        amount: total,
        description: `${data.title}${data.medicine ? ` — ${data.medicine}` : ""}`,
        vendor: data.vetName,
        animalId,
      };
      if (existing) await prisma.transaction.update({ where: { id: existing.id }, data: txn });
      else await prisma.transaction.create({ data: { ...txn, healthRecordId: record.id, createdById: user.id } });
    } else if (existing) {
      await prisma.transaction.delete({ where: { id: existing.id } });
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save the record." };
  }

  revalidatePath(`/animals/${animalId}`);
  revalidatePath("/health");
  revalidatePath("/vet");
  revalidatePath("/finance");
  revalidatePath("/dashboard");
  return { ok: "Health record saved." };
}

export async function deleteHealthRecordAction(fd: FormData) {
  const user = await requireUser();
  if (!can.writeHealth(user.role)) throw new Error("Not permitted.");
  const id = reqStr(fd, "id");
  const rec = await prisma.healthRecord.findUnique({ where: { id } });
  await prisma.healthRecord.delete({ where: { id } });
  if (rec) revalidatePath(`/animals/${rec.animalId}`);
  revalidatePath("/health");
  revalidatePath("/finance");
}

export async function markFollowUpDoneAction(fd: FormData) {
  await requireUser();
  const id = reqStr(fd, "id");
  await prisma.healthRecord.update({ where: { id }, data: { followUpDone: true } });
  revalidatePath("/health");
  revalidatePath("/vet");
  revalidatePath("/dashboard");
}
