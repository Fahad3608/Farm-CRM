import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getSettings } from "@/lib/settings";
import { Badge, Card, Empty, Section, StatTile } from "@/components/ui";
import { Icon } from "@/components/icons";
import Disclosure from "@/components/Disclosure";
import ConfirmSubmit from "@/components/ConfirmSubmit";
import BatchForm from "@/components/BatchForm";
import BatchCostForm from "@/components/BatchCostForm";
import BatchAnimalPicker from "@/components/BatchAnimalPicker";
import { fmtDate, money, num } from "@/lib/format";
import { SPECIES } from "@/lib/domain";
import { removeAnimalFromBatchAction, deleteBatchCostAction, deleteBatchAction } from "@/app/actions/batches";

export const dynamic = "force-dynamic";

export default async function BatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!can.viewFinance(user.role)) return <p>Not permitted.</p>;
  const { id } = await params;
  const settings = await getSettings();
  const canEdit = can.editFinance(user.role);

  const batch = await prisma.purchaseBatch.findUnique({
    where: { id },
    include: {
      animals: {
        select: { id: true, name: true, tagId: true, species: true, purchasePrice: true, profilePhotoId: true },
        orderBy: { tagId: "asc" },
      },
      costs: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!batch) notFound();

  const animalTotal = batch.animals.reduce((s, a) => s + Number(a.purchasePrice ?? 0), 0);
  const costTotal = batch.costs.reduce((s, c) => s + Number(c.amount), 0);
  const grandTotal = animalTotal + costTotal;
  const animalCount = batch.animals.length;
  const perAnimalShare = animalCount > 0 ? costTotal / animalCount : 0;

  const availableAnimals = canEdit
    ? await prisma.animal.findMany({
        where: { purchaseBatchId: null },
        select: { id: true, name: true, tagId: true, species: true },
        orderBy: { tagId: "asc" },
      })
    : [];

  return (
    <>
      <Link href="/batches" className="mb-3 inline-flex items-center gap-1.5 text-[13.5px] text-muted hover:text-ink">
        <Icon.back className="h-4 w-4" /> All batches
      </Link>

      <header className="mb-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="h1">{batch.name}</h1>
            <p className="mt-0.5 text-[14px] text-muted">{fmtDate(batch.date)}</p>
            {batch.notes && <p className="mt-1 text-[14px] text-muted">{batch.notes}</p>}
          </div>
          {canEdit && (
            <Disclosure label="Edit batch">
              <Card className="p-4 w-80">
                <BatchForm batch={{ id: batch.id, name: batch.name, date: batch.date, notes: batch.notes }} />
              </Card>
            </Disclosure>
          )}
        </div>
      </header>

      {/* Summary tiles */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Animal cost" value={money(animalTotal, settings.currency)} />
        <StatTile label="Additional costs" value={money(costTotal, settings.currency)} />
        <StatTile label="Grand total" value={money(grandTotal, settings.currency)} />
        <StatTile
          label="Per-animal share"
          value={animalCount > 0 ? money(perAnimalShare, settings.currency) : "—"}
          hint={animalCount > 0 ? `${money(costTotal, settings.currency)} ÷ ${animalCount} animals` : "Add animals to calculate"}
        />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        {/* Animals in this batch */}
        <Section
          title="Animals"
          subtitle={`${animalCount} animal${animalCount !== 1 ? "s" : ""}`}
          action={canEdit ? (
            <Disclosure label="Add animal" tone="ghost">
              <Card className="p-4"><BatchAnimalPicker batchId={batch.id} animals={availableAnimals} /></Card>
            </Disclosure>
          ) : undefined}
        >
          {animalCount === 0 ? (
            <Empty icon="🐄" title="No animals yet" hint="Add animals to this batch to track their shared costs." />
          ) : (
            <div className="scroll-x">
              <table className="w-full min-w-[480px]">
                <thead>
                  <tr>
                    <th className="th">Animal</th>
                    <th className="th">Species</th>
                    <th className="th text-right">Purchase price</th>
                    <th className="th text-right">+ Share</th>
                    <th className="th text-right">Total cost</th>
                    {canEdit && <th className="th w-10"></th>}
                  </tr>
                </thead>
                <tbody>
                  {batch.animals.map((a) => {
                    const price = Number(a.purchasePrice ?? 0);
                    const sp = SPECIES[a.species];
                    return (
                      <tr key={a.id} className="row">
                        <td className="td">
                          <Link href={`/animals/${a.id}`} className="text-brand hover:underline font-medium">
                            {a.name} <span className="text-muted font-mono text-[12px]">({a.tagId})</span>
                          </Link>
                        </td>
                        <td className="td">
                          <span>{sp.emoji} {sp.label}</span>
                        </td>
                        <td className="td text-right tabular-nums">{money(price, settings.currency)}</td>
                        <td className="td text-right tabular-nums text-muted">{money(perAnimalShare, settings.currency)}</td>
                        <td className="td text-right tabular-nums font-semibold">{money(price + perAnimalShare, settings.currency)}</td>
                        {canEdit && (
                          <td className="td text-right">
                            <form action={removeAnimalFromBatchAction}>
                              <input type="hidden" name="animalId" value={a.id} />
                              <input type="hidden" name="batchId" value={batch.id} />
                              <ConfirmSubmit message={`Remove ${a.name} from this batch?`} className="rounded-lg p-1.5 text-muted hover:bg-surface2 hover:text-bad">
                                <Icon.trash className="h-4 w-4" />
                              </ConfirmSubmit>
                            </form>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-line">
                    <td className="td font-semibold" colSpan={2}>Total</td>
                    <td className="td text-right tabular-nums font-semibold">{money(animalTotal, settings.currency)}</td>
                    <td className="td text-right tabular-nums font-semibold text-muted">{money(costTotal, settings.currency)}</td>
                    <td className="td text-right tabular-nums font-semibold">{money(grandTotal, settings.currency)}</td>
                    {canEdit && <td className="td"></td>}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Section>

        {/* Additional costs */}
        <Section
          title="Additional Costs"
          subtitle="Shared costs divided equally among animals"
          action={canEdit ? (
            <Disclosure label="Add cost" tone="ghost">
              <Card className="p-4"><BatchCostForm batchId={batch.id} /></Card>
            </Disclosure>
          ) : undefined}
        >
          {batch.costs.length === 0 ? (
            <Empty icon="💰" title="No additional costs" hint="Add shared costs like transport, market fees, or helper wages." />
          ) : (
            <ul>
              {batch.costs.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 first:border-t-0">
                  <span className="min-w-0 truncate">{c.description}</span>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="tabular-nums font-semibold">{money(c.amount, settings.currency)}</span>
                    {canEdit && (
                      <form action={deleteBatchCostAction}>
                        <input type="hidden" name="id" value={c.id} />
                        <ConfirmSubmit message={`Delete "${c.description}"?`} className="rounded-lg p-1.5 text-muted hover:bg-surface2 hover:text-bad">
                          <Icon.trash className="h-4 w-4" />
                        </ConfirmSubmit>
                      </form>
                    )}
                  </div>
                </li>
              ))}
              <li className="flex items-center justify-between gap-3 border-t-2 border-line px-4 py-3 font-semibold">
                <span>Total additional costs</span>
                <span className="tabular-nums">{money(costTotal, settings.currency)}</span>
              </li>
              {animalCount > 0 && (
                <li className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-muted">
                  <span>Per animal ({animalCount})</span>
                  <span className="tabular-nums font-medium">{money(perAnimalShare, settings.currency)}</span>
                </li>
              )}
            </ul>
          )}
        </Section>

        {/* Danger zone */}
        {canEdit && (
          <Card className="p-4">
            <h2 className="h2 text-bad">Danger zone</h2>
            <p className="mt-1 text-[13px] text-muted">
              Deleting this batch removes only the grouping and shared costs. The animals and their own purchase prices stay untouched.
            </p>
            <form action={deleteBatchAction} className="mt-3">
              <input type="hidden" name="id" value={batch.id} />
              <ConfirmSubmit message={`Delete batch "${batch.name}" and all its shared costs? The animals themselves won't be affected.`}>
                <Icon.trash className="h-4 w-4" /> Delete batch
              </ConfirmSubmit>
            </form>
          </Card>
        )}
      </div>
    </>
  );
}
