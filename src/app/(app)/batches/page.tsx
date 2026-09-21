import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getSettings } from "@/lib/settings";
import { PageHeader, Section, Empty, Badge } from "@/components/ui";
import Disclosure from "@/components/Disclosure";
import { fmtDate, money } from "@/lib/format";
import BatchForm from "@/components/BatchForm";

export const dynamic = "force-dynamic";

export default async function BatchesPage() {
  const user = await requireUser();
  if (!can.viewFinance(user.role)) return <p>Not permitted.</p>;
  const settings = await getSettings();

  const batches = await prisma.purchaseBatch.findMany({
    orderBy: { date: "desc" },
    include: {
      animals: { select: { id: true, name: true, tagId: true, purchasePrice: true } },
      costs: true,
    },
  });

  return (
    <>
      <PageHeader
        title="Purchase Batches"
        subtitle="Group animals bought on the same trip with shared costs"
        action={can.editFinance(user.role) ? (
          <Disclosure label="New batch">
            <div className="card p-4 w-80"><BatchForm /></div>
          </Disclosure>
        ) : undefined}
      />

      {batches.length === 0 ? (
        <Section>
          <Empty
            icon="📦"
            title="No batches yet"
            hint="Create a batch to track shared costs (transport, market fees, helpers) for animals bought on the same trip."
          />
        </Section>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {batches.map((b) => {
            const animalTotal = b.animals.reduce((s, a) => s + Number(a.purchasePrice ?? 0), 0);
            const costTotal = b.costs.reduce((s, c) => s + Number(c.amount), 0);
            const grandTotal = animalTotal + costTotal;
            return (
              <Link key={b.id} href={`/batches/${b.id}`} className="card p-4 transition-colors hover:bg-surface2/50">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="font-semibold truncate">{b.name}</h2>
                    <p className="text-[13px] text-muted">{fmtDate(b.date)}</p>
                  </div>
                  <Badge>{b.animals.length} animal{b.animals.length !== 1 ? "s" : ""}</Badge>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[12.5px]">
                  <div>
                    <div className="text-muted">Animals</div>
                    <div className="font-semibold">{money(animalTotal, settings.currency)}</div>
                  </div>
                  <div>
                    <div className="text-muted">Costs</div>
                    <div className="font-semibold">{money(costTotal, settings.currency)}</div>
                  </div>
                  <div>
                    <div className="text-muted">Total</div>
                    <div className="font-semibold">{money(grandTotal, settings.currency)}</div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
