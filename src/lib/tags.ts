import { prisma } from "./db";
import { SPECIES } from "./domain";
import type { Species } from "@prisma/client";

/**
 * The next Tag/ID for each species (e.g. GOAT -> "G014"), based on the
 * highest existing tag already using that species' prefix. Older tags in a
 * different format (e.g. "COW-001") are simply ignored for numbering.
 */
export async function nextTagIds(): Promise<Record<Species, string>> {
  const animals = await prisma.animal.findMany({ select: { tagId: true } });

  const result = {} as Record<Species, string>;
  for (const species of Object.keys(SPECIES) as Species[]) {
    const prefix = SPECIES[species].prefix;
    const re = new RegExp(`^${prefix}(\\d+)$`, "i");
    let max = 0;
    for (const { tagId } of animals) {
      const match = re.exec(tagId);
      if (match) max = Math.max(max, parseInt(match[1], 10));
    }
    result[species] = `${prefix}${String(max + 1).padStart(3, "0")}`;
  }
  return result;
}
