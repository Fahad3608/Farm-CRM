import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getSettings } from "@/lib/settings";
import { Card, Empty, Field, PageHeader, Section, StatTile } from "@/components/ui";
import Disclosure from "@/components/Disclosure";
import ActionForm, { SubmitButton } from "@/components/ActionForm";
import { bulkEditSelectedTransactionsAction, categorizeExpenseAction, deleteSelectedTransactionsAction, deleteTransactionAction, saveBulkTransactionsAction, saveTransactionAction } from "@/app/actions/finance";

import LedgerTable, { type LedgerRow } from "@/components/LedgerTable";
import CategorySelect from "@/components/CategorySelect";
import AutoSubmitSelect from "@/components/AutoSubmitSelect";
import { EXPENSE_CATEGORIES, EXPENSE_GROUP_LABELS, NO_PAYER, CATEGORY_GROUPS, categoryGroupOf } from "@/lib/domain";
import { fmtDate, money } from "@/lib/format";

export const dynamic = "force-dynamic";

type Search = {
  paidBy?: string;
  /** Drill state: a month (YYYY-MM), then a sub-category. */
  month?: string; sub?: string;
  page?: string;
};

const PER_PAGE = 50;

/** "2026-09" -> "September 2026", read in UTC to match how dates are stored. */
function monthLabel(key: string) {
  return new Date(`${key}-01T12:00:00Z`).toLocaleDateString(undefined, {
    month: "long", year: "numeric", timeZone: "UTC",
  });
}

const mainLabel = (name: string) => EXPENSE_GROUP_LABELS[name] ?? name;

