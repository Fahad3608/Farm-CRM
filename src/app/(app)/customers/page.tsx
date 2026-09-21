import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getSettings } from "@/lib/settings";
import { PageHeader, Section, Empty, Badge, StatTile } from "@/components/ui";
import Disclosure from "@/components/Disclosure";
import CustomerForm from "@/components/CustomerForm";
import { fmtDate, money } from "@/lib/format";

export const dynamic = "force-dynamic";

/** Average days in a month — turns a daily rate into a monthly figure. */
const DAYS_PER_MONTH = 30.44;

export default async function CustomersPage() {
  const user = await requireUser();
  if (!can.viewFinance(user.role)) return <p>Not permitted.</p>;
  const settings = await getSettings();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [customers, monthByCustomer, allTimeByCustomer] = await Promise.all([
    prisma.customer.findMany({
      orderBy: [{ active: "desc" }, { name: "asc" }],
      include: {
        rates: { where: { active: true }, orderBy: { product: "asc" } },
        sales: { orderBy: { date: "desc" }, take: 1, select: { date: true } },
      },
    }),
    prisma.sale.groupBy({ by: ["customerId"], where: { date: { gte: monthStart } }, _sum: { amount: true } }),
    prisma.sale.groupBy({ by: ["customerId"], _sum: { amount: true } }),
  ]);

  const thisMonth = new Map(monthByCustomer.map((r) => [r.customerId, Number(r._sum.amount ?? 0)]));
  const allTime = new Map(allTimeByCustomer.map((r) => [r.customerId, Number(r._sum.amount ?? 0)]));

  // What the rate cards say the farm should take in, if everyone keeps buying
  // their usual daily quantity. Only rates with a daily quantity can be
  // projected — a one-off buyer has nothing to project from.
  const perDay = customers.reduce(
    (sum, c) => sum + c.rates.reduce((s, r) => s + (r.dailyQty ? Number(r.dailyQty) * Number(r.unitPrice) : 0), 0),
    0,
  );
  const monthTotal = [...thisMonth.values()].reduce((s, v) => s + v, 0);
  const allTimeTotal = [...allTime.values()].reduce((s, v) => s + v, 0);
  const activeCount = customers.filter((c) => c.active).length;

  return (
    <>
      <PageHeader
        title="Customers"
        subtitle="Who buys what, at what price — and what that earns per day and per month"
        action={can.editFinance(user.role) ? (
          <Disclosure label="New buyer">
            <div className="card w-80 p-4"><CustomerForm /></div>
          </Disclosure>
        ) : undefined}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Buyers" value={activeCount} hint={customers.length > activeCount ? `${customers.length - activeCount} archived` : "Currently buying"} />
        <StatTile
          label="Expected per day"
          value={money(perDay, settings.currency)}
          hint="From the usual daily quantities"
        />
        <StatTile
          label="Expected per month"
          value={money(perDay * DAYS_PER_MONTH, settings.currency)}
          hint={`≈ ${DAYS_PER_MONTH} days`}
        />
        <StatTile
          label="This month so far"
          value={money(monthTotal, settings.currency)}
          tone="good"
          hint={`${money(allTimeTotal, settings.currency)} all time`}
        />
      </div>

      {customers.length === 0 ? (
        <Section>
          <Empty
            icon="🧾"
            title="No buyers yet"
            hint="Add the people who buy from the farm — milk, ghee, manure — with the price each one pays. Deliveries logged against them turn into income automatically."
          />
        </Section>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {customers.map((c) => {
            const daily = c.rates.reduce((s, r) => s + (r.dailyQty ? Number(r.dailyQty) * Number(r.unitPrice) : 0), 0);
            return (
              <Link key={c.id} href={`/customers/${c.id}`} className="card p-4 transition-colors hover:bg-surface2/50">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="truncate font-semibold">{c.name}</h2>
                    <p className="text-[13px] text-muted">
                      {c.phone ?? c.address ?? (c.sales[0] ? `Last delivery ${fmtDate(c.sales[0].date)}` : "No deliveries yet")}
                    </p>
                  </div>
                  {!c.active && <Badge>Archived</Badge>}
                </div>

                {c.rates.length > 0 && (
                  <ul className="mt-3 flex flex-wrap gap-1.5">
                    {c.rates.map((r) => (
                      <li key={r.id}>
                        <Badge tone="brand">
                          {r.product} · {money(r.unitPrice, settings.currency)}/{r.unit}
                          {r.dailyQty ? ` · ${Number(r.dailyQty)}/day` : ""}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[12.5px]">
                  <div>
                    <div className="text-muted">Per month</div>
                    <div className="font-semibold">{daily > 0 ? money(daily * DAYS_PER_MONTH, settings.currency) : "—"}</div>
                  </div>
                  <div>
                    <div className="text-muted">This month</div>
                    <div className="font-semibold">{money(thisMonth.get(c.id) ?? 0, settings.currency)}</div>
                  </div>
                  <div>
                    <div className="text-muted">All time</div>
                    <div className="font-semibold">{money(allTime.get(c.id) ?? 0, settings.currency)}</div>
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
