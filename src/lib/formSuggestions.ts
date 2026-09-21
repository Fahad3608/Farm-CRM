import { prisma } from "./db";

/** Distinct, non-empty values already used for a few free-text Animal fields, so the next entry can pick from what you've typed before instead of retyping it. */
export async function animalFieldSuggestions() {
  const [breeds, colors, pens] = await Promise.all([
    prisma.animal.findMany({ where: { breed: { not: null } }, distinct: ["breed"], select: { breed: true }, orderBy: { breed: "asc" } }),
    prisma.animal.findMany({ where: { color: { not: null } }, distinct: ["color"], select: { color: true }, orderBy: { color: "asc" } }),
    prisma.animal.findMany({ where: { penOrLocation: { not: null } }, distinct: ["penOrLocation"], select: { penOrLocation: true }, orderBy: { penOrLocation: "asc" } }),
  ]);
  return {
    breeds: breeds.map((a) => a.breed!).filter(Boolean),
    colors: colors.map((a) => a.color!).filter(Boolean),
    pens: pens.map((a) => a.penOrLocation!).filter(Boolean),
  };
}
