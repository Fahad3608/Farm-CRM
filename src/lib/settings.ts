import { prisma } from "./db";

export const DEFAULTS = {
  farmName: "My Farm",
  currency: "PKR",
  weightUnit: "kg",
  milkUnit: "litres",
};

export type FarmSettings = typeof DEFAULTS;

export async function getSettings(): Promise<FarmSettings> {
  try {
    const rows = await prisma.setting.findMany();
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    return { ...DEFAULTS, ...map } as FarmSettings;
  } catch {
    return DEFAULTS;
  }
}

export async function getCurrency() {
  return (await getSettings()).currency;
}

/** A short, sensible list; the settings page also accepts any 3-letter code. */
export const CURRENCIES = ["PKR", "USD", "EUR", "GBP", "INR", "AED", "SAR", "AUD", "CAD", "KES", "NGN", "ZAR", "BDT", "TRY", "BRL"];
