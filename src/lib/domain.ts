import type { Species, Sex, HealthRecordType, AnimalStatus, ReproStatus, AcquisitionType, BreedingMethod, BreedingStatus } from "@prisma/client";
import { ageFrom } from "./format";

export const SPECIES: Record<Species, {
  label: string; emoji: string; young: string; youngM?: string; youngF?: string;
  adultM: string; adultF: string; matureMonths: number; gestationDays: number;
  /** Prefix used to auto-generate a Tag / Farm ID, e.g. "G" -> G001, G002... */
  prefix: string;
}> = {
  COW:     { label: "Cow",     emoji: "🐄", young: "Calf",   adultM: "Bull",     adultF: "Cow",     matureMonths: 18, gestationDays: 283, prefix: "C" },
  BUFFALO: { label: "Buffalo", emoji: "🐃", young: "Calf",   adultM: "Bull",     adultF: "Buffalo", matureMonths: 24, gestationDays: 310, prefix: "B" },
  // Calf and Heifer are tracked as their own species (not computed from age)
  // so you can tag an animal this way yourself and re-tag it as Cow/Buffalo
  // once it's grown. Bachra/Bachri are the Urdu terms for a male/female calf.
  CALF:    { label: "Calf",    emoji: "🐮", young: "Calf", youngM: "Bachra", youngF: "Bachri", adultM: "Bachra", adultF: "Bachri", matureMonths: 999, gestationDays: 283, prefix: "CF" },
  HEIFER:  { label: "Heifer",  emoji: "🐄", young: "Heifer", adultM: "Heifer",   adultF: "Heifer",  matureMonths: 999, gestationDays: 283, prefix: "HF" },
  GOAT:    { label: "Goat",    emoji: "🐐", young: "Kid",    adultM: "Buck",     adultF: "Doe",     matureMonths: 9,  gestationDays: 150, prefix: "G" },
  SHEEP:   { label: "Sheep",   emoji: "🐑", young: "Lamb",   adultM: "Ram",      adultF: "Ewe",     matureMonths: 9,  gestationDays: 147, prefix: "S" },
  HORSE:   { label: "Horse",   emoji: "🐎", young: "Foal",   adultM: "Stallion", adultF: "Mare",    matureMonths: 36, gestationDays: 340, prefix: "H" },
  POULTRY: { label: "Poultry", emoji: "🐓", young: "Chick",  adultM: "Rooster",  adultF: "Hen",     matureMonths: 5,  gestationDays: 21,  prefix: "P" },
  OTHER:   { label: "Other",   emoji: "🐾", young: "Young",  adultM: "Male",     adultF: "Female",  matureMonths: 12, gestationDays: 0,   prefix: "O" },
};

/** "Calf", "Kid", "Cow", "Buck" … computed from species + age + sex. */
export function lifeStage(species: Species, sex: Sex, dob: Date | string | null | undefined) {
  const s = SPECIES[species];
  const age = ageFrom(dob);
  const young = sex === "MALE" ? (s.youngM ?? s.young) : (s.youngF ?? s.young);
  if (!age) return sex === "MALE" ? s.adultM : s.adultF;
  if (age.months < s.matureMonths) return young;
  return sex === "MALE" ? s.adultM : s.adultF;
}

export function isYoung(species: Species, dob: Date | string | null | undefined) {
  const age = ageFrom(dob);
  return age ? age.months < SPECIES[species].matureMonths : false;
}

export function expectedDue(species: Species, breedingDate: Date) {
  const days = SPECIES[species].gestationDays;
  if (!days) return null;
  const d = new Date(breedingDate);
  d.setDate(d.getDate() + days);
  return d;
}

export const HEALTH_TYPE: Record<HealthRecordType, { label: string; tone: "brand" | "good" | "warn" | "bad" | "muted" }> = {
  VACCINATION:     { label: "Vaccination", tone: "good" },
  INJECTION:       { label: "Injection", tone: "brand" },
  DEWORMING:       { label: "Deworming", tone: "good" },
  TREATMENT:       { label: "Treatment", tone: "warn" },
  CHECKUP:         { label: "Check-up", tone: "muted" },
  SURGERY:         { label: "Surgery", tone: "bad" },
  LAB_TEST:        { label: "Lab test", tone: "muted" },
  HOOF_CARE:       { label: "Hoof care", tone: "muted" },
  PREGNANCY_CHECK: { label: "Pregnancy check", tone: "brand" },
  DEATH_REPORT:    { label: "Death report", tone: "bad" },
  OTHER:           { label: "Other", tone: "muted" },
};

export const STATUS_LABEL: Record<AnimalStatus, string> = {
  ACTIVE: "On farm",
  SOLD: "Sold",
  DECEASED: "Deceased",
  CULLED: "Culled",
  LOANED_OUT: "Loaned out",
};

export const REPRO_LABEL: Record<ReproStatus, string> = {
  NOT_APPLICABLE: "—",
  OPEN: "Open",
  BRED: "Bred",
  PREGNANT: "Pregnant",
  LACTATING: "Lactating",
  DRY: "Dry",
  CASTRATED: "Castrated",
};

export const ACQUISITION_LABEL: Record<AcquisitionType, string> = {
  BORN_ON_FARM: "Born on farm",
  PURCHASED: "Purchased",
  GIFTED: "Gifted",
  INHERITED: "Inherited",
  OTHER: "Other",
};

export const BREEDING_METHOD_LABEL: Record<BreedingMethod, string> = {
  NATURAL: "Natural service",
  ARTIFICIAL_INSEMINATION: "Artificial insemination",
  EMBRYO_TRANSFER: "Embryo transfer",
};

export const BREEDING_STATUS_LABEL: Record<BreedingStatus, string> = {
  BRED: "Bred — awaiting confirmation",
  CONFIRMED_PREGNANT: "Confirmed pregnant",
  NOT_PREGNANT: "Not pregnant",
  ABORTED: "Aborted",
  DELIVERED: "Delivered",
};

export const ROUTES = ["IM (intramuscular)", "SC (subcutaneous)", "IV (intravenous)", "Oral", "Topical", "Intranasal", "Intramammary"];

export const EXPENSE_CATEGORIES = [
  "Feed", "Veterinary", "Medicine", "Animal Purchase", "Labour / Wages",
  "Equipment", "Transport", "Utilities", "Shed / Maintenance", "Breeding / AI",
  "Insurance", "Other Expense",
];

export const INCOME_CATEGORIES = [
  "Milk Sales", "Animal Sale", "Manure Sales", "Breeding Service",
  "Wool / Hair", "Subsidy / Grant", "Other Income",
];

/** Common vaccines by species — used as quick-pick suggestions for the vet. */
export const VACCINE_SUGGESTIONS: Partial<Record<Species, string[]>> = {
  COW: ["FMD (Foot & Mouth)", "HS (Haemorrhagic Septicaemia)", "Black Quarter", "Brucella RB51", "Anthrax", "Lumpy Skin Disease"],
  BUFFALO: ["FMD (Foot & Mouth)", "HS (Haemorrhagic Septicaemia)", "Black Quarter", "Anthrax"],
  GOAT: ["PPR (Peste des Petits Ruminants)", "Enterotoxaemia (ET)", "Goat Pox", "CCPP", "Tetanus", "Anthrax"],
  SHEEP: ["PPR", "Enterotoxaemia (ET)", "Sheep Pox", "Blue Tongue", "Tetanus"],
};
