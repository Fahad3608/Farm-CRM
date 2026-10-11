import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getSettings } from "@/lib/settings";
import { Badge, Card, Empty, Field, PageHeader, Section, StatTile } from "@/components/ui";
import Disclosure from "@/components/Disclosure";
import ActionForm, { SubmitButton } from "@/components/ActionForm";
import RecordActions from "@/components/RecordActions";
import ConfirmSubmit from "@/components/ConfirmSubmit";
import { bulkEditSelectedTransactionsAction, categorizeExpenseAction, deleteSelectedTransactionsAction, deleteTransactionAction, saveBulkTransactionsAction, saveTransactionAction } from "@/app/actions/finance";

import LedgerTable, { type LedgerRow } from "@/components/LedgerTable";
import { EXPENSE_CATEGORIES, EXPENSE_GROUP_LABELS, NO_PAYER, CATEGORY_GROUPS, categoryDrillHref, categoryGroupOf } from "@/lib/domain";
import { fmtDate, money } from "@/lib/format";

export const dynamic = "force-dynamic";

type Search = {
  from?: string; to?: string; paidBy?: string;
  /** Sub-category drill-down, e.g. "Worker Salary". */
  sub?: string;
  /** Main-category drill-down, e.g. "Monthly Operational Cost". */
  main?: string;
};

/** "2026-09" -> "September 2026", read in UTC to match how dates are stored. */
function monthLabel(key: string) {
  return new Date(`${key}-01T12:00:00Z`).toLocaleDateString(undefined, {
    month: "long", year: "numeric", timeZone: "UTC",
  });
}

const monthKeyOf = (d: Date) => d.toISOString().slice(0, 7);

