import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getSettings } from "@/lib/settings";
import { Card, Empty, Field, PageHeader, Section, StatTile } from "@/components/ui";
import Disclosure from "@/components/Disclosure";
import ActionForm, { SubmitButton } from "@/components/ActionForm";
import ConfirmSubmit from "@/components/ConfirmSubmit";
import FeedLogForm from "@/components/FeedLogForm";
import { BarList } from "@/components/charts";
import { saveFeedTypeAction, deleteFeedLogAction } from "@/app/actions/feed";

import { fmtDate, money, num } from "@/lib/format";
import { Icon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function FeedPage() {
  const user = await requireUser();
  if (user.role === "VET") redirect("/vet");

  const settings = await getSettings();
  const showMoney = can.viewFinance(user.role);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const [feeds, animals, logs, byType, monthTotal] = await Promise.all([
    prisma.feedType.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] }),
    prisma.animal.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true, tagId: true, species: true }, orderBy: { tagId: "asc" } }),
    prisma.feedLog.findMany({
      orderBy: { date: "desc" },
      take: 80,
      include: { feedType: { select: { name: true, unit: true } }, animal: { select: { id: true, name: true, tagId: true } } },
    }),
    prisma.feedLog.groupBy({ by: ["feedTypeId"], where: { date: { gte: monthStart } }, _sum: { quantity: true, totalCost: true } }),
    prisma.feedLog.aggregate({ where: { date: { gte: monthStart } }, _sum: { totalCost: true } }),
  ]);

  const feedById = new Map(feeds.map((f) => [f.id, f]));
  const activeFeeds = feeds.filter((f) => f.active);

  return (
    <>
      <PageHeader title="Feed" subtitle="What each animal eats, and what it costs" />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatTile label="Feed types" value={activeFeeds.length} />
        <StatTile label="Logs this month" value={byType.length} />
        {showMoney && <StatTile label="Feed cost this month" value={money(monthTotal._sum.totalCost, settings.currency)} tone="warn" />}
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
                <Field label="Feed name *"><input name="name" required className="input" placeholder="Wheat straw" /></Field>
                <Field label="Category">
                  <input name="category" className="input" list="feed-cat" placeholder="Roughage" />
                  <datalist id="feed-cat"><option value="Roughage" /><option value="Concentrate" /><option value="Green fodder" /><option value="Silage" /><option value="Supplement" /><option value="Mineral / vitamin" /></datalist>
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
                        <form action={deleteFeedLogAction}>
                          <input type="hidden" name="id" value={l.id} />
                          <ConfirmSubmit message="Delete this feed log?" className="rounded-lg p-1.5 text-muted hover:text-bad">
                            <Icon.trash className="h-4 w-4" />
                          </ConfirmSubmit>
                        </form>
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
