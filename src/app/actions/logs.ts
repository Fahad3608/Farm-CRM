"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { dec, reqDate, reqStr, str } from "@/lib/form";

type State = { error?: string; ok?: string } | undefined;

export async function addWeightAction(_prev: State, fd: FormData): Promise<State> {
  const user = await requireUser();
  if (!can.writeDailyLogs(user.role) && !can.writeHealth(user.role)) return { error: "Not permitted." };
  const animalId = reqStr(fd, "animalId");
  try {
    const weightKg = dec(fd, "weightKg");
    if (!weightKg) return { error: "Enter a weight." };
    await prisma.weightRecord.create({
      data: { animalId, date: reqDate(fd, "date", "Date"), weightKg, notes: str(fd, "notes") },
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save." };
  }
  revalidatePath(`/animals/${animalId}`);
  return { ok: "Weight recorded." };
}

export async function addMilkAction(_prev: State, fd: FormData): Promise<State> {
  const user = await requireUser();
  if (!can.writeDailyLogs(user.role)) return { error: "Not permitted." };
  const animalId = reqStr(fd, "animalId");
  try {
    const litres = dec(fd, "litres");
    if (litres === null) return { error: "Enter the litres produced." };
    await prisma.milkRecord.create({
      data: {
        animalId,
        date: reqDate(fd, "date", "Date"),
        session: str(fd, "session") ?? "AM",
        litres,
        notes: str(fd, "notes"),
      },
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save." };
  }
  revalidatePath(`/animals/${animalId}`);
  revalidatePath("/dashboard");
  return { ok: "Milk recorded." };
}

export async function deleteLogAction(fd: FormData) {
  await requireUser();
  const kind = reqStr(fd, "kind");
  const id = reqStr(fd, "id");
  const animalId = reqStr(fd, "animalId");
  if (kind === "weight") await prisma.weightRecord.delete({ where: { id } });
  if (kind === "milk") await prisma.milkRecord.delete({ where: { id } });
  revalidatePath(`/animals/${animalId}`);
}
