import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getCurrency } from "@/lib/settings";
import AnimalForm from "@/components/AnimalForm";
import { PageHeader } from "@/components/ui";
import { dateInput } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function EditAnimalPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!can.manageAnimals(user.role)) redirect(`/animals/${id}`);

  const [animal, females, males, currency] = await Promise.all([
    prisma.animal.findUnique({ where: { id } }),
    prisma.animal.findMany({ where: { sex: "FEMALE", NOT: { id } }, select: { id: true, name: true, tagId: true }, orderBy: { tagId: "asc" } }),
    prisma.animal.findMany({ where: { sex: "MALE", NOT: { id } }, select: { id: true, name: true, tagId: true }, orderBy: { tagId: "asc" } }),
    getCurrency(),
  ]);
  if (!animal) notFound();

  const opt = (a: { id: string; name: string; tagId: string }) => ({ id: a.id, label: `${a.name} (${a.tagId})` });

  return (
    <>
      <PageHeader title={`Edit ${animal.name}`} subtitle={animal.tagId} />
      <AnimalForm
        values={{
          ...animal,
          dateOfBirth: dateInput(animal.dateOfBirth),
          dateJoined: dateInput(animal.dateJoined),
          exitDate: dateInput(animal.exitDate),
          expectedDueDate: dateInput(animal.expectedDueDate),
          purchasePrice: animal.purchasePrice?.toString() ?? "",
          salePrice: animal.salePrice?.toString() ?? "",
        }}
        mothers={females.map(opt)}
        fathers={males.map(opt)}
        showPrices={can.viewAnimalPrices(user.role)}
        currency={currency}
      />
    </>
  );
}