export default async function FinancePage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireUser();
  if (!can.viewFinance(user.role)) redirect("/dashboard");

  const sp = await searchParams;
  const settings = await getSettings();
  const now = new Date();

  // Dates are stored at midday to stay timezone-stable, so the range ends at
  // the end of the day — otherwise today's entries fall outside "up to today".
  const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  const from = sp.from ? new Date(`${sp.from}T00:00:00`) : new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const to = sp.to ? new Date(`${sp.to}T23:59:59`) : endOfDay(now);

  // "Paid by" narrows to one person's money — NO_PAYER picks out the entries
  // nobody has been put against yet, which is how they get assigned.
  const payerFilter = sp.paidBy ?? "";
  const paidByWhere =
    payerFilter === NO_PAYER ? { paidBy: null } : payerFilter ? { paidBy: payerFilter } : {};

  const subFilter = sp.sub?.trim() || "";
  const mainFilter = sp.main?.trim() || "";
  const drilling = Boolean(subFilter || mainFilter);

  const [dbCategories, dbPayers, usedCategories, animals, investmentByPayer, lifetime] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.payer.findMany({ orderBy: { name: "asc" } }),
    prisma.transaction.findMany({ where: { type: "EXPENSE" }, select: { category: true }, distinct: ["category"] }),
    prisma.animal.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true, tagId: true }, orderBy: { tagId: "asc" } }),
    prisma.transaction.groupBy({ by: ["paidBy"], where: { type: "EXPENSE" }, _sum: { amount: true }, _count: true }),
    // Everything ever spent, so "total so far" doesn't move with the filters.
    prisma.transaction.aggregate({ where: { type: "EXPENSE", ...paidByWhere }, _sum: { amount: true }, _count: true }),
  ]);

  // Each sub-category rolls up into a main category — whatever's set in
  // Settings, else a built-in default matching the master spreadsheet.
  const assignedGroups = new Map(dbCategories.filter((c) => c.type === "EXPENSE" && c.group).map((c) => [c.name, c.group!]));
  const allCategories = [...new Set([
    ...EXPENSE_CATEGORIES,
    ...dbCategories.filter((c) => c.type === "EXPENSE").map((c) => c.name),
    ...usedCategories.map((c) => c.category),
  ])].sort();
  const mainOf = (category: string) => categoryGroupOf(category, assignedGroups);

  // A main-category drill-down is really "every sub-category in this group",
  // since the grouping lives in app config rather than on the row itself.
  const drillCategories = subFilter
    ? [subFilter]
    : mainFilter
    ? allCategories.filter((c) => mainOf(c) === mainFilter)
    : [];

  // Drill-downs span the whole history: the question is "what has this cost
  // us?", which shouldn't need the date filter widened first.
  const where = drilling
    ? { type: "EXPENSE" as const, category: { in: drillCategories }, ...paidByWhere }
    : { type: "EXPENSE" as const, date: { gte: from, lte: to }, ...paidByWhere };

  const [entries, rangeTotal] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: { date: "desc" },
      take: 1000,
      include: {
        animal: { select: { id: true, name: true, tagId: true, species: true, profilePhotoId: true } },
        equipment: { select: { id: true, name: true } },
      },
    }),
    prisma.transaction.aggregate({ where, _sum: { amount: true }, _count: true }),
  ]);

  const total = Number(rangeTotal._sum.amount ?? 0);
  const lifetimeTotal = Number(lifetime._sum.amount ?? 0);

  // Everyone who could be picked as a payer: the ones set up in Settings plus
  // any name already saved on an entry, so a payer never disappears from the
  // filter just because they were removed from the suggestion list.
  const allPayers = [...new Set([
    ...dbPayers.map((p) => p.name),
    ...investmentByPayer.map((r) => r.paidBy).filter((n): n is string => Boolean(n)),
  ])].sort();

  const investmentRows = investmentByPayer
    .map((r) => ({ payer: r.paidBy, count: r._count, total: Number(r._sum.amount ?? 0) }))
    .sort((a, b) => b.total - a.total);
  const investedTotal = investmentRows.reduce((sum, r) => sum + r.total, 0);

  // Group the entries into months, newest first, each with its own total.
  const monthMap = new Map<string, { total: number; rows: typeof entries }>();
  for (const t of entries) {
    const key = monthKeyOf(t.date);
    const bucket = monthMap.get(key) ?? { total: 0, rows: [] as typeof entries };
    bucket.total += Number(t.amount);
    bucket.rows.push(t);
    monthMap.set(key, bucket);
  }
  const months = [...monthMap].sort(([a], [b]) => b.localeCompare(a));

  // Totals per main category and per sub-category across whatever is shown,
  // each one a link into its own drill-down.
  const mainTotals = new Map<string, { total: number; count: number; subs: Set<string> }>();
  const subTotals = new Map<string, { total: number; count: number; main: string }>();
  for (const t of entries) {
    const main = mainOf(t.category);
    const amount = Number(t.amount);
    const m = mainTotals.get(main) ?? { total: 0, count: 0, subs: new Set<string>() };
    m.total += amount; m.count += 1; m.subs.add(t.category);
    mainTotals.set(main, m);
    const s = subTotals.get(t.category) ?? { total: 0, count: 0, main };
    s.total += amount; s.count += 1;
    subTotals.set(t.category, s);
  }
  const mainRows = [...mainTotals]
    .sort(([a], [b]) => CATEGORY_GROUPS.indexOf(a as never) - CATEGORY_GROUPS.indexOf(b as never));
  const subRows = [...subTotals].sort((a, b) => b[1].total - a[1].total);

  const dateVal = (d: Date) => d.toISOString().slice(0, 10);
  const drillTitle = subFilter || (mainFilter ? EXPENSE_GROUP_LABELS[mainFilter] ?? mainFilter : "");
  const monthsSpanned = months.length || 1;

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

  return (
    <>
      <PageHeader
        title={drilling ? drillTitle : "Expenses"}
        subtitle={
          drilling
            ? `Every entry ever recorded · ${rangeTotal._count} ${rangeTotal._count === 1 ? "entry" : "entries"}`
            : `${fmtDate(from)} — ${fmtDate(to)}`
        }
        action={
          drilling
            ? <Link href="/finance" className="btn-ghost btn-sm">← All expenses</Link>
            : <Link href="/equipment" className="btn-ghost btn-sm">Equipment & construction</Link>
        }
      />

      {!drilling && (
        <form className="mb-4 flex flex-wrap items-end gap-2" action="/finance">
          <Field label="From"><input type="date" name="from" defaultValue={dateVal(from)} className="input w-auto" /></Field>
          <Field label="To"><input type="date" name="to" defaultValue={dateVal(to)} className="input w-auto" /></Field>
          <Field label="Paid by">
            <select name="paidBy" defaultValue={payerFilter} className="input w-auto">
              <option value="">Anyone</option>
              {allPayers.map((p) => <option key={p} value={p}>{p}</option>)}
              <option value={NO_PAYER}>Not recorded</option>
            </select>
          </Field>
          <button className="btn-ghost">Apply</button>
          {(sp.from || sp.to || payerFilter) && (
            <Link href="/finance" className="btn-ghost btn-sm">Reset</Link>
          )}
        </form>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label={drilling ? "Total for this category" : "Total in this period"}
          value={money(total, settings.currency)}
          tone="bad"
          hint={`${rangeTotal._count} ${rangeTotal._count === 1 ? "entry" : "entries"}`}
        />
        <StatTile
          label="Total so far"
          value={money(lifetimeTotal, settings.currency)}
          hint={payerFilter && payerFilter !== NO_PAYER ? `All time · ${payerFilter}` : "All time, every category"}
        />
        <StatTile
          label="Months covered"
          value={months.length}
          hint={months.length ? `${monthLabel(months[months.length - 1][0])} — ${monthLabel(months[0][0])}` : "Nothing recorded"}
        />
        <StatTile
          label="Average per month"
          value={money(total / monthsSpanned, settings.currency)}
          hint="Across the months shown"
        />
      </div>

      {drilling ? (
        <>
          <Section title="Month by month" subtitle="How this category has added up" className="mb-4">
            {months.length === 0 ? (
              <Empty icon="🧾" title="Nothing recorded under this category yet" />
            ) : (
              <div className="scroll-x border-t border-line">
                <table className="w-full min-w-[420px]">
                  <thead>
                    <tr>
                      <th className="th">Month</th>
                      <th className="th text-right">Entries</th>
                      <th className="th text-right">Share</th>
                      <th className="th text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {months.map(([key, m]) => (
                      <tr key={key} className="row">
                        <td className="td font-medium">{monthLabel(key)}</td>
                        <td className="td text-right tabular-nums text-muted">{m.rows.length}</td>
                        <td className="td text-right tabular-nums text-muted">
                          {total > 0 ? `${Math.round((m.total / total) * 100)}%` : "—"}
                        </td>
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

          {mainFilter && subRows.length > 1 && (
            <Section title="Sub-categories" subtitle={`Inside ${drillTitle}`} className="mb-4">
              <ul className="divide-y divide-line">
                {subRows.map(([name, s]) => (
                  <li key={name}>
                    <Link href={categoryDrillHref("sub", name, payerFilter)} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface2/60">
                      <span className="min-w-0">
                        <span className="truncate text-[14px] font-medium">{name}</span>
                        <span className="block text-[12.5px] text-muted">{s.count} {s.count === 1 ? "entry" : "entries"}</span>
                      </span>
                      <span className="shrink-0 tabular-nums font-semibold">{money(s.total, settings.currency)} →</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <div id="ledger" className="scroll-mt-4">
            <Section title="All entries" subtitle={`${rangeTotal._count} ${rangeTotal._count === 1 ? "entry" : "entries"} · newest first`}>
              {ledgerRows.length === 0 ? (
                <Empty icon="🧾" title="No entries under this category" />
              ) : (
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
              )}
            </Section>
          </div>
        </>
      ) : (
        <>
          <Section title="Main categories" subtitle="Tap one to see its months and entries" className="mb-4">
            {mainRows.length === 0 ? (
              <Empty icon="📊" title="No expenses in this period" hint="Widen the date range or add an entry below." />
            ) : (
              <ul className="divide-y divide-line">
                {mainRows.map(([name, m]) => (
                  <li key={name}>
                    <Link href={categoryDrillHref("main", name, payerFilter)} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface2/60">
                      <span className="min-w-0">
                        <span className="truncate text-[14px] font-medium">{EXPENSE_GROUP_LABELS[name] ?? name}</span>
                        <span className="block text-[12.5px] text-muted">
                          {m.subs.size} {m.subs.size === 1 ? "sub-category" : "sub-categories"} · {m.count} {m.count === 1 ? "entry" : "entries"}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block tabular-nums font-semibold">{money(m.total, settings.currency)}</span>
                        <span className="block text-[12px] text-muted">
                          {total > 0 ? `${Math.round((m.total / total) * 100)}% of spend` : ""}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Sub-categories" subtitle="Biggest first — tap one for its monthly history" className="mb-4">
            {subRows.length === 0 ? (
              <Empty icon="🏷️" title="No expenses in this period" />
            ) : (
              <ul className="divide-y divide-line">
                {subRows.map(([name, s]) => (
                  <li key={name}>
                    <Link href={categoryDrillHref("sub", name, payerFilter)} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface2/60">
                      <span className="min-w-0">
                        <span className="truncate text-[14px] font-medium">{name}</span>
                        <span className="block text-[12.5px] text-muted">
                          {EXPENSE_GROUP_LABELS[s.main] ?? s.main} · {s.count} {s.count === 1 ? "entry" : "entries"}
                        </span>
                      </span>
                      <span className="shrink-0 tabular-nums font-semibold">{money(s.total, settings.currency)} →</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <div id="ledger" className="scroll-mt-4">
            <Section title="Month by month" subtitle="Every entry, exactly as the sheet records it">
              {months.length === 0 ? (
                <Empty icon="🧾" title="No expenses in this period" hint="Widen the date range or add an entry below." />
              ) : (
                <div className="divide-y divide-line">
                  {months.map(([key, m], index) => (
                    <details key={key} open={index === 0} className="group/month">
                      <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3 px-4 py-4 hover:bg-surface2">
                        <span className="font-semibold">{monthLabel(key)}</span>
                        <span className="flex items-center gap-3">
                          <span className="text-[12.5px] text-muted">{m.rows.length} {m.rows.length === 1 ? "entry" : "entries"}</span>
                          <span className="font-semibold tabular-nums">{money(m.total, settings.currency)}</span>
                          <span className="text-muted group-open/month:rotate-180" aria-hidden>⌄</span>
                        </span>
                      </summary>
                      <div className="scroll-x">
                        <table className="w-full min-w-[720px]">
                          <thead>
                            <tr>
                              <th className="th">Date</th>
                              <th className="th">Description</th>
                              <th className="th">Sub category</th>
                              <th className="th">Main category</th>
                              <th className="th">Paid by</th>
                              <th className="th text-right">Amount</th>
                              <th className="th"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {m.rows.map((t) => {
                              const isAuto = Boolean(t.healthRecordId || t.feedLogId || t.batchCostId || t.saleId);
                              return (
                                <tr key={t.id} className="row">
                                  <td className="td whitespace-nowrap">{fmtDate(t.date)}</td>
                                  <td className="td">
                                    {t.description ?? "—"}
                                    {t.vendor && <span className="block text-[12px] text-muted">{t.vendor}</span>}
                                  </td>
                                  <td className="td">
                                    <Link href={categoryDrillHref("sub", t.category, payerFilter)} className="text-brand hover:underline">
                                      {t.category}
                                    </Link>
                                  </td>
                                  <td className="td">
                                    <Link href={categoryDrillHref("main", mainOf(t.category), payerFilter)} className="text-muted hover:text-brand hover:underline">
                                      {EXPENSE_GROUP_LABELS[mainOf(t.category)] ?? mainOf(t.category)}
                                    </Link>
                                  </td>
                                  <td className="td">{t.paidBy ?? <span className="text-muted">—</span>}</td>
                                  <td className="td text-right tabular-nums font-semibold">{money(t.amount, settings.currency)}</td>
                                  <td className="td text-right">
                                    {isAuto ? (
                                      <Badge tone="muted">Auto</Badge>
                                    ) : (
                                      <RecordActions label="Entry actions"><form action={deleteTransactionAction}>
                                        <input type="hidden" name="id" value={t.id} />
                                        <ConfirmSubmit className="record-delete-action" message={`Delete "${t.description ?? t.category}" (${money(t.amount, settings.currency)})? This cannot be undone.`}>
                                          Delete entry
                                        </ConfirmSubmit>
                                      </form></RecordActions>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="border-t-2 border-line">
                              <td className="td font-semibold" colSpan={5}>{monthLabel(key)} total</td>
                              <td className="td text-right tabular-nums font-semibold">{money(m.total, settings.currency)}</td>
                              <td className="td"></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </Section>
          </div>

          <div className="mt-4 grid items-start gap-4 lg:grid-cols-2">
            <div className="lg:col-span-2">
              <Disclosure label="Add expense">
                <Card className="p-4">
                  <ActionForm action={saveTransactionAction} className="grid gap-4 sm:grid-cols-2" resetOnSuccess>
                    <input type="hidden" name="type" value="EXPENSE" />
                    <Field label="Date *"><input type="date" name="date" required defaultValue={dateVal(now)} className="input" /></Field>
                    <Field label="Sub category *" hint="Its main category follows from Settings">
                      <input name="category" required className="input" list="cat-opts" placeholder="Feeding Cost" />
                      <datalist id="cat-opts">{allCategories.map((c) => <option key={c} value={c} />)}</datalist>
                    </Field>
                    <Field label={`Amount (${settings.currency}) *`}><input name="amount" required inputMode="decimal" className="input" placeholder="0" /></Field>
                    <Field label="Paid by" hint="Whose money this was">
                      <input name="paidBy" className="input" list="payer-opts" defaultValue={payerFilter === NO_PAYER ? "" : payerFilter} placeholder="Fahad" />
                      <datalist id="payer-opts">{allPayers.map((p) => <option key={p} value={p} />)}</datalist>
                    </Field>
                    <Field label="Description / payee" className="sm:col-span-2"><input name="description" className="input" placeholder="Uncle - Farm feed" /></Field>
                    <Field label="Payment method">
                      <input name="paymentMethod" className="input" list="pay-opts" />
                      <datalist id="pay-opts"><option value="Cash" /><option value="Bank transfer" /><option value="JazzCash" /><option value="Easypaisa" /><option value="Cheque" /><option value="Credit" /></datalist>
                    </Field>
                    <Field label="Reference / receipt no."><input name="reference" className="input" /></Field>
                    <div className="sm:col-span-2"><SubmitButton>Save expense</SubmitButton></div>
                  </ActionForm>
                </Card>
              </Disclosure>
            </div>

            <div className="lg:col-span-2">
              <Disclosure label="Add multiple expenses" tone="ghost">
                <Card className="p-4">
                  <ActionForm action={saveBulkTransactionsAction} className="flex flex-col gap-4" resetOnSuccess>
                    <input type="hidden" name="type" value="EXPENSE" />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Date *" hint="Applies to every line below">
                        <input type="date" name="date" required defaultValue={dateVal(now)} className="input" />
                      </Field>
                      <Field label="Sub category *">
                        <input name="category" required className="input" list="bulk-cat-opts" placeholder="Equipment" />
                        <datalist id="bulk-cat-opts">{allCategories.map((c) => <option key={c} value={c} />)}</datalist>
                      </Field>
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

            <details className="lg:col-span-2">
              <summary className="cursor-pointer py-3 font-semibold">Who funded the farm — lifetime totals</summary>
              <Section
                title="Investment by payer"
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
                              <Link href={`/finance?paidBy=${encodeURIComponent(r.payer ?? NO_PAYER)}`} className="text-brand hover:underline">
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
            </details>
          </div>
        </>
      )}
    </>
  );
}
