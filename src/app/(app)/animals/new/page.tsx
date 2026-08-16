import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getCurrency } from "@/lib/settings";
import AnimalForm from "@/components/AnimalForm";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NewAnimalPage() {
  const user = await requireUser();
  if (!can.manageAnimals(user.role)) redirect("/animals");

  const [females, males, currency] = await Promise.all([
    prisma.animal.findMany({ where: { sex: "FEMALE" }, select: { id: true, name: true, tagId: true }, orderBy: { tagId: "asc" } }),
    prisma.animal.findMany({ where: { sex: "MALE" }, select: { id: true, name: true, tagId: true }, orderBy: { tagId: "asc" } }),
    getCurrency(),
  ]);

  const opt = (a: { id: string; name: string; tagId: string }) => ({ id: a.id, label: `${a.name} (${a.tagId})` });

  return (
    <>
      <PageHeader title="Add an animal" subtitle="Only the starred fields are required — you can fill in the rest later." />
      <AnimalForm mothers={females.map(opt)} fathers={males.map(opt)} showPrices={can.viewAnimalPrices(user.role)} currency={currency} />
    </>
  );
}
