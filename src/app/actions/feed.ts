"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { bool, dec, reqDate, reqStr, str } from "@/lib/form";

type State = { error?: string; ok?: string } | undefined;

export async function saveFeedTypeAction(_prev: State, fd: FormData): Promise<State> {
  const user = await requireUser();
  if (!can.manageSettings(user.role)) return { error: "Not permitted." };
  const id = str(fd, "id");
  try {
    const data = {
      name: reqStr(fd, "name", "Feed name"),
      category: str(fd, "category"),
      unit: str(fd, "unit") ?? "kg",
      costPerUnit: dec(fd, "costPerUnit") ?? 0,
      supplier: str(fd, "supplier"),
      notes: str(fd, "notes"),
      active: id ? bool(fd, "active") : true,
    };
    if (id) await prisma.feedType.update({ where: { id }, data });
    else await prisma.feedType.create({ data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not save.";
    return { error: msg.includes("Unique constraint") ? "A feed with that name already exists." : msg };
  }
  revalidatePath("/feed");
  return { ok: "Feed saved." };
}

/**
 * Logs feed given to one animal or to a group.
 * Group logs are split evenly across head count so per-animal cost stays honest.
 */
export async function addFeedLogAction(_prev: State, fd: FormData): Promise<State> {
  const user = await requireUser();
  if (!can.writeDailyLogs(user.role)) return { error: "Not permitted." };

  try {
    const feedTypeId = reqStr(fd, "feedTypeId", "Feed");
    const feed = await prisma.feedType.findUnique({ where: { id: feedTypeId } });
    if (!feed) return { error: "That feed no longer exists." };

    const quantity = dec(fd, "quantity");
    if (!quantity || quantity <= 0) return { error: "Enter a quantity greater than zero." };

    const unitCost = dec(fd, "unitCost") ?? Number(feed.costPerUnit);
    const when = reqDate(fd, "date", "Date");
    const notes = str(fd, "notes");
    const target = str(fd, "target") ?? "animal"; // "animal" | "group"

    if (target === "animal") {
      const animalId = reqStr(fd, "animalId", "Animal");
      const total = quantity * unitCost;
      const log = await prisma.feedLog.create({
        data: { date: when, feedTypeId, animalId, quantity, unitCost, totalCost: total, notes, recordedById: user.id, headCount: 1 },
      });
      if (total > 0) {
        await prisma.transaction.create({
          data: {
            date: when, type: "EXPENSE", category: "Feed", amount: total,
            description: `${feed.name} — ${quantity} ${feed.unit}`,
            vendor: feed.supplier, animalId, feedLogId: log.id, createdById: user.id,
          },
        });
      }
      revalidatePath(`/animals/${animalId}`);
    } else {
      // Group feeding: one row per animal in the group, cost divided evenly.
      const ids = fd.getAll("groupAnimalIds").map(String).filter(Boolean);
      if (!ids.length) return { error: "Select at least one animal for the group." };
      const groupLabel = str(fd, "groupLabel") ?? `${ids.length} animals`;
      const perQty = quantity / ids.length;
      const perCost = (quantity * unitCost) / ids.length;

      for (const animalId of ids) {
        const log = await prisma.feedLog.create({
          data: {
            date: when, feedTypeId, animalId, groupLabel, headCount: ids.length,
            quantity: perQty, unitCost, totalCost: perCost, notes, recordedById: user.id,
          },
        });
        if (perCost > 0) {
          await prisma.transaction.create({
            data: {
              date: when, type: "EXPENSE", category: "Feed", amount: perCost,
              description: `${feed.name} — group "${groupLabel}"`,
              vendor: feed.supplier, animalId, feedLogId: log.id, createdById: user.id,
            },
          });
        }
      }
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save the feed log." };
  }

  revalidatePath("/feed");
  revalidatePath("/finance");
  revalidatePath("/dashboard");
  return { ok: "Feed logged." };
}

export async function deleteFeedLogAction(fd: FormData) {
  const user = await requireUser();
  if (!can.writeDailyLogs(user.role)) throw new Error("Not permitted.");
  await prisma.feedLog.delete({ where: { id: reqStr(fd, "id") } });
  revalidatePath("/feed");
  revalidatePath("/finance");
}
