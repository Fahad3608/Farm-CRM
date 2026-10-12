import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getSettings } from "@/lib/settings";
import { Empty, Field, PageHeader, Section, StatTile } from "@/components/ui";
import { BarList } from "@/components/charts";
import AutoSubmitSelect from "@/components/AutoSubmitSelect";
import { EXPENSE_CATEGORIES, EXPENSE_GROUP_LABELS, NO_PAYER, CATEGORY_GROUPS, categoryGroupOf } from "@/lib/domain";
import { fmtDate, money } from "@/lib/format";

export const dynamic = "force-dynamic";

type Search = { paidBy?: string; main?: string; sub?: string };

function monthLabel(key: string) {
  return new Date(`${key}-01T12:00:00Z`).toLocaleDateString(undefined, {
    month: "long", year: "numeric", timeZone: "UTC",
  });
}

const mainLabel = (name: string) => EXPENSE_GROUP_LABELS[name] ?? name;

/**
 * Spend analysed by category rather than by month: which categories the money
 * goes to across the whole history, who funded it, and — once you pick one —
 * how that category has run month to month.
 */
export default async function SpendByCategoryPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireUser();
  if (!can.viewFinance(user.role)) redirect("/dashboard");

  const sp = await searchParams;
  const settings = await getSettings();

  const payerFilter = sp.paidBy ?? "";
  const paidByWhere =
    payerFilter === NO_PAYER ? { paidBy: null } : payerFilter ? { paidBy: payerFilter } : {};

  const mainKey = sp.main?.trim() || "";
  const subKey = sp.sub?.trim() || "";

  const [dbCategories, dbPayers, usedCategories, investmentByPayer] = await Promise.all([
    prisma.category.findMany({ where: { type: "EXPENSE" }, orderBy: { name: "asc" } }),
    prisma.payer.findMany({ orderBy: { name: "asc" } }),
    prisma.transaction.findMany({ where: { type: "EXPENSE" }, select: { category: true }, distinct: ["category"] }),
    prisma.transaction.groupBy({ by: ["paidBy"], where: { type: "EXPENSE" }, _sum: { amount: true }, _count: true }),
  ]);

  const assignedGroups = new Map(dbCategories.filter((c) => c.group).map((c) => [c.name, c.group!]));
  const allCategories = [...new Set([
    ...EXPENSE_CATEGORIES,
    ...dbCategories.map((c) => c.name),
    ...usedCategories.map((c) => c.category),
  ])].sort();
  const mainOf = (category: string) => categoryGroupOf(category, assignedGroups);

  const subsOfMain = mainKey ? allCategories.filter((c) => mainOf(c) === mainKey) : [];
  const categoryWhere = subKey
    ? { category: subKey }
    : mainKey
    ? { category: { in: subsOfMain } }
    : {};

  // No date filter anywhere here: this page answers "what has it cost us?",
  // which shouldn't need a range widened first.
  const where = { type: "EXPENSE" as const, ...paidByWhere, ...categoryWhere };

  const [entries, scoped] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: { date: "desc" },
      take: 2000,
      select: { id: true, date: true, category: true, amount: true, description: true, paidBy: true },
    }),
    prisma.transaction.aggregate({ where, _sum: { amount: true }, _count: true }),
  ]);

  const total = Number(scoped._sum.amount ?? 0);
  const count = scoped._count;

  const allPayers = [...new Set([
    ...dbPayers.map((p) => p.name),
    ...investmentByPayer.map((r) => r.paidBy).filter((n): n is string => Boolean(n)),
  ])].sort();

  const investmentRows = investmentByPayer
    .map((r) => ({ payer: r.paidBy, count: r._count, total: Number(r._sum.amount ?? 0) }))
    .sort((a, b) => b.total - a.total);
  const investedTotal = investmentRows.reduce((sum, r) => sum + r.total, 0);

  const byMain = new Map<string, { total: number; count: number; subs: Set<string> }>();
  const bySub = new Map<string, { total: number; count: number; main: string }>();
  const byMonth = new Map<string, { total: number; count: number }>();
  for (const t of entries) {
    const amount = Number(t.amount);
    const main = mainOf(t.category);
    const g = byMain.get(main) ?? { total: 0, count: 0, subs: new Set<string>() };
    g.total += amount; g.count += 1; g.subs.add(t.category); byMain.set(main, g);

    const s = bySub.get(t.category) ?? { total: 0, count: 0, main };
    s.total += amount; s.count += 1; bySub.set(t.category, s);

    const mk = t.date.toISOString().slice(0, 7);
    const m = byMonth.get(mk) ?? { total: 0, count: 0 };
    m.total += amount; m.count += 1; byMonth.set(mk, m);
  }
  const mainRows = [...byMain].sort(
    ([a], [b]) => CATEGORY_GROUPS.indexOf(a as never) - CATEGORY_GROUPS.indexOf(b as never),
  );
  const subRows = [...bySub].sort((a, b) => b[1].total - a[1].total);
  const monthRows = [...byMonth].sort(([a], [b]) => b.localeCompare(a));

  const href = (next: Partial<Record<"main" | "sub" | "paidBy", string>>) => {
    const q = new URLSearchParams();
    if (payerFilter) q.set("paidBy", payerFilter);
    for (const [k, v] of Object.entries(next)) if (v) q.set(k, v);
    const s = q.toString();
    return s ? `/finance/categories?${s}` : "/finance/categories";
  };

  const pct = (part: number) => (total > 0 ? `${Math.round((part / total) * 100)}%` : "—");
  const drilling = Boolean(mainKey || subKey);

  const crumbs = [
    { label: "All categories", go: href({}), here: !drilling },
    ...(mainKey ? [{ label: mainLabel(mainKey), go: href({ main: mainKey }), here: !subKey }] : []),
    ...(subKey ? [{ label: subKey, go: href({ sub: subKey }), here: true }] : []),
  ];

  return (
    <>
      <PageHeader
        title={subKey || (mainKey ? mainLabel(mainKey) : "Spend by category")}
        subtitle={
          drilling
            ? `Every entry ever recorded · ${count} ${count === 1 ? "entry" : "entries"}`
            : "Across the whole history, no date filter"
        }
        action={<Link href="/finance" className="btn-ghost btn-sm">Month by month</Link>}
      />

      {crumbs.length > 1 && (
        <nav aria-label="Breadcrumb" className="mb-3 flex flex-wrap items-center gap-1.5 text-[13px]">
          {crumbs.map((c, i) => (
            <span key={c.go} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-muted" aria-hidden>›</span>}
              {c.here ? <span className="font-medium">{c.label}</span> : <Link href={c.go} className="text-brand hover:underline">{c.label}</Link>}
            </span>
          ))}
        </nav>
      )}

      <form className="mb-4 flex flex-wrap items-end gap-2" action="/finance/categories">
        {mainKey && <input type="hidden" name="main" value={mainKey} />}
        {subKey && <input type="hidden" name="sub" value={subKey} />}
        <Field label="Paid by">
          <AutoSubmitSelect
            name="paidBy"
            defaultValue={payerFilter}
            className="input w-auto"
            options={["", ...allPayers, NO_PAYER]}
            labels={{ "": "Anyone", [NO_PAYER]: "Not recorded" }}
          />
        </Field>
        <noscript><button className="btn-ghost">Apply</button></noscript>
        {payerFilter && <Link href={href({ main: mainKey, sub: subKey })} className="btn-ghost btn-sm">Reset</Link>}
      </form>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label={drilling ? "Total for this category" : "Total so far"}
          value={money(total, settings.currency)}
          tone="bad"
          hint={`${count} ${count === 1 ? "entry" : "entries"}`}
        />
        <StatTile
          label="Average per month"
          value={money(Math.round(total / (monthRows.length || 1)), settings.currency)}
          hint={`Across ${monthRows.length} ${monthRows.length === 1 ? "month" : "months"}`}
        />
        <StatTile
          label="Biggest sub-category"
          value={subRows[0] ? pct(subRows[0][1].total) : "—"}
          hint={subRows[0] ? subRows[0][0] : "Nothing recorded"}
        />
        <StatTile
          label="Months covered"
          value={monthRows.length}
          hint={monthRows.length ? `${monthLabel(monthRows[monthRows.length - 1][0])} — ${monthLabel(monthRows[0][0])}` : "Nothing recorded"}
        />
      </div>

      {!drilling && (
        <Section title="Main categories" subtitle="Share of all spend — tap one to drill in" className="mb-4">
          {mainRows.length === 0 ? (
            <Empty icon="📊" title="No expenses recorded yet" />
          ) : (
            <ul className="divide-y divide-line">
              {mainRows.map(([name, m]) => (
                <li key={name}>
                  <Link href={href({ main: name })} className="flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-surface2/60">
                    <span className="min-w-0">
                      <span className="truncate text-[15px] font-medium">{mainLabel(name)}</span>
                      <span className="block text-[12.5px] text-muted">
                        {m.subs.size} {m.subs.size === 1 ? "sub-category" : "sub-categories"} · {m.count} {m.count === 1 ? "entry" : "entries"}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block tabular-nums font-semibold">{money(m.total, settings.currency)}</span>
                      <span className="block text-[12px] text-muted">{pct(m.total)} of spend →</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      {!subKey && (
        <Section
          title="Sub-categories"
          subtitle={mainKey ? `Inside ${mainLabel(mainKey)} — biggest first` : "Biggest first — tap one for its monthly history"}
          className="mb-4"
        >
          {subRows.length === 0 ? (
            <Empty icon="🏷️" title="No expenses recorded yet" />
          ) : (
            <ul className="divide-y divide-line">
              {subRows.map(([name, s]) => (
                <li key={name}>
                  <Link href={href({ sub: name })} className="flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-surface2/60">
                    <span className="min-w-0">
                      <span className="truncate text-[15px] font-medium">{name}</span>
                      <span className="block text-[12.5px] text-muted">
                        {mainLabel(s.main)} · {s.count} {s.count === 1 ? "entry" : "entries"}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block tabular-nums font-semibold">{money(s.total, settings.currency)}</span>
                      <span className="block text-[12px] text-muted">{pct(s.total)} →</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      {drilling && (
        <Section title="Month by month" subtitle="How this has added up over time" className="mb-4">
          {monthRows.length === 0 ? (
            <Empty icon="🧾" title="Nothing recorded here yet" />
          ) : (
            <div className="scroll-x border-t border-line">
              <table className="w-full min-w-[460px]">
                <thead>
                  <tr>
                    <th className="th">Month</th>
                    <th className="th text-right">Entries</th>
                    <th className="th text-right">Share</th>
                    <th className="th text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {monthRows.map(([key, m]) => (
                    <tr key={key} className="row">
                      <td className="td font-medium">
                        <Link href={`/finance?month=${key}${mainKey ? `&main=${encodeURIComponent(mainKey)}` : ""}${subKey ? `&sub=${encodeURIComponent(subKey)}` : ""}`} className="text-brand hover:underline">
                          {monthLabel(key)}
                        </Link>
                      </td>
                      <td className="td text-right tabular-nums text-muted">{m.count}</td>
                      <td className="td text-right tabular-nums text-muted">{pct(m.total)}</td>
                      <td className="td text-right tabular-nums font-semibold">{money(m.total, settings.currency)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-line">
                    <td className="td font-semibold" colSpan={3}>Total</td>
                    <td className="td text-right tabular-nums font-semibold">{money(total, settings.currency)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Section>
      )}

      {subKey && (
        <Section title="Entries" subtitle={`${count} ${count === 1 ? "entry" : "entries"} · newest first`} className="mb-4">
          {entries.length === 0 ? (
            <Empty icon="🧾" title="No entries under this category" />
          ) : (
            <div className="scroll-x">
              <table className="w-full min-w-[520px]">
                <thead>
                  <tr>
                    <th className="th">Date</th>
                    <th className="th">Description</th>
                    <th className="th">Paid by</th>
                    <th className="th text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((t) => (
                    <tr key={t.id} className="row">
                      <td className="td whitespace-nowrap">{fmtDate(t.date)}</td>
                      <td className="td">{t.description ?? "—"}</td>
                      <td className="td">{t.paidBy ?? <span className="text-muted">—</span>}</td>
                      <td className="td text-right tabular-nums font-semibold">{money(t.amount, settings.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      )}

      {!drilling && (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <Section title="Spend by sub-category" subtitle="Relative size at a glance">
            <BarList
              items={subRows.map(([name, s]) => ({
                label: name,
                value: s.total,
                display: money(s.total, settings.currency),
                href: href({ sub: name }),
              }))}
              accent="b"
              emptyText="No expenses recorded yet."
            />
          </Section>

          <Section
            title="Who funded the farm"
            subtitle={`Every expense ever recorded · ${money(investedTotal, settings.currency)} in total`}
          >
            {investmentRows.length === 0 ? (
              <Empty icon="🤝" title="Nothing recorded yet" hint="Put a name in “Paid by” on an entry and each person's total builds up here." />
            ) : (
              <div className="scroll-x border-t border-line">
                <table className="w-full min-w-[420px]">
                  <thead>
                    <tr>
                      <th className="th">Paid by</th>
                      <th className="th text-right">Entries</th>
                      <th className="th text-right">Share</th>
                      <th className="th text-right">Invested</th>
                    </tr>
                  </thead>
                  <tbody>
                    {investmentRows.map((r) => (
                      <tr key={r.payer ?? "unassigned"} className="row">
                        <td className="td">
                          <Link href={href({ paidBy: r.payer ?? NO_PAYER })} className="text-brand hover:underline">
                            {r.payer ?? "Not recorded"}
                          </Link>
                        </td>
                        <td className="td text-right tabular-nums text-muted">{r.count}</td>
                        <td className="td text-right tabular-nums text-muted">
                          {investedTotal > 0 ? `${Math.round((r.total / investedTotal) * 100)}%` : "—"}
                        </td>
                        <td className="td text-right tabular-nums font-semibold">{money(r.total, settings.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-line">
                      <td className="td font-semibold" colSpan={3}>Total</td>
                      <td className="td text-right tabular-nums font-semibold">{money(investedTotal, settings.currency)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Section>
        </div>
      )}
    </>
  );
}
