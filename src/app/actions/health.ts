"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { bool, date, dec, enumOf, reqDate, reqStr, str } from "@/lib/form";
import type { HealthRecordType } from "@prisma/client";

const TYPES = ["VACCINATION", "INJECTION", "DEWORMING", "TREATMENT", "CHECKUP", "SURGERY", "LAB_TEST", "HOOF_CARE", "PREGNANCY_CHECK", "INSEMINATION", "DEATH_REPORT", "OTHER"] as const;

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
  // A vet is never shown the cost fields, so their save must leave whatever
  // the owner recorded against this visit untouched.
  const costs = can.viewFinance(user.role)
    ? { medicineCost: dec(fd, "medicineCost"), vetFee: dec(fd, "vetFee") }
    : null;

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
      ...costs,
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

    if (costs) {
      const total = (costs.medicineCost ?? 0) + (costs.vetFee ?? 0);
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

/**
 * Creates the same health record for multiple animals at once — a vet visit
 * where every selected animal gets the same treatment, vaccination, etc.
 * Each animal gets its own HealthRecord and linked Transaction.
 */
export async function saveVetVisitAction(_prev: State, fd: FormData): Promise<State> {
  const user = await requireUser();
  if (!can.writeHealth(user.role)) return { error: "You do not have permission to add health records." };

  const animalIds = fd.getAll("animalId").map(String).filter(Boolean);
  if (animalIds.length === 0) return { error: "Select at least one animal." };

  const costs = can.viewFinance(user.role)
    ? { medicineCost: dec(fd, "medicineCost"), vetFee: dec(fd, "vetFee") }
    : null;

  try {
    const base = {
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
      followUpDone: false,
      ...costs,
      vetName: str(fd, "vetName") ?? (user.role === "VET" ? user.name : null),
      vetId: user.role === "VET" ? user.id : (str(fd, "vetId") ?? null),
      notes: str(fd, "notes"),
    };

    for (const animalId of animalIds) {
      const record = await prisma.healthRecord.create({
        data: { ...base, animalId, createdById: user.id },
      });

      if (base.weightKg) {
        await prisma.weightRecord.create({
          data: { animalId, date: base.date, weightKg: base.weightKg, notes: `Recorded during: ${base.title}` },
        });
      }

      if (costs) {
        const total = (costs.medicineCost ?? 0) + (costs.vetFee ?? 0);
        if (total > 0) {
          const category = base.type === "VACCINATION" || base.type === "DEWORMING" || base.type === "INJECTION" ? "Medicine" : "Veterinary";
          await prisma.transaction.create({
            data: {
              date: base.date,
              type: "EXPENSE",
              category,
              amount: total,
              description: `${base.title}${base.medicine ? ` — ${base.medicine}` : ""}`,
              vendor: base.vetName,
              animalId,
              healthRecordId: record.id,
              createdById: user.id,
            },
          });
        }
      }

      revalidatePath(`/animals/${animalId}`);
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save the records." };
  }

  revalidatePath("/health");
  revalidatePath("/vet");
  revalidatePath("/finance");
  revalidatePath("/dashboard");
  return { ok: `Health record saved for ${animalIds.length} animal${animalIds.length === 1 ? "" : "s"}.` };
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
