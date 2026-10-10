"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { dec, date, enumOf, int, reqDate, reqStr, str } from "@/lib/form";
import { expectedDue } from "@/lib/domain";
import type { BreedingMethod, BreedingStatus } from "@prisma/client";

const METHODS = ["NATURAL", "ARTIFICIAL_INSEMINATION", "EMBRYO_TRANSFER"] as const;
const STATUSES = ["BRED", "CONFIRMED_PREGNANT", "NOT_PREGNANT", "ABORTED", "DELIVERED"] as const;

type State = { error?: string; ok?: string } | undefined;

export async function saveBreedingAction(_prev: State, fd: FormData): Promise<State> {
  const user = await requireUser();
  if (!can.writeBreeding(user.role)) return { error: "Not permitted." };

  const id = str(fd, "id");
  const damId = reqStr(fd, "damId", "Female animal");

  try {
    const dam = await prisma.animal.findUnique({ where: { id: damId } });
    if (!dam) return { error: "Animal not found." };

    const breedingDate = reqDate(fd, "breedingDate", "Breeding date");
    const status = enumOf<BreedingStatus>(fd, "status", STATUSES, "BRED");
    const due = date(fd, "expectedDueDate") ?? expectedDue(dam.species, breedingDate);

    const data = {
      damId,
      sireId: str(fd, "sireId"),
      sireName: str(fd, "sireName"),
      method: enumOf<BreedingMethod>(fd, "method", METHODS, "NATURAL"),
      breedingDate,
      expectedDueDate: due,
      confirmedAt: date(fd, "confirmedAt"),
      actualBirthDate: date(fd, "actualBirthDate"),
      offspringCount: int(fd, "offspringCount"),
      offspringNotes: str(fd, "offspringNotes"),
      status,
      cost: dec(fd, "cost"),
      notes: str(fd, "notes"),
    };

    if (id) await prisma.breedingRecord.update({ where: { id }, data });
    else await prisma.breedingRecord.create({ data });

    // Keep the animal's own repro status in step with its latest breeding record.
    const repro =
      status === "CONFIRMED_PREGNANT" ? "PREGNANT"
      : status === "BRED" ? "BRED"
      : status === "DELIVERED" ? "LACTATING"
      : "OPEN";

    await prisma.animal.update({
      where: { id: damId },
      data: {
        reproStatus: repro,
        expectedDueDate: status === "CONFIRMED_PREGNANT" || status === "BRED" ? due : null,
      },
    });

    if (data.cost && data.cost > 0 && !id) {
      await prisma.transaction.create({
        data: {
          date: breedingDate, type: "EXPENSE", category: "Breeding / AI", amount: data.cost,
          description: `Breeding — ${dam.name} (${dam.tagId})`, animalId: damId, createdById: user.id,
        },
      });
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save." };
  }

  revalidatePath("/breeding");
  revalidatePath(`/animals/${damId}`);
  revalidatePath("/dashboard");
  return { ok: "Breeding record saved." };
}

export async function markDeliveredAction(_prev: State, fd: FormData): Promise<State> {
  const user = await requireUser();
  if (!can.writeBreeding(user.role)) return { error: "Not permitted." };

  const id = reqStr(fd, "id", "Breeding record");

  try {
    const record = await prisma.breedingRecord.findUnique({ where: { id } });
    if (!record) return { error: "Record not found." };
    if (record.status === "DELIVERED") return { error: "Already marked as delivered." };

    const actualBirthDate = date(fd, "actualBirthDate") ?? new Date();
    const offspringCount = int(fd, "offspringCount");
    const offspringNotes = str(fd, "offspringNotes");

    await prisma.breedingRecord.update({
      where: { id },
      data: { status: "DELIVERED", actualBirthDate, offspringCount, offspringNotes },
    });

    await prisma.animal.update({
      where: { id: record.damId },
      data: { reproStatus: "LACTATING", expectedDueDate: null },
    });

    const offspringIds = fd.getAll("offspringId").map(String).filter(Boolean);
    for (const oid of offspringIds) {
      await prisma.animal.update({
        where: { id: oid },
        data: { motherId: record.damId },
      });
      revalidatePath(`/animals/${oid}`);
    }

    revalidatePath("/breeding");
    revalidatePath(`/animals/${record.damId}`);
    revalidatePath("/animals");
    revalidatePath("/dashboard");
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not update." };
  }

  return { ok: "Marked as delivered." };
}

export async function deleteBreedingAction(fd: FormData) {
  const user = await requireUser();
  if (!can.writeBreeding(user.role)) throw new Error("Not permitted.");
  await prisma.breedingRecord.delete({ where: { id: reqStr(fd, "id") } });
  revalidatePath("/breeding");
}
