import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getSettings } from "@/lib/settings";
import { Card, Empty, Field, PageHeader, Section, StatTile } from "@/components/ui";
import Disclosure from "@/components/Disclosure";
import ActionForm, { SubmitButton } from "@/components/ActionForm";
import RecordActions from "@/components/RecordActions";
import ConfirmSubmit from "@/components/ConfirmSubmit";
import FeedLogForm from "@/components/FeedLogForm";
import { BarList } from "@/components/charts";
import { saveFeedTypeAction, deleteFeedLogAction } from "@/app/actions/feed";
import { linkTransactionAnimalAction, markNotAnimalSpecificAction } from "@/app/actions/finance";
import { FEED_EXPENSE_CATEGORIES } from "@/lib/domain";
import { Badge } from "@/components/ui";

import { fmtDate, money, num } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function FeedPage() {
  const user = await requireUser();
  if (user.role === "VET") redirect("/vet");

  const settings = await getSettings();
  const showMoney = can.viewFinance(user.role);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  // Every feed cost in the ledger lives here rather than on Finance, so it
  // can be put against one animal or marked farm-wide where it's understood.
  const feedCostWhere = { type: "EXPENSE" as const, category: { in: FEED_EXPENSE_CATEGORIES } };

  const [feeds, animals, logs, byType, monthTotal, feedCosts, feedCostTotal, feedCostMonth] = await Promise.all([
    prisma.feedType.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] }),
    prisma.animal.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true, tagId: true, species: true }, orderBy: { tagId: "asc" } }),
    prisma.feedLog.findMany({
      orderBy: { date: "desc" },
      take: 80,
      include: { feedType: { select: { name: true, unit: true } }, animal: { select: { id: true, name: true, tagId: true } } },
    }),
    prisma.feedLog.groupBy({ by: ["feedTypeId"], where: { date: { gte: monthStart } }, _sum: { quantity: true, totalCost: true } }),
    prisma.feedLog.aggregate({ where: { date: { gte: monthStart } }, _sum: { totalCost: true } }),
    showMoney
      ? prisma.transaction.findMany({
          where: feedCostWhere,
          orderBy: { date: "desc" },
          take: 200,
          include: { animal: { select: { id: true, name: true, tagId: true } } },
        })
      : Promise.resolve([]),
    showMoney
      ? prisma.transaction.aggregate({ where: feedCostWhere, _sum: { amount: true } })
      : Promise.resolve({ _sum: { amount: null } }),
    showMoney
      ? prisma.transaction.aggregate({ where: { ...feedCostWhere, date: { gte: monthStart } }, _sum: { amount: true } })
      : Promise.resolve({ _sum: { amount: null } }),
  ]);

  const feedById = new Map(feeds.map((f) => [f.id, f]));
  const activeFeeds = feeds.filter((f) => f.active);
  const unassignedCosts = feedCosts.filter((t) => !t.animalId && !t.notAnimalSpecific);

  return (
    <>
      <PageHeader title="Feed" subtitle="What each animal eats, and what it costs" />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Feed types" value={activeFeeds.length} />
        <StatTile label="Logs this month" value={byType.length} />
        {showMoney && (
          <StatTile
            label="Feed spend this month"
            value={money(Number(feedCostMonth._sum.amount ?? 0) + Number(monthTotal._sum.totalCost ?? 0), settings.currency)}
            tone="warn"
            hint="Ledger costs plus logged feeding"
          />
        )}
        {showMoney && (
          <StatTile
            label="Feed spend so far"
            value={money(feedCostTotal._sum.amount, settings.currency)}
            hint={unassignedCosts.length ? `${unassignedCosts.length} not yet assigned` : "All costs assigned"}
            tone={unassignedCosts.length ? "warn" : "muted"}
          />
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Disclosure label="Log feeding">
          <Card className="p-4">
            <FeedLogForm
              feeds={activeFeeds.map((f) => ({ id: f.id, name: f.name, unit: f.unit, costPerUnit: f.costPerUnit.toString() }))}
              animals={animals.map((a) => ({ id: a.id, label: `${a.name} (${a.tagId})`, species: a.species }))}
              currency={settings.currency}
            />
          </Card>
        </Disclosure>
        {can.manageSettings(user.role) && (
          <Disclosure label="Add feed type" tone="ghost">
            <Card className="p-4">
              <ActionForm action={saveFeedTypeAction} className="grid gap-4 sm:grid-cols-2" resetOnSuccess>
                <Field label="Feed name *">
                  <input name="name" required className="input" list="feed-name-opts" placeholder="Bhoosa (Wheat Straw)" />
                  <datalist id="feed-name-opts">
                    <option value="Bhoosa (Wheat Straw)" /><option value="Toori (Mustard Straw)" />
                    <option value="Barseem" /><option value="Lucerne (Rijka)" /><option value="Jantar (Sorghum)" />
                    <option value="Makai Silage" /><option value="Sarson Khal (Mustard Cake)" />
                    <option value="Binola Khal (Cotton Cake)" /><option value="Wanda (Concentrate Mix)" />
                    <option value="Choker (Wheat Bran)" /><option value="Gur / Raab (Molasses)" /><option value="Mineral Mix" />
                  </datalist>
                </Field>
                <Field label="Category">
                  <input name="category" className="input" list="feed-cat" placeholder="Roughage" />
                  <datalist id="feed-cat"><option value="Roughage" /><option value="Concentrate" /><option value="Green fodder" /><option value="Silage" /><option value="Supplement" /><option value="Mineral / vitamin" /><option value="Oil cake / Khal" /></datalist>
                </Field>
                <Field label="Unit"><input name="unit" defaultValue="kg" className="input" /></Field>
                <Field label={`Cost per unit (${settings.currency})`}><input name="costPerUnit" inputMode="decimal" className="input" placeholder="0" /></Field>
                <Field label="Supplier"><input name="supplier" className="input" /></Field>
                <Field label="Notes"><input name="notes" className="input" /></Field>
                <div className="sm:col-span-2"><SubmitButton>Add feed type</SubmitButton></div>
              </ActionForm>
            </Card>
          </Disclosure>
        )}
      </div>

      {showMoney && (
        <div className="mb-4">
          <Section
            title="Feeding costs"
            subtitle={`Every feed expense in the ledger · put each one against an animal or mark it farm-wide`}
            action={<Link href="/finance?sub=Feeding+Cost" className="btn-ghost btn-sm">In Finance</Link>}
          >
            {feedCosts.length === 0 ? (
              <Empty
                icon="🧾"
                title="No feed costs recorded yet"
                hint="Feed expenses added in Finance (Feeding Cost, Direct Purchase - Feed…) show up here to be assigned."
              />
            ) : (
              <>
                {unassignedCosts.length > 0 && (
                  <p className="border-b border-line px-4 py-3 text-[13px] text-muted">
                    {unassignedCosts.length} {unassignedCosts.length === 1 ? "cost needs" : "costs need"} assigning.
                    Link one to an animal to build its cost-per-animal, or mark it farm-wide if it fed the whole herd.
                  </p>
                )}
                <div className="scroll-x">
                  <table className="w-full min-w-[760px]">
                    <thead>
                      <tr>
                        <th className="th">Date</th>
                        <th className="th">Description</th>
                        <th className="th">Category</th>
                        <th className="th text-right">Amount</th>
                        <th className="th">Paid by</th>
                        <th className="th">Assigned to</th>
                      </tr>
                    </thead>
                    <tbody>
                      {feedCosts.map((t) => {
                        const isAuto = Boolean(t.feedLogId || t.batchCostId || t.healthRecordId || t.saleId);
                        return (
                          <tr key={t.id} className="row">
                            <td className="td whitespace-nowrap">{fmtDate(t.date)}</td>
                            <td className="td">{t.description ?? "—"}</td>
                            <td className="td text-muted">{t.category}</td>
                            <td className="td text-right tabular-nums font-semibold">{money(t.amount, settings.currency)}</td>
                            <td className="td">{t.paidBy ?? <span className="text-muted">—</span>}</td>
                            <td className="td">
                              {t.animal ? (
                                <span className="flex flex-wrap items-center gap-2">
                                  <Link href={`/animals/${t.animal.id}?tab=feed`} className="text-brand hover:underline">
                                    {t.animal.name} ({t.animal.tagId})
                                  </Link>
                                  {!isAuto && (
                                    <form action={markNotAnimalSpecificAction}>
                                      <input type="hidden" name="id" value={t.id} />
                                      <button className="btn-ghost btn-sm" title="Unassign and treat as a farm-wide cost">Make farm-wide</button>
                                    </form>
                                  )}
                                </span>
                              ) : t.notAnimalSpecific ? (
                                <span className="flex flex-wrap items-center gap-2">
                                  <Badge tone="muted">Farm-wide</Badge>
                                  {!isAuto && (
                                    <form action={linkTransactionAnimalAction} className="flex items-center gap-1.5">
                                      <input type="hidden" name="id" value={t.id} />
                                      <select name="animalId" required className="input w-auto py-1.5 text-[13px]" defaultValue="">
                                        <option value="" disabled>Link to animal…</option>
                                        {animals.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.tagId})</option>)}
                                      </select>
                                      <button className="btn-ghost btn-sm">Link</button>
                                    </form>
                                  )}
                                </span>
                              ) : isAuto ? (
                                <Badge tone="muted">From a logged record</Badge>
                              ) : (
                                <span className="flex flex-wrap items-center gap-2">
                                  <form action={linkTransactionAnimalAction} className="flex items-center gap-1.5">
                                    <input type="hidden" name="id" value={t.id} />
                                    <select name="animalId" required className="input w-auto py-1.5 text-[13px]" defaultValue="">
                                      <option value="" disabled>Link to animal…</option>
                                      {animals.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.tagId})</option>)}
                                    </select>
                                    <button className="btn-ghost btn-sm">Link</button>
                                  </form>
                                  <form action={markNotAnimalSpecificAction}>
                                    <input type="hidden" name="id" value={t.id} />
                                    <button className="btn-ghost btn-sm" title="This fed the whole herd, not one animal">Farm-wide</button>
                                  </form>
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </Section>
        </div>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Section title="Consumption this month" subtitle="By feed type">
          <BarList
            items={byType
              .map((b) => ({
                label: feedById.get(b.feedTypeId)?.name ?? "Feed",
                value: Number(b._sum.quantity ?? 0),
                display: `${num(b._sum.quantity, 1)} ${feedById.get(b.feedTypeId)?.unit ?? "kg"}${showMoney ? ` · ${money(b._sum.totalCost, settings.currency)}` : ""}`,
              }))
              .sort((a, b) => b.value - a.value)}
            emptyText="No feed logged this month."
          />
        </Section>

        <Section title="Feed types & prices">
          {feeds.length === 0 ? (
            <Empty icon="🌾" title="No feed types yet" hint="Add wheat straw, silage, concentrate — whatever you use." />
          ) : (
            <div className="scroll-x">
              <table className="w-full min-w-[420px]">
                <thead><tr><th className="th">Feed</th><th className="th">Category</th><th className="th">Unit</th>{showMoney && <th className="th">Price</th>}<th className="th">Supplier</th></tr></thead>
                <tbody>
                  {feeds.map((f) => (
                    <tr key={f.id} className={`row ${f.active ? "" : "opacity-50"}`}>
                      <td className="td font-medium">{f.name}</td>
                      <td className="td text-muted">{f.category ?? "—"}</td>
                      <td className="td">{f.unit}</td>
                      {showMoney && <td className="td tabular-nums">{money(f.costPerUnit, settings.currency)}</td>}
                      <td className="td text-muted">{f.supplier ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <Section title="Recent feeding log" className="lg:col-span-2" subtitle={`Last ${logs.length} entries`}>
          {logs.length === 0 ? (
            <Empty icon="🥣" title="Nothing logged yet" hint="Log feeding per animal or per pen — group costs are split evenly." />
          ) : (
            <div className="scroll-x">
              <table className="w-full min-w-[680px]">
                <thead><tr><th className="th">Date</th><th className="th">Animal</th><th className="th">Feed</th><th className="th">Quantity</th>{showMoney && <th className="th">Cost</th>}<th className="th">Group</th><th className="th"></th></tr></thead>
                <tbody>
                  {logs.map((l) => (
                    <tr key={l.id} className="row">
                      <td className="td whitespace-nowrap">{fmtDate(l.date)}</td>
                      <td className="td">
                        {l.animal ? <Link href={`/animals/${l.animal.id}?tab=feed`} className="text-brand hover:underline">{l.animal.name}</Link> : "—"}
                      </td>
                      <td className="td">{l.feedType.name}</td>
                      <td className="td tabular-nums">{num(l.quantity, 2)} {l.feedType.unit}</td>
                      {showMoney && <td className="td tabular-nums">{money(l.totalCost, settings.currency)}</td>}
                      <td className="td text-muted">{l.groupLabel ?? "Individual"}</td>
                      <td className="td text-right">
                        <RecordActions label="Feed log actions"><form action={deleteFeedLogAction}>
                          <input type="hidden" name="id" value={l.id} />
                          <ConfirmSubmit className="record-delete-action" message="Delete this feed log?">Delete feed log</ConfirmSubmit>
                        </form></RecordActions>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </div>
    </>
  );
}
