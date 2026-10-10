import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getSettings } from "@/lib/settings";
import { Badge, Card, Empty, Section, StatTile } from "@/components/ui";
import { Icon } from "@/components/icons";
import Disclosure from "@/components/Disclosure";
import RecordActions from "@/components/RecordActions";
import ConfirmSubmit from "@/components/ConfirmSubmit";
import CustomerForm from "@/components/CustomerForm";
import CustomerRateForm from "@/components/CustomerRateForm";
import SaleForm from "@/components/SaleForm";
import { BarList } from "@/components/charts";
import { fmtDate, money, num } from "@/lib/format";
import { deleteCustomerAction, deleteRateAction, deleteSaleAction } from "@/app/actions/customers";

export const dynamic = "force-dynamic";

const DAYS_PER_MONTH = 30.44;
const RECENT_DELIVERIES = 60;

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!can.viewFinance(user.role)) return <p>Not permitted.</p>;
  const { id } = await params;
  const settings = await getSettings();
  const canEdit = can.editFinance(user.role);

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: { rates: { orderBy: [{ active: "desc" }, { product: "asc" }] } },
  });
  if (!customer) notFound();

  const [sales, recent, byProduct] = await Promise.all([
    // Every sale, but only the two columns the monthly rollup needs.
    prisma.sale.findMany({ where: { customerId: id }, select: { date: true, amount: true }, orderBy: { date: "asc" } }),
    prisma.sale.findMany({ where: { customerId: id }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: RECENT_DELIVERIES }),
    prisma.sale.groupBy({ by: ["product", "unit"], where: { customerId: id }, _sum: { quantity: true, amount: true } }),
  ]);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const allTime = sales.reduce((s, r) => s + Number(r.amount), 0);
  const thisMonth = sales.filter((r) => r.date >= monthStart).reduce((s, r) => s + Number(r.amount), 0);

  // Expected income straight off the rate card: the usual daily quantity at
  // the current price. Rates with no daily quantity aren't projected.
  const activeRates = customer.rates.filter((r) => r.active);
  const perDay = activeRates.reduce((s, r) => s + (r.dailyQty ? Number(r.dailyQty) * Number(r.unitPrice) : 0), 0);

  // Only months that actually have deliveries — an empty month is noise.
  const monthly = new Map<string, { label: string; total: number }>();
  for (const s of sales) {
    const key = `${s.date.getFullYear()}-${String(s.date.getMonth()).padStart(2, "0")}`;
    const entry = monthly.get(key) ?? {
      label: s.date.toLocaleDateString(undefined, { month: "short", year: "2-digit" }),
      total: 0,
    };
    entry.total += Number(s.amount);
    monthly.set(key, entry);
  }
  const monthlyRows = [...monthly.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 12)
    .map(([, v]) => ({ label: v.label, value: v.total, display: money(v.total, settings.currency) }));

  const saleRates = activeRates.map((r) => ({
    id: r.id,
    product: r.product,
    unit: r.unit,
    unitPrice: Number(r.unitPrice),
    dailyQty: r.dailyQty === null ? null : Number(r.dailyQty),
    category: r.category,
  }));

  return (
    <>
      <Link href="/customers" className="mb-3 inline-flex items-center gap-1.5 text-[13.5px] text-muted hover:text-ink">
        <Icon.back className="h-4 w-4" /> All customers
      </Link>

      <header className="mb-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="h1">{customer.name}</h1>
              {!customer.active && <Badge>Archived</Badge>}
            </div>
            <p className="mt-0.5 text-[14px] text-muted">
              {[customer.phone, customer.address].filter(Boolean).join(" · ") || "No contact details"}
            </p>
            {customer.notes && <p className="mt-1 text-[14px] text-muted">{customer.notes}</p>}
          </div>
          {canEdit && (
            <div className="flex items-start gap-2">
              <Disclosure label="Edit buyer">
              <Card className="w-80 p-4">
                <CustomerForm customer={{
                  id: customer.id, name: customer.name, phone: customer.phone,
                  address: customer.address, notes: customer.notes, active: customer.active,
                }} />
              </Card>
            </Disclosure>
              <RecordActions label="Buyer actions"><form action={deleteCustomerAction}>
              <input type="hidden" name="id" value={customer.id} />
              <ConfirmSubmit className="record-delete-action"
                message={`Delete ${customer.name}, ${sales.length} deliver${sales.length === 1 ? "y" : "ies"} and ${money(allTime, settings.currency)} of linked income? This cannot be undone.`}
              >Delete buyer</ConfirmSubmit>
            </form></RecordActions>
            </div>
          )}
        </div>
      </header>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Expected per day" value={perDay > 0 ? money(perDay, settings.currency) : "—"} hint="Usual quantity × price" />
        <StatTile label="Expected per month" value={perDay > 0 ? money(Math.round(perDay * DAYS_PER_MONTH), settings.currency) : "—"} hint={`≈ ${DAYS_PER_MONTH} days`} />
        <StatTile label="This month" value={money(thisMonth, settings.currency)} tone="good" hint="Deliveries actually logged" />
        <StatTile label="All time" value={money(allTime, settings.currency)} hint={`${sales.length} deliver${sales.length === 1 ? "y" : "ies"}`} />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Section
          title="What they buy"
          subtitle="Product, unit price and the usual daily quantity"
          action={canEdit ? (
            <Disclosure label="Add price" tone="ghost">
              <Card className="p-4"><CustomerRateForm customerId={customer.id} /></Card>
            </Disclosure>
          ) : undefined}
        >
          {customer.rates.length === 0 ? (
            <Empty icon="🥛" title="No prices set" hint="Add what this buyer takes and what they pay per unit — milk at 220 a litre, say." />
          ) : (
            <ul>
              {customer.rates.map((r) => {
                const daily = r.dailyQty ? Number(r.dailyQty) * Number(r.unitPrice) : 0;
                return (
                  <li key={r.id} className="border-t border-line px-4 py-3 first:border-t-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{r.product}</span>
                          {!r.active && <Badge>Old rate</Badge>}
                        </div>
                        <p className="text-[13px] text-muted">
                          {money(r.unitPrice, settings.currency)} per {r.unit}
                          {r.dailyQty ? ` · usually ${num(r.dailyQty, 3)} ${r.unit}/day` : ""}
                          {` · ${r.category}`}
                        </p>
                        {r.notes && <p className="text-[13px] text-muted">{r.notes}</p>}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <div className="text-right">
                          <div className="text-[12px] text-muted">per month</div>
                          <div className="tabular-nums font-semibold">{daily > 0 ? money(Math.round(daily * DAYS_PER_MONTH), settings.currency) : "—"}</div>
                        </div>
                        {canEdit && (
                          <RecordActions label="Price actions"><form action={deleteRateAction}>
                            <input type="hidden" name="id" value={r.id} />
                            <ConfirmSubmit className="record-delete-action"
                              message={`Remove the ${r.product} price for ${customer.name}? Deliveries already logged keep their own price.`}

                            >Remove price</ConfirmSubmit>
                          </form></RecordActions>
                        )}
                      </div>
                    </div>
                    {canEdit && (
                      <div className="mt-2">
                        <Disclosure label="Edit price" tone="ghost">
                          <Card className="p-4">
                            <CustomerRateForm
                              customerId={customer.id}
                              rate={{
                                id: r.id, product: r.product, unit: r.unit,
                                unitPrice: Number(r.unitPrice),
                                dailyQty: r.dailyQty === null ? null : Number(r.dailyQty),
                                category: r.category, notes: r.notes, active: r.active,
                              }}
                            />
                          </Card>
                        </Disclosure>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        {canEdit && (
          <Section title="Record a delivery" subtitle="One-off, or a monthly total across a date range">
            <div className="p-4">
              <SaleForm customerId={customer.id} rates={saleRates} currency={settings.currency} />
            </div>
          </Section>
        )}

        <Section title="Income by month" subtitle="Months with deliveries, most recent first">
          <BarList items={monthlyRows} accent="a" emptyText="No deliveries recorded yet." />
        </Section>

        <Section title="By product" subtitle="Everything this buyer has taken">
          {byProduct.length === 0 ? (
            <Empty icon="📦" title="Nothing recorded yet" hint="Record a delivery and it will show up here." />
          ) : (
            <div className="scroll-x">
              <table className="w-full min-w-[360px]">
                <thead>
                  <tr>
                    <th className="th">Product</th>
                    <th className="th text-right">Quantity</th>
                    <th className="th text-right">Income</th>
                  </tr>
                </thead>
                <tbody>
                  {byProduct.map((p) => (
                    <tr key={`${p.product}-${p.unit}`} className="row">
                      <td className="td">{p.product}</td>
                      <td className="td text-right tabular-nums">{num(p._sum.quantity, 3)} {p.unit}</td>
                      <td className="td text-right tabular-nums font-semibold">{money(p._sum.amount, settings.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <Section
          title="Deliveries"
          subtitle={sales.length > RECENT_DELIVERIES ? `Most recent ${RECENT_DELIVERIES} of ${sales.length}` : `${sales.length} recorded`}
          className="lg:col-span-2"
        >
          {recent.length === 0 ? (
            <Empty icon="🧾" title="No deliveries yet" hint="Each one you record also shows up as income in Finance." />
          ) : (
            <div className="scroll-x">
              <table className="w-full min-w-[620px]">
                <thead>
                  <tr>
                    <th className="th">Date</th>
                    <th className="th">Product</th>
                    <th className="th text-right">Quantity</th>
                    <th className="th text-right">Rate</th>
                    <th className="th text-right">Amount</th>
                    <th className="th">Notes</th>
                    {canEdit && <th className="th w-10"></th>}
                  </tr>
                </thead>
                <tbody>
                  {recent.map((s) => (
                    <tr key={s.id} className="row">
                      <td className="td whitespace-nowrap">{fmtDate(s.date)}</td>
                      <td className="td">{s.product}</td>
                      <td className="td text-right tabular-nums">{num(s.quantity, 3)} {s.unit}</td>
                      <td className="td text-right tabular-nums text-muted">{money(s.unitPrice, settings.currency)}/{s.unit}</td>
                      <td className="td text-right tabular-nums font-semibold">{money(s.amount, settings.currency)}</td>
                      <td className="td text-muted">{s.notes ?? "—"}</td>
                      {canEdit && (
                        <td className="td text-right">
                          <RecordActions label="Delivery actions"><form action={deleteSaleAction}>
                            <input type="hidden" name="id" value={s.id} />
                            <ConfirmSubmit className="record-delete-action"
                              message={`Delete the ${fmtDate(s.date)} delivery (${money(s.amount, settings.currency)})? Its income entry goes too.`}

                            >Delete delivery</ConfirmSubmit>
                          </form></RecordActions>
                        </td>
                      )}
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
