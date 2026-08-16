"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { bool, date, dec, enumOf, reqDate, reqStr, str } from "@/lib/form";
import type { AcquisitionType, AnimalStatus, ReproStatus, Sex, Species } from "@prisma/client";

const SPECIES_VALUES = ["COW", "BUFFALO", "GOAT", "SHEEP", "HORSE", "POULTRY", "OTHER"] as const;
const SEX_VALUES = ["MALE", "FEMALE"] as const;
const STATUS_VALUES = ["ACTIVE", "SOLD", "DECEASED", "CULLED", "LOANED_OUT"] as const;
const REPRO_VALUES = ["NOT_APPLICABLE", "OPEN", "BRED", "PREGNANT", "LACTATING", "DRY", "CASTRATED"] as const;
const ACQ_VALUES = ["BORN_ON_FARM", "PURCHASED", "GIFTED", "INHERITED", "OTHER"] as const;

type State = { error?: string; ok?: string } | undefined;

function readAnimal(fd: FormData) {
  return {
    tagId: reqStr(fd, "tagId", "Tag / ID"),
    name: reqStr(fd, "name", "Name"),
    species: enumOf<Species>(fd, "species", SPECIES_VALUES, "COW"),
    breed: str(fd, "breed"),
    sex: enumOf<Sex>(fd, "sex", SEX_VALUES, "FEMALE"),
    color: str(fd, "color"),
    markings: str(fd, "markings"),
    hornStatus: str(fd, "hornStatus"),
    microchip: str(fd, "microchip"),
    dateOfBirth: date(fd, "dateOfBirth"),
    ageIsEstimated: bool(fd, "ageIsEstimated"),
    dateJoined: reqDate(fd, "dateJoined", "Date joined the farm"),
    acquisition: enumOf<AcquisitionType>(fd, "acquisition", ACQ_VALUES, "BORN_ON_FARM"),
    sourceName: str(fd, "sourceName"),
    status: enumOf<AnimalStatus>(fd, "status", STATUS_VALUES, "ACTIVE"),
    exitDate: date(fd, "exitDate"),
    exitReason: str(fd, "exitReason"),
    buyerName: str(fd, "buyerName"),
    reproStatus: enumOf<ReproStatus>(fd, "reproStatus", REPRO_VALUES, "NOT_APPLICABLE"),
    expectedDueDate: date(fd, "expectedDueDate"),
    penOrLocation: str(fd, "penOrLocation"),
    insuranceNo: str(fd, "insuranceNo"),
    notes: str(fd, "notes"),
    motherId: str(fd, "motherId"),
    fatherId: str(fd, "fatherId"),
  };
}

