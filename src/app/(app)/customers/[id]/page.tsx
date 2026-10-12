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
import MonthlyBillForm from "@/components/MonthlyBillForm";
import { money, num } from "@/lib/format";
import { deleteCustomerAction, deleteRateAction, deleteMonthlyBillAction } from "@/app/actions/customers";

export const dynamic = "force-dynamic";

const DAYS_PER_MONTH = 30.44;

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

  const [sales, byProduct] = await Promise.all([
    prisma.sale.findMany({
      where: { customerId: id },
      select: { date: true, amount: true, quantity: true, unit: true, product: true, unitPrice: true },
      orderBy: { date: "asc" },
    }),
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

  // One line per month per product. Older per-day entries roll up into their
  // month too, so history reads the same way as anything billed monthly.
  const bills = new Map<string, {
    month: string; label: string; product: string; unit: string;
    quantity: number; amount: number;
  }>();
  for (const s of sales) {
    const month = `${s.date.getFullYear()}-${String(s.date.getMonth() + 1).padStart(2, "0")}`;
    const key = `${month}::${s.product}`;
    const entry = bills.get(key) ?? {
      month,
      label: s.date.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
      product: s.product, unit: s.unit, quantity: 0, amount: 0,
    };
    entry.quantity += Number(s.quantity);
    entry.amount += Number(s.amount);
    bills.set(key, entry);
  }
  const billRows = [...bills.values()].sort(
    (a, b) => b.month.localeCompare(a.month) || a.product.localeCompare(b.product),
  );

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

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatTile label="Expected per month" value={perDay > 0 ? money(Math.round(perDay * DAYS_PER_MONTH), settings.currency) : "—"} hint="Usual quantity at the current price" />
        <StatTile label="This month" value={money(thisMonth, settings.currency)} tone="good" hint="Billed so far" />
        <StatTile label="All time" value={money(allTime, settings.currency)} hint={`${billRows.length} month${billRows.length === 1 ? "" : "s"} billed`} />
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
          <Section title="Bill a month" subtitle="Total taken that month — the bill works itself out">
            <div className="p-4">
              {saleRates.length === 0 ? (
                <Empty icon="🥛" title="Set a price first" hint="Add what they buy and the price per unit, then months can be billed." />
              ) : (
                <MonthlyBillForm customerId={customer.id} rates={saleRates} currency={settings.currency} />
              )}
            </div>
          </Section>
        )}



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
          title="Monthly bills"
          subtitle={billRows.length ? `${billRows.length} month${billRows.length === 1 ? "" : "s"} billed · most recent first` : "Nothing billed yet"}
          className="lg:col-span-2"
        >
          {billRows.length === 0 ? (
            <Empty icon="🧾" title="No months billed yet" hint="Bill a month above and it shows up here, and as income in Finance." />
          ) : (
            <div className="scroll-x">
              <table className="w-full min-w-[620px]">
                <thead>
                  <tr>
                    <th className="th">Month</th>
                    <th className="th">Product</th>
                    <th className="th text-right">Quantity</th>
                    <th className="th text-right">Rate</th>
                    <th className="th text-right">Bill</th>
                    {canEdit && <th className="th w-10"></th>}
                  </tr>
                </thead>
                <tbody>
                  {billRows.map((b) => (
                    <tr key={`${b.month}-${b.product}`} className="row">
                      <td className="td whitespace-nowrap font-medium">{b.label}</td>
                      <td className="td">{b.product}</td>
                      <td className="td text-right tabular-nums">{num(b.quantity, 3)} {b.unit}</td>
                      <td className="td text-right tabular-nums text-muted">
                        {b.quantity > 0 ? `${money(b.amount / b.quantity, settings.currency)}/${b.unit}` : "—"}
                      </td>
                      <td className="td text-right tabular-nums font-semibold">{money(b.amount, settings.currency)}</td>
                      {canEdit && (
                        <td className="td text-right">
                          <RecordActions label="Bill actions"><form action={deleteMonthlyBillAction}>
                            <input type="hidden" name="customerId" value={customer.id} />
                            <input type="hidden" name="product" value={b.product} />
                            <input type="hidden" name="month" value={b.month} />
                            <ConfirmSubmit className="record-delete-action"
                              message={`Delete the ${b.label} ${b.product} bill (${money(b.amount, settings.currency)})? Its income entry goes too.`}
                            >Delete month&rsquo;s bill</ConfirmSubmit>
                          </form></RecordActions>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-line">
                    <td className="td font-semibold" colSpan={4}>Total billed</td>
                    <td className="td text-right tabular-nums font-semibold">{money(allTime, settings.currency)}</td>
                    {canEdit && <td className="td"></td>}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Section>
      </div>
    </>
  );
}
