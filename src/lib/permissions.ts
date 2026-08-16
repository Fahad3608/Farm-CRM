import type { Role } from "@prisma/client";

/**
 * Single source of truth for what each role can do.
 * VET is intentionally walled off from anything money-related except
 * the fee/medicine cost on the record they themselves write.
 */
export const can = {
  viewFinance: (r: Role) => r === "OWNER" || r === "MANAGER",
  editFinance: (r: Role) => r === "OWNER" || r === "MANAGER",
  viewAnimalPrices: (r: Role) => r === "OWNER" || r === "MANAGER",
  manageAnimals: (r: Role) => r === "OWNER" || r === "MANAGER",
  manageUsers: (r: Role) => r === "OWNER",
  manageSettings: (r: Role) => r === "OWNER" || r === "MANAGER",
  writeHealth: (r: Role) => r === "OWNER" || r === "MANAGER" || r === "VET",
  writeBreeding: (r: Role) => r === "OWNER" || r === "MANAGER" || r === "VET",
  writeDailyLogs: (r: Role) => r !== "VET", // feed, milk, weight
  viewAnimals: (_r: Role) => true,
  uploadPhotos: (r: Role) => r !== "VET" || true, // vets may attach clinical photos
};

export const ROLE_LABEL: Record<Role, string> = {
  OWNER: "Owner",
  MANAGER: "Farm Manager",
  VET: "Veterinarian",
  WORKER: "Farm Worker",
};

export const ROLE_BLURB: Record<Role, string> = {
  OWNER: "Full access, including finances and user management.",
  MANAGER: "Everything except managing user accounts.",
  VET: "Health & breeding records only — no finances, no purchase or sale prices.",
  WORKER: "Daily logs (feed, milk, weights) — no finances.",
};