export default async function FinancePage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireUser();
  if (!can.viewFinance(user.role)) redirect("/dashboard");

  const sp = await searchParams;
  const settings = await getSettings();
  const now = new Date();

  const payerFilter = sp.paidBy ?? "";
  const paidByWhere =
    payerFilter === NO_PAYER ? { paidBy: null } : payerFilter ? { paidBy: payerFilter } : {};

  const monthKey = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : "";
  const subKey = sp.sub?.trim() || "";

  const [dbCategories, dbPayers, usedCategories, animals, allDates, lifetime] = await Promise.all([
    prisma.category.findMany({ where: { type: "EXPENSE" }, orderBy: { name: "asc" } }),
    prisma.payer.findMany({ orderBy: { name: "asc" } }),
    prisma.transaction.findMany({ where: { type: "EXPENSE" }, select: { category: true }, distinct: ["category"] }),
    prisma.animal.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true, tagId: true }, orderBy: { tagId: "asc" } }),
    // Which months the filter can offer — only ones that actually have spend.
    prisma.transaction.findMany({ where: { type: "EXPENSE", ...paidByWhere }, select: { date: true } }),
    prisma.transaction.aggregate({ where: { type: "EXPENSE", ...paidByWhere }, _sum: { amount: true } }),
  ]);

  const assignedGroups = new Map(dbCategories.filter((c) => c.group).map((c) => [c.name, c.group!]));
  const allCategories = [...new Set([
    ...EXPENSE_CATEGORIES,
    ...dbCategories.map((c) => c.name),
    ...usedCategories.map((c) => c.category),
  ])].sort();
  const mainOf = (category: string) => categoryGroupOf(category, assignedGroups);

  const monthOptions = [...new Set(allDates.map((d) => d.date.toISOString().slice(0, 7)))].sort((a, b) => b.localeCompare(a));

  // A month filter is a plain range over that month — no date pickers, and
  // nothing capped at today, so a cost dated ahead still shows in its month.
  const monthRange = (() => {
    if (!monthKey) return {};
    const [y, m] = monthKey.split("-").map(Number);
    return { date: { gte: new Date(y, m - 1, 1, 0, 0, 0, 0), lte: new Date(y, m, 0, 23, 59, 59, 999) } };
  })();

  const where = {
    type: "EXPENSE" as const,
    ...monthRange,
    ...paidByWhere,
    ...(subKey ? { category: subKey } : {}),
  };

  const page = Math.max(1, Number(sp.page ?? 1) || 1);

  const [rollup, scopeTotal] = await Promise.all([
    // Every row in scope, but only the fields the roll-ups need — so month and
    // category totals stay exact however many entries there are.
    prisma.transaction.findMany({
      where,
      orderBy: { date: "desc" },
      select: { date: true, amount: true, category: true, description: true },
    }),
    prisma.transaction.aggregate({ where, _sum: { amount: true }, _count: true }),
  ]);

  const total = Number(scopeTotal._sum.amount ?? 0);
  const count = scopeTotal._count;
  const lifetimeTotal = Number(lifetime._sum.amount ?? 0);

  const lastPage = Math.max(1, Math.ceil(count / PER_PAGE));
  const currentPage = Math.min(page, lastPage);

  const entries = await prisma.transaction.findMany({
    where,
    orderBy: { date: "desc" },
    skip: (currentPage - 1) * PER_PAGE,
    take: PER_PAGE,
    include: {
      animal: { select: { id: true, name: true, tagId: true, species: true, profilePhotoId: true } },
      equipment: { select: { id: true, name: true } },
    },
  });

  const allPayers = [...new Set([
    ...dbPayers.map((p) => p.name),
    ...(await prisma.transaction.findMany({ where: { type: "EXPENSE", paidBy: { not: null } }, select: { paidBy: true }, distinct: ["paidBy"] }))
      .map((r) => r.paidBy!)
      .filter(Boolean),
  ])].sort();

  const href = (next: Partial<Record<"month" | "sub", string>>) => {
    const q = new URLSearchParams();
    if (payerFilter) q.set("paidBy", payerFilter);
    for (const [k, v] of Object.entries(next)) if (v) q.set(k, v);
    const s = q.toString();
    return s ? `/finance?${s}` : "/finance";
  };

  /** Same place in the drill, a different page of entries. */
  const pageHref = (n: number) => {
    const [path, query = ""] = href({ month: monthKey, sub: subKey }).split("?");
    const q = new URLSearchParams(query);
    if (n > 1) q.set("page", String(n)); else q.delete("page");
    const s = q.toString();
    return s ? `${path}?${s}#entries` : `${path}#entries`;
  };

  const level: "months" | "subs" | "ledger" = subKey ? "ledger" : monthKey ? "subs" : "months";

  // Roll the scoped rows up whichever way this level needs.
  const byMonth = new Map<string, { total: number; count: number }>();
  const bySub = new Map<string, { total: number; count: number; main: string }>();
  for (const t of rollup) {
    const amount = Number(t.amount);
    const mk = t.date.toISOString().slice(0, 7);
    const m = byMonth.get(mk) ?? { total: 0, count: 0 };
    m.total += amount; m.count += 1; byMonth.set(mk, m);

    const s = bySub.get(t.category) ?? { total: 0, count: 0, main: mainOf(t.category) };
    s.total += amount; s.count += 1; bySub.set(t.category, s);
  }
  const monthRows = [...byMonth].sort(([a], [b]) => b.localeCompare(a));

  // Sub-categories sit under their main category, biggest group first inside
  // the spreadsheet's own ordering, so the month reads like the sheet does.
  const groupedSubs = CATEGORY_GROUPS
    .map((group) => ({
      group,
      total: [...bySub].filter(([, s]) => s.main === group).reduce((sum, [, s]) => sum + s.total, 0),
      subs: [...bySub].filter(([, s]) => s.main === group).sort((a, b) => b[1].total - a[1].total),
    }))
    .filter((g) => g.subs.length > 0);

  const pct = (part: number) => (total > 0 ? `${Math.round((part / total) * 100)}%` : "—");

  // At the ledger everything shares one category, so the useful outlier there
  // is the single biggest entry rather than the biggest category.
  const largestEntry = rollup.reduce<{ label: string; amount: number } | null>(
    (best, t) => {
      const amount = Number(t.amount);
      return !best || amount > best.amount ? { label: t.description ?? t.category, amount } : best;
    },
    null,
  );

  const ledgerRows: LedgerRow[] = entries.map((t) => ({
    id: t.id,
    date: t.date.toISOString(),
    category: t.category,
    description: t.description,
    vendor: t.vendor,
    paymentMethod: t.paymentMethod,
    reference: t.reference,
    paidBy: t.paidBy,
    type: t.type,
    amount: t.amount.toString(),
    isAuto: Boolean(t.healthRecordId || t.feedLogId || t.batchCostId || t.saleId),
    animal: t.animal,
    equipment: t.equipment,
    animalLabel: t.animalLabel,
    usdText: null,
  }));

  const crumbs = [
    { label: "All months", go: href({}), here: level === "months" },
    ...(monthKey ? [{ label: monthLabel(monthKey), go: href({ month: monthKey }), here: level === "subs" }] : []),
    ...(subKey ? [{ label: subKey, go: href({ month: monthKey, sub: subKey }), here: true }] : []),
  ];

  const showing = count === 0
    ? "No entries"
    : `Showing ${(currentPage - 1) * PER_PAGE + 1}–${Math.min(currentPage * PER_PAGE, count)} of ${count}`;

  return (
    <>
      <PageHeader
        title={level === "ledger" ? subKey : level === "subs" ? monthLabel(monthKey) : "Expenses"}
        subtitle={
          level === "months"
            ? "Every expense recorded · pick a month to drill in"
            : level === "subs"
            ? "Sub-categories this month — tap one for its entries"
            : `${count} ${count === 1 ? "entry" : "entries"}${monthKey ? ` in ${monthLabel(monthKey)}` : " across every month"}`
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/finance/categories" className="btn-ghost btn-sm">Spend by category</Link>
            <Link href="/finance/manage" className="btn-ghost btn-sm">Categories</Link>
          </div>
        }
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

      {/* Both filters apply the moment they change — no separate Apply step,
          which only ever looked like the dropdown had done nothing. */}
      <form className="mb-4 flex flex-wrap items-end gap-2" action="/finance">
        {subKey && <input type="hidden" name="sub" value={subKey} />}
        <Field label="Month">
          <AutoSubmitSelect
            name="month"
            defaultValue={monthKey}
            className="input w-auto"
            options={["", ...monthOptions]}
            labels={{ "": "All months", ...Object.fromEntries(monthOptions.map((m) => [m, monthLabel(m)])) }}
          />
        </Field>
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
        {(monthKey || payerFilter) && <Link href="/finance" className="btn-ghost btn-sm">Reset</Link>}
      </form>

      {/* A single month is just its filters and its sub-categories — the
          month's own total sits at the foot of that list, so tiles here would
          only repeat it. */}
      {level !== "subs" && (
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            label={level === "months" ? "Total" : "Total here"}
            value={money(total, settings.currency)}
            tone="bad"
            hint={`${count} ${count === 1 ? "entry" : "entries"}`}
          />
          <StatTile label="Total so far" value={money(lifetimeTotal, settings.currency)} hint="All time, every category" />
          {level === "months" ? (
            <StatTile
              label="Months covered"
              value={monthRows.length}
              hint={monthRows.length ? `${monthLabel(monthRows[monthRows.length - 1][0])} — ${monthLabel(monthRows[0][0])}` : "Nothing recorded"}
            />
          ) : (
            <StatTile
              label="Largest entry"
              value={largestEntry ? money(largestEntry.amount, settings.currency) : "—"}
              hint={largestEntry ? largestEntry.label : "Nothing recorded"}
            />
          )}
          <StatTile
            label={level === "months" ? "Average per month" : "Average per entry"}
            value={money(
              Math.round(level === "months" ? total / (monthRows.length || 1) : total / (count || 1)),
              settings.currency,
            )}
            hint={level === "months" ? "Across the months shown" : `Over ${count} ${count === 1 ? "entry" : "entries"}`}
          />
        </div>
      )}

      {level === "months" && (
        <Section title="Month by month" subtitle="Newest first — tap a month for its sub-categories" className="mb-4">
          {monthRows.length === 0 ? (
            <Empty icon="🧾" title="No expenses recorded yet" hint="Add one below, or clear the Paid by filter." />
          ) : (
            <>
              <ul className="divide-y divide-line">
                {monthRows.map(([key, m]) => (
                  <li key={key}>
                    <Link href={href({ month: key })} className="flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-surface2/60">
                      <span className="min-w-0">
                        <span className="truncate text-[15px] font-medium">{monthLabel(key)}</span>
                        <span className="block text-[12.5px] text-muted">{m.count} {m.count === 1 ? "entry" : "entries"}</span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block tabular-nums font-semibold">{money(m.total, settings.currency)}</span>
                        <span className="block text-[12px] text-muted">{pct(m.total)} of total →</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between gap-3 border-t-2 border-line px-4 py-3">
                <span className="font-semibold">Total cost</span>
                <span className="tabular-nums font-semibold">{money(total, settings.currency)}</span>
              </div>
            </>
          )}
        </Section>
      )}

      {level === "subs" && (
        <Section
          title="Sub-categories"
          subtitle={`${monthLabel(monthKey)} — grouped by main category`}
          className="mb-4"
        >
          {groupedSubs.length === 0 ? (
            <Empty icon="🏷️" title="Nothing recorded this month" />
          ) : (
            <>
              {groupedSubs.map((g) => (
                <div key={g.group}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t border-line px-4 pb-2 pt-5">
                    <h3 className="text-[19px] font-semibold tracking-tight">{mainLabel(g.group)}</h3>
                    <span className="text-[19px] font-semibold tabular-nums">{money(g.total, settings.currency)}</span>
                  </div>
                  <ul className="divide-y divide-line border-t border-line">
                    {g.subs.map(([name, s]) => (
                      <li key={name}>
                        <Link
                          href={href({ month: monthKey, sub: name })}
                          className="flex items-center justify-between gap-3 px-4 py-2 text-[13.5px] hover:bg-surface2/60"
                        >
                          <span className="min-w-0 truncate">
                            {name}
                            <span className="ml-2 text-[12.5px] text-muted">
                              {s.count} {s.count === 1 ? "entry" : "entries"}
                            </span>
                          </span>
                          <span className="shrink-0 tabular-nums text-muted">
                            {money(s.total, settings.currency)} <span className="text-[12px]">· {pct(s.total)} →</span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <div className="flex items-center justify-between gap-3 border-t-2 border-line px-4 py-3">
                <span className="font-semibold">Total cost</span>
                <span className="tabular-nums font-semibold">{money(total, settings.currency)}</span>
              </div>
            </>
          )}
        </Section>
      )}

      <div id="entries" className="scroll-mt-4">
        <Section
          title={level === "ledger" ? "Ledger" : "Entries"}
          subtitle={showing}
          action={lastPage > 1 ? <span className="text-[13px] text-muted">Page {currentPage} of {lastPage}</span> : undefined}
        >
          {ledgerRows.length === 0 ? (
            <Empty icon="🧾" title="Nothing to show" />
          ) : level === "ledger" ? (
            <LedgerTable
              categorizeExpense={categorizeExpenseAction}
              expenseCategories={allCategories}
              rows={ledgerRows}
              currency={settings.currency}
              animals={animals}
              categories={allCategories}
              payers={allPayers}
              deleteOne={deleteTransactionAction}
              deleteSelected={deleteSelectedTransactionsAction}
              bulkEditSelected={bulkEditSelectedTransactionsAction}
              saveTransaction={saveTransactionAction}
            />
          ) : (
            <div className="scroll-x">
              <table className="w-full min-w-[680px]">
                <thead>
                  <tr>
                    <th className="th">Date</th>
                    <th className="th">Description</th>
                    <th className="th">Sub category</th>
                    <th className="th">Main category</th>
                    <th className="th">Paid by</th>
                    <th className="th text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((t) => (
                    <tr key={t.id} className="row">
                      <td className="td whitespace-nowrap">{fmtDate(t.date)}</td>
                      <td className="td">{t.description ?? "—"}</td>
                      <td className="td">
                        <Link href={href({ month: monthKey, sub: t.category })} className="text-brand hover:underline">{t.category}</Link>
                      </td>
                      <td className="td text-muted">{mainLabel(mainOf(t.category))}</td>
                      <td className="td">{t.paidBy ?? <span className="text-muted">—</span>}</td>
                      <td className="td text-right tabular-nums font-semibold">{money(t.amount, settings.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {lastPage > 1 && (
            <nav className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-[13.5px]">
              {currentPage > 1
                ? <Link href={pageHref(currentPage - 1)} className="btn-ghost btn-sm">← Newer</Link>
                : <span />}
              <span className="text-muted">Page {currentPage} of {lastPage}</span>
              {currentPage < lastPage
                ? <Link href={pageHref(currentPage + 1)} className="btn-ghost btn-sm">Older →</Link>
                : <span />}
            </nav>
          )}
        </Section>
      </div>

      <div className="mt-4 grid gap-3">
        <Disclosure label="Add expense">
          <Card className="p-4">
            <ActionForm action={saveTransactionAction} className="grid gap-4 sm:grid-cols-2" resetOnSuccess>
              <input type="hidden" name="type" value="EXPENSE" />
              <Field label="Date *"><input type="date" name="date" required defaultValue={now.toISOString().slice(0, 10)} className="input" /></Field>
              <CategorySelect
                categories={allCategories}
                assigned={Object.fromEntries(assignedGroups)}
                defaultValue={subKey}
              />
              <Field label={`Amount (${settings.currency}) *`}><input name="amount" required inputMode="decimal" className="input" placeholder="0" /></Field>
              <Field label="Paid by" hint="Whose money this was">
                <input name="paidBy" className="input" list="payer-opts" defaultValue={payerFilter === NO_PAYER ? "" : payerFilter} placeholder="Fahad" />
                <datalist id="payer-opts">{allPayers.map((p) => <option key={p} value={p} />)}</datalist>
              </Field>
              <Field label="Description / payee" className="sm:col-span-2"><input name="description" className="input" placeholder="Uncle - Farm feed" /></Field>
              <div className="sm:col-span-2"><SubmitButton>Save expense</SubmitButton></div>
            </ActionForm>
          </Card>
        </Disclosure>

        <Disclosure label="Add multiple expenses" tone="ghost">
          <Card className="p-4">
            <ActionForm action={saveBulkTransactionsAction} className="flex flex-col gap-4" resetOnSuccess>
              <input type="hidden" name="type" value="EXPENSE" />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Date *" hint="Applies to every line below">
                  <input type="date" name="date" required defaultValue={now.toISOString().slice(0, 10)} className="input" />
                </Field>
                <CategorySelect
                  categories={allCategories}
                  assigned={Object.fromEntries(assignedGroups)}
                  defaultValue={subKey}
                  idPrefix="bulk"
                />
                <Field label="Paid by" hint="Applies to every line below" className="sm:col-span-2">
                  <input name="paidBy" className="input" list="bulk-payer-opts" placeholder="Fahad" />
                  <datalist id="bulk-payer-opts">{allPayers.map((p) => <option key={p} value={p} />)}</datalist>
                </Field>
              </div>
              <Field label="Expenses — one per line, as: description, amount" hint='e.g. "Gate 8 foot, 22500"'>
                <textarea name="lines" required rows={8} className="input resize-y font-mono text-[13px]" placeholder={"Gate 8 foot, 22500\nPipe 100 foot, 5300"} />
              </Field>
              <div><SubmitButton>Save all</SubmitButton></div>
            </ActionForm>
          </Card>
        </Disclosure>
      </div>
    </>
  );
}
