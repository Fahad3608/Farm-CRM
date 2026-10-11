"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { hashPassword, requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { bool, enumOf, reqStr, str } from "@/lib/form";
import type { Role } from "@prisma/client";

const ROLES = ["OWNER", "MANAGER", "VET", "WORKER"] as const;
type State = { error?: string; ok?: string } | undefined;

export async function saveFarmSettingsAction(_prev: State, fd: FormData): Promise<State> {
  const user = await requireUser();
  if (!can.manageSettings(user.role)) return { error: "Not permitted." };

  const entries: [string, string][] = [
    ["farmName", reqStr(fd, "farmName", "Farm name")],
    ["currency", (str(fd, "currency") ?? "PKR").toUpperCase().slice(0, 3)],
    ["weightUnit", str(fd, "weightUnit") ?? "kg"],
  ];

  for (const [key, value] of entries) {
    await prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
  }

  revalidatePath("/", "layout");
  return { ok: "Settings saved." };
}

export async function saveUserAction(_prev: State, fd: FormData): Promise<State> {
  const me = await requireUser();
  if (!can.manageUsers(me.role)) return { error: "Only the owner can manage user accounts." };

  const id = str(fd, "id");
  const password = str(fd, "password");

  try {
    const data = {
      email: reqStr(fd, "email", "Email").toLowerCase(),
      name: reqStr(fd, "name", "Name"),
      phone: str(fd, "phone"),
      role: enumOf<Role>(fd, "role", ROLES, "WORKER"),
      clinic: str(fd, "clinic"),
      licenseNo: str(fd, "licenseNo"),
      active: id ? bool(fd, "active") : true,
    };

    if (id) {
      if (id === me.id && data.role !== "OWNER") return { error: "You cannot remove your own owner access." };
      await prisma.user.update({
        where: { id },
        data: password ? { ...data, passwordHash: await hashPassword(password) } : data,
      });
    } else {
      if (!password || password.length < 8) return { error: "Set a password of at least 8 characters." };
      await prisma.user.create({ data: { ...data, passwordHash: await hashPassword(password) } });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not save.";
    return { error: msg.includes("Unique constraint") ? "That email is already in use." : msg };
  }

  revalidatePath("/settings");
  return { ok: id ? "Account updated." : "Account created." };
}

export async function deleteUserAction(fd: FormData) {
  const me = await requireUser();
  if (!can.manageUsers(me.role)) throw new Error("Not permitted.");
  const id = reqStr(fd, "id");
  if (id === me.id) throw new Error("You cannot delete your own account.");
  await prisma.user.delete({ where: { id } });
  revalidatePath("/settings");
}
