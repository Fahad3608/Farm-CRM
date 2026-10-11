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
import { EXPENSE_CATEGORIES, EXPENSE_GROUP_LABELS, NO_PAYER, CATEGORY_GROUPS, categoryGroupOf } from "@/lib/domain";
import { fmtDate, money } from "@/lib/format";

export const dynamic = "force-dynamic";

type Search = {
  from?: string; to?: string; paidBy?: string;
  /** Drill state: a month (YYYY-MM), then a main category, then a sub-category. */
  month?: string; main?: string; sub?: string;
};

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

  // Dates are stored at midday to stay timezone-stable, so the range ends at
  // the end of the day — otherwise today's entries fall outside "up to today".
  const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  const from = sp.from ? new Date(`${sp.from}T00:00:00`) : new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const to = sp.to ? new Date(`${sp.to}T23:59:59`) : endOfDay(now);

  const payerFilter = sp.paidBy ?? "";
  const paidByWhere =
    payerFilter === NO_PAYER ? { paidBy: null } : payerFilter ? { paidBy: payerFilter } : {};

  const monthKey = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : "";
  const mainKey = sp.main?.trim() || "";
  const subKey = sp.sub?.trim() || "";

  const [dbCategories, dbPayers, usedCategories, animals, lifetime] = await Promise.all([
    prisma.category.findMany({ where: { type: "EXPENSE" }, orderBy: { name: "asc" } }),
    prisma.payer.findMany({ orderBy: { name: "asc" } }),
    prisma.transaction.findMany({ where: { type: "EXPENSE" }, select: { category: true }, distinct: ["category"] }),
    prisma.animal.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true, tagId: true }, orderBy: { tagId: "asc" } }),
    prisma.transaction.aggregate({ where: { type: "EXPENSE", ...paidByWhere }, _sum: { amount: true } }),
  ]);

  const assignedGroups = new Map(dbCategories.filter((c) => c.group).map((c) => [c.name, c.group!]));
  const allCategories = [...new Set([
    ...EXPENSE_CATEGORIES,
    ...dbCategories.map((c) => c.name),
    ...usedCategories.map((c) => c.category),
  ])].sort();
  const mainOf = (category: string) => categoryGroupOf(category, assignedGroups);

  // Drilling into a month intersects it with the active date range, so a
  // month's total here always matches the figure the months list showed.
  let scopeFrom = from;
  let scopeTo = to;
  if (monthKey) {
    const [y, m] = monthKey.split("-").map(Number);
    const monthStart = new Date(y, m - 1, 1, 0, 0, 0, 0);
    const monthEnd = new Date(y, m, 0, 23, 59, 59, 999);
    scopeFrom = monthStart > from ? monthStart : from;
    scopeTo = monthEnd < to ? monthEnd : to;
  }

  // A main category is "every sub-category in this group", since the grouping
  // lives in app config rather than on the row itself.
  const subsOfMain = mainKey ? allCategories.filter((c) => mainOf(c) === mainKey) : [];
  const categoryWhere = subKey
    ? { category: subKey }
    : mainKey
    ? { category: { in: subsOfMain } }
    : {};

  const where = {
    type: "EXPENSE" as const,
    date: { gte: scopeFrom, lte: scopeTo },
    ...paidByWhere,
    ...categoryWhere,
  };

  const [entries, scopeTotal] = await Promise.all([
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

  const total = Number(scopeTotal._sum.amount ?? 0);
  const count = scopeTotal._count;
  const lifetimeTotal = Number(lifetime._sum.amount ?? 0);

  const allPayers = [...new Set([
    ...dbPayers.map((p) => p.name),
    ...(await prisma.transaction.findMany({ where: { type: "EXPENSE", paidBy: { not: null } }, select: { paidBy: true }, distinct: ["paidBy"] }))
      .map((r) => r.paidBy!)
      .filter(Boolean),
  ])].sort();

  // Keeps the filters (and anything shallower in the drill) while changing level.
  const href = (next: Partial<Record<"month" | "main" | "sub", string>>) => {
    const q = new URLSearchParams();
    if (sp.from) q.set("from", sp.from);
    if (sp.to) q.set("to", sp.to);
    if (payerFilter) q.set("paidBy", payerFilter);
    for (const [k, v] of Object.entries(next)) if (v) q.set(k, v);
    const s = q.toString();
    return s ? `/finance?${s}` : "/finance";
  };

  const level: "months" | "mains" | "subs" | "ledger" =
    subKey ? "ledger" : mainKey ? "subs" : monthKey ? "mains" : "months";

  // Roll the scoped entries up whichever way this level needs.
  const byMonth = new Map<string, { total: number; count: number }>();
  const byMain = new Map<string, { total: number; count: number; subs: Set<string> }>();
  const bySub = new Map<string, { total: number; count: number; main: string }>();
  for (const t of entries) {
    const amount = Number(t.amount);
    const mk = t.date.toISOString().slice(0, 7);
    const m = byMonth.get(mk) ?? { total: 0, count: 0 };
    m.total += amount; m.count += 1; byMonth.set(mk, m);

    const main = mainOf(t.category);
    const g = byMain.get(main) ?? { total: 0, count: 0, subs: new Set<string>() };
    g.total += amount; g.count += 1; g.subs.add(t.category); byMain.set(main, g);

    const s = bySub.get(t.category) ?? { total: 0, count: 0, main };
    s.total += amount; s.count += 1; bySub.set(t.category, s);
  }
  const monthRows = [...byMonth].sort(([a], [b]) => b.localeCompare(a));
  const mainRows = [...byMain].sort(
    ([a], [b]) => CATEGORY_GROUPS.indexOf(a as never) - CATEGORY_GROUPS.indexOf(b as never),
  );
  const subRows = [...bySub].sort((a, b) => b[1].total - a[1].total);

  const dateVal = (d: Date) => d.toISOString().slice(0, 10);
  const pct = (part: number) => (total > 0 ? `${Math.round((part / total) * 100)}%` : "—");

  // The largest thing on screen, by amount rather than by the canonical group
  // order the lists are sorted in. At the ledger that's a single entry.
  const biggest = (level === "mains" ? mainRows.map(([n, r]) => [mainLabel(n), r.total] as const)
    : level === "subs" ? subRows.map(([n, r]) => [n, r.total] as const)
    : entries.map((t) => [t.description ?? t.category, Number(t.amount)] as const))
    .reduce<readonly [string, number] | null>((best, row) => (!best || row[1] > best[1] ? row : best), null);

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
    ...(monthKey ? [{ label: monthLabel(monthKey), go: href({ month: monthKey }), here: level === "mains" }] : []),
    ...(mainKey ? [{ label: mainLabel(mainKey), go: href({ month: monthKey, main: mainKey }), here: level === "subs" }] : []),
    ...(subKey ? [{ label: subKey, go: href({ month: monthKey, main: mainKey, sub: subKey }), here: true }] : []),
  ];

  const title =
    level === "ledger" ? subKey
    : level === "subs" ? mainLabel(mainKey)
    : level === "mains" ? monthLabel(monthKey)
    : "Expenses";

  const subtitle =
    level === "months"
      ? `${fmtDate(from)} — ${fmtDate(to)} · pick a month to drill in`
      : level === "mains"
      ? "Main categories this month — pick one to see its sub-categories"
      : level === "subs"
      ? `Sub-categories${monthKey ? ` in ${monthLabel(monthKey)}` : ""} — pick one to see its entries`
      : `${count} ${count === 1 ? "entry" : "entries"}${monthKey ? ` in ${monthLabel(monthKey)}` : ""}`;

  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/finance/categories" className="btn-ghost btn-sm">Spend by category</Link>
            <Link href="/equipment" className="btn-ghost btn-sm">Equipment</Link>
          </div>
        }
      />

      {crumbs.length > 1 && (
        <nav aria-label="Breadcrumb" className="mb-3 flex flex-wrap items-center gap-1.5 text-[13px]">
          {crumbs.map((c, i) => (
            <span key={c.go} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-muted" aria-hidden>›</span>}
              {c.here ? (
                <span className="font-medium">{c.label}</span>
              ) : (
                <Link href={c.go} className="text-brand hover:underline">{c.label}</Link>
              )}
            </span>
          ))}
        </nav>
      )}

      {level === "months" && (
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
          {(sp.from || sp.to || payerFilter) && <Link href="/finance" className="btn-ghost btn-sm">Reset</Link>}
        </form>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label={level === "months" ? "Total in this period" : "Total here"}
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
            label={level === "ledger" ? "Largest entry" : "Biggest share"}
            value={biggest ? (level === "ledger" ? money(biggest[1], settings.currency) : pct(biggest[1])) : "—"}
            hint={biggest ? biggest[0] : "Nothing recorded"}
          />
        )}
        {level === "months" ? (
          <StatTile
            label="Average per month"
            value={money(total / (monthRows.length || 1), settings.currency)}
            hint="Across the months shown"
          />
        ) : (
          <StatTile
            label="Average per entry"
            value={money(total / (count || 1), settings.currency)}
            hint={`Over ${count} ${count === 1 ? "entry" : "entries"}`}
          />
        )}
      </div>

      {level === "months" && (
        <Section title="Month by month" subtitle="Newest first — tap a month for its categories">
          {monthRows.length === 0 ? (
            <Empty icon="🧾" title="No expenses in this period" hint="Widen the date range or add an entry below." />
          ) : (
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
                      <span className="block text-[12px] text-muted">{pct(m.total)} of period →</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {monthRows.length > 0 && (
            <div className="flex items-center justify-between gap-3 border-t-2 border-line px-4 py-3">
              <span className="font-semibold">Total</span>
              <span className="tabular-nums font-semibold">{money(total, settings.currency)}</span>
            </div>
          )}
        </Section>
      )}

      {level === "mains" && (
        <Section title="Main categories" subtitle={`${monthLabel(monthKey)} — tap one to see its sub-categories`}>
          {mainRows.length === 0 ? (
            <Empty icon="📊" title="Nothing recorded this month" />
          ) : (
            <>
              <ul className="divide-y divide-line">
                {mainRows.map(([name, m]) => (
                  <li key={name}>
                    <Link href={href({ month: monthKey, main: name })} className="flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-surface2/60">
                      <span className="min-w-0">
                        <span className="truncate text-[15px] font-medium">{mainLabel(name)}</span>
                        <span className="block text-[12.5px] text-muted">
                          {m.subs.size} {m.subs.size === 1 ? "sub-category" : "sub-categories"} · {m.count} {m.count === 1 ? "entry" : "entries"}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block tabular-nums font-semibold">{money(m.total, settings.currency)}</span>
                        <span className="block text-[12px] text-muted">{pct(m.total)} of month →</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between gap-3 border-t-2 border-line px-4 py-3">
                <span className="font-semibold">{monthLabel(monthKey)} total</span>
                <span className="tabular-nums font-semibold">{money(total, settings.currency)}</span>
              </div>
            </>
          )}
        </Section>
      )}

      {level === "subs" && (
        <Section
          title="Sub-categories"
          subtitle={`${mainLabel(mainKey)}${monthKey ? ` · ${monthLabel(monthKey)}` : ""} — biggest first`}
        >
          {subRows.length === 0 ? (
            <Empty icon="🏷️" title="Nothing recorded under this main category" />
          ) : (
            <>
              <ul className="divide-y divide-line">
                {subRows.map(([name, s]) => (
                  <li key={name}>
                    <Link href={href({ month: monthKey, main: mainKey, sub: name })} className="flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-surface2/60">
                      <span className="min-w-0">
                        <span className="truncate text-[15px] font-medium">{name}</span>
                        <span className="block text-[12.5px] text-muted">{s.count} {s.count === 1 ? "entry" : "entries"}</span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block tabular-nums font-semibold">{money(s.total, settings.currency)}</span>
                        <span className="block text-[12px] text-muted">{pct(s.total)} →</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between gap-3 border-t-2 border-line px-4 py-3">
                <span className="font-semibold">{mainLabel(mainKey)} total</span>
                <span className="tabular-nums font-semibold">{money(total, settings.currency)}</span>
              </div>
            </>
          )}
        </Section>
      )}

      {level === "ledger" && (
        <Section title="Ledger" subtitle={`${subKey}${monthKey ? ` · ${monthLabel(monthKey)}` : ""} · newest first`}>
          {ledgerRows.length === 0 ? (
            <Empty icon="🧾" title="No entries here" />
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
      )}

      {level !== "ledger" && (
        <Section title="Entries" subtitle={`${count} ${count === 1 ? "entry" : "entries"} at this level · newest first`} className="mt-4">
          {entries.length === 0 ? (
            <Empty icon="🧾" title="Nothing to show" />
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
                  {entries.slice(0, 50).map((t) => (
                    <tr key={t.id} className="row">
                      <td className="td whitespace-nowrap">{fmtDate(t.date)}</td>
                      <td className="td">{t.description ?? "—"}</td>
                      <td className="td">{t.category}</td>
                      <td className="td text-muted">{mainLabel(mainOf(t.category))}</td>
                      <td className="td">{t.paidBy ?? <span className="text-muted">—</span>}</td>
                      <td className="td text-right tabular-nums font-semibold">{money(t.amount, settings.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {entries.length > 50 && (
                <p className="border-t border-line px-4 py-2.5 text-[12.5px] text-muted">
                  Showing the 50 most recent of {entries.length}. Drill into a category to see all of them.
                </p>
              )}
            </div>
          )}
        </Section>
      )}

      <div className="mt-4 grid gap-3">
        <Disclosure label="Add expense">
          <Card className="p-4">
            <ActionForm action={saveTransactionAction} className="grid gap-4 sm:grid-cols-2" resetOnSuccess>
              <input type="hidden" name="type" value="EXPENSE" />
              <Field label="Date *"><input type="date" name="date" required defaultValue={dateVal(now)} className="input" /></Field>
              <Field label="Sub category *" hint="Its main category follows from Settings">
                <input name="category" required className="input" list="cat-opts" defaultValue={subKey} placeholder="Feeding Cost" />
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

        <Disclosure label="Add multiple expenses" tone="ghost">
          <Card className="p-4">
            <ActionForm action={saveBulkTransactionsAction} className="flex flex-col gap-4" resetOnSuccess>
              <input type="hidden" name="type" value="EXPENSE" />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Date *" hint="Applies to every line below">
                  <input type="date" name="date" required defaultValue={dateVal(now)} className="input" />
                </Field>
                <Field label="Sub category *">
                  <input name="category" required className="input" list="bulk-cat-opts" defaultValue={subKey} placeholder="Equipment" />
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
    </>
  );
}