export async function saveAnimalAction(_prev: State, fd: FormData): Promise<State> {
  const user = await requireUser();
  if (!can.manageAnimals(user.role)) return { error: "You do not have permission to edit animals." };

  const id = str(fd, "id");
  let newId = id;

  try {
    const data = readAnimal(fd);
    // Prices are owner/manager-only fields.
    const money = can.viewAnimalPrices(user.role)
      ? { purchasePrice: dec(fd, "purchasePrice"), salePrice: dec(fd, "salePrice") }
      : {};

    if (id) {
      await prisma.animal.update({ where: { id }, data: { ...data, ...money } });
    } else {
      const created = await prisma.animal.create({ data: { ...data, ...money } });
      newId = created.id;

      // A purchase is money out — record it in the ledger automatically.
      const price = "purchasePrice" in money ? money.purchasePrice : null;
      if (data.acquisition === "PURCHASED" && price) {
        await prisma.transaction.create({
          data: {
            date: data.dateJoined,
            type: "EXPENSE",
            category: "Animal Purchase",
            amount: price,
            description: `Purchase of ${data.name} (${data.tagId})`,
            vendor: data.sourceName,
            animalId: created.id,
            createdById: user.id,
          },
        });
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not save the animal.";
    if (msg.includes("Unique constraint")) return { error: "That Tag / ID is already used by another animal." };
    return { error: msg };
  }

  revalidatePath("/animals");
  revalidatePath("/dashboard");
  redirect(`/animals/${newId}`);
}

export async function recordSaleAction(_prev: State, fd: FormData): Promise<State> {
  const user = await requireUser();
  if (!can.manageAnimals(user.role)) return { error: "Not permitted." };

  const animalId = reqStr(fd, "animalId");
  try {
    const salePrice = dec(fd, "salePrice");
    const exitDate = reqDate(fd, "exitDate", "Date");
    const status = enumOf<AnimalStatus>(fd, "status", STATUS_VALUES, "SOLD");
    const buyerName = str(fd, "buyerName");

    const animal = await prisma.animal.update({
      where: { id: animalId },
      data: { status, exitDate, salePrice, buyerName, exitReason: str(fd, "exitReason") },
    });

    if (status === "SOLD" && salePrice) {
      await prisma.transaction.create({
        data: {
          date: exitDate,
          type: "INCOME",
          category: "Animal Sale",
          amount: salePrice,
          description: `Sale of ${animal.name} (${animal.tagId})`,
          vendor: buyerName,
          animalId,
          createdById: user.id,
        },
      });
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not record the sale." };
  }

  revalidatePath(`/animals/${animalId}`);
  revalidatePath("/finance");
  return { ok: "Saved." };
}

export async function deleteAnimalAction(fd: FormData) {
  const user = await requireUser();
  if (!can.manageAnimals(user.role)) throw new Error("Not permitted.");
  const id = reqStr(fd, "id");
  await prisma.animal.delete({ where: { id } });
  revalidatePath("/animals");
  redirect("/animals");
}

/** Photos arrive already resized in the browser, as data URLs. */
export async function uploadPhotoAction(_prev: State, fd: FormData): Promise<State> {
  const user = await requireUser();
  const animalId = reqStr(fd, "animalId");
  const full = reqStr(fd, "full", "Photo");
  const thumb = reqStr(fd, "thumb", "Photo");
  const makeProfile = bool(fd, "makeProfile");

  const parse = (dataUrl: string) => {
    const m = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/.exec(dataUrl);
    if (!m) throw new Error("Unsupported image format.");
    return { mimeType: m[1], buffer: Buffer.from(m[2], "base64") };
  };

  try {
    const f = parse(full);
    const t = parse(thumb);
    if (f.buffer.byteLength > 6_000_000) return { error: "That image is too large — try a smaller photo." };

    const photo = await prisma.photo.create({
      data: {
        animalId,
        mimeType: f.mimeType,
        data: f.buffer,
        thumb: t.buffer,
        bytes: f.buffer.byteLength,
        caption: str(fd, "caption"),
        uploadedById: user.id,
      },
    });

    const animal = await prisma.animal.findUnique({ where: { id: animalId }, select: { profilePhotoId: true } });
    if (makeProfile || !animal?.profilePhotoId) {
      await prisma.animal.update({ where: { id: animalId }, data: { profilePhotoId: photo.id } });
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Upload failed." };
  }

  revalidatePath(`/animals/${animalId}`);
  revalidatePath("/animals");
  return { ok: "Photo added." };
}

export async function setProfilePhotoAction(fd: FormData) {
  await requireUser();
  const animalId = reqStr(fd, "animalId");
  const photoId = reqStr(fd, "photoId");
  await prisma.animal.update({ where: { id: animalId }, data: { profilePhotoId: photoId } });
  revalidatePath(`/animals/${animalId}`);
  revalidatePath("/animals");
}

export async function deletePhotoAction(fd: FormData) {
  const user = await requireUser();
  if (!can.manageAnimals(user.role)) throw new Error("Not permitted.");
  const animalId = reqStr(fd, "animalId");
  await prisma.photo.delete({ where: { id: reqStr(fd, "photoId") } });
  revalidatePath(`/animals/${animalId}`);
  revalidatePath("/animals");
}
