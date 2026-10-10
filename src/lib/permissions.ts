import type { Role } from "@prisma/client";

/**
 * Single source of truth for what each role can do.
 * VET is deliberately the narrowest role: the animal list and health records,
 * nothing else. No money, no weights or yields, no breeding, no herd history.
 */
export const can = {
  viewFinance: (r: Role) => r === "OWNER" || r === "MANAGER",
  editFinance: (r: Role) => r === "OWNER" || r === "MANAGER",
  viewAnimalPrices: (r: Role) => r === "OWNER" || r === "MANAGER",
  manageAnimals: (r: Role) => r === "OWNER" || r === "MANAGER",
  manageUsers: (r: Role) => r === "OWNER",
  manageSettings: (r: Role) => r === "OWNER" || r === "MANAGER",
  writeHealth: (r: Role) => r === "OWNER" || r === "MANAGER" || r === "VET",
  viewBreeding: (r: Role) => r !== "VET",
  writeBreeding: (r: Role) => r === "OWNER" || r === "MANAGER",
  writeDailyLogs: (r: Role) => r !== "VET", // feed, milk, weight
  viewAnimals: (_r: Role) => true,
  // Everything on an animal beyond its health: how it was acquired, family,
  // feed, growth, milk, photos.
  viewAnimalHistory: (r: Role) => r !== "VET",
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
  VET: "Animal list and health records only — no prices, weights, yields or herd history.",
  WORKER: "Daily logs (feed, milk, weights) — no finances.",
};
