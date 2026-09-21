import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getSettings } from "@/lib/settings";
import { Badge, Card, Empty, Field, PageHeader, Section, StatTile } from "@/components/ui";
import Disclosure from "@/components/Disclosure";
import ActionForm, { SubmitButton } from "@/components/ActionForm";
import ConfirmSubmit from "@/components/ConfirmSubmit";
import { BarList, IncomeExpenseChart } from "@/components/charts";
import { deleteFilteredTransactionsAction, deleteSelectedTransactionsAction, deleteTransactionAction, linkTransactionAnimalAction, markNotAnimalSpecificAction, saveBulkTransactionsAction, saveTransactionAction } from "@/app/actions/finance";
import LedgerTable, { type LedgerRow } from "@/components/LedgerTable";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/domain";
import { fmtDate, money } from "@/lib/format";
import { historicalRates, isoDate } from "@/lib/fx";

export const dynamic = "force-dynamic";

type Search = { from?: string; to?: string; type?: string; category?: string; page?: string; fx?: string };

const PER_PAGE = 50;

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

  const where = {
    date: { gte: from, lte: to },
    ...(sp.type && sp.type !== "ALL" ? { type: sp.type as never } : {}),
    ...(sp.category && sp.category !== "ALL" ? { category: sp.category } : {}),
  };

  const page = Math.max(1, Number(sp.page ?? 1) || 1);

  const needsReviewWhere = { type: "EXPENSE" as const, animalId: null, feedLogId: null, notAnimalSpecific: false };
  const [txns, txnCount, deletableCount, totals, byCategory, animals, perAnimal, needsReview, needsReviewCount] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: { date: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      include: { animal: { select: { id: true, name: true, tagId: true, species: true, profilePhotoId: true } } },
    }),
    prisma.transaction.count({ where }),
    prisma.transaction.count({ where: { ...where, healthRecordId: null, feedLogId: null } }),
    prisma.transaction.groupBy({ by: ["type"], where: { date: { gte: from, lte: to } }, _sum: { amount: true } }),
    prisma.transaction.groupBy({ by: ["type", "category"], where: { date: { gte: from, lte: to } }, _sum: { amount: true } }),
    prisma.animal.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true, tagId: true }, orderBy: { tagId: "asc" } }),
    prisma.transaction.groupBy({
      by: ["animalId"],
      where: { date: { gte: from, lte: to }, type: "EXPENSE", animalId: { not: null } },
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
      take: 12,
    }),
    prisma.transaction.findMany({
      where: needsReviewWhere,
      orderBy: { date: "desc" },
      take: 20,
    }),
    prisma.transaction.count({ where: needsReviewWhere }),
  ]);

  const income = Number(totals.find((t) => t.type === "INCOME")?._sum.amount ?? 0);
  const expense = Number(totals.find((t) => t.type === "EXPENSE")?._sum.amount ?? 0);

  const animalNames = new Map(
    (await prisma.animal.findMany({
      where: { id: { in: perAnimal.map((p) => p.animalId!).filter(Boolean) } },
      select: { id: true, name: true, tagId: true },
    })).map((a) => [a.id, a])
  );

  // One bucket per month across the whole selected range. Only the most recent
  // twelve are charted, so a wide range still shows current activity instead of
  // its oldest — and never an empty chart.
  const MAX_BARS = 12;
  const buckets: { key: string; month: string; income: number; expense: number }[] = [];
  const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
  const lastMonth = new Date(to.getFullYear(), to.getMonth(), 1);
  while (cursor <= lastMonth && buckets.length < 1200) {
    buckets.push({
      key: `${cursor.getFullYear()}-${cursor.getMonth()}`,
      month: cursor.toLocaleDateString(undefined, { month: "short", year: "2-digit" }),
      income: 0, expense: 0,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  const bucketByKey = new Map(buckets.map((b) => [b.key, b]));
  const allInRange = await prisma.transaction.findMany({ where: { date: { gte: from, lte: to } }, select: { date: true, type: true, amount: true } });
  for (const t of allInRange) {
    const d = new Date(t.date);
    const b = bucketByKey.get(`${d.getFullYear()}-${d.getMonth()}`);
    if (b) b[t.type === "INCOME" ? "income" : "expense"] += Number(t.amount);
  }
  const chartBuckets = buckets.slice(-MAX_BARS);
  const chartSubtitle =
    buckets.length > MAX_BARS ? `Most recent ${MAX_BARS} months of the selected range` : "By month";

  const dateVal = (d: Date) => d.toISOString().slice(0, 10);

  const lastPage = Math.max(1, Math.ceil(txnCount / PER_PAGE));
  const pageInfo = txnCount
    ? `Showing ${(page - 1) * PER_PAGE + 1}–${Math.min(page * PER_PAGE, txnCount)} of ${txnCount}`
    : "No entries";
  const pageHref = (n: number) => {
    const q = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]);
    q.set("page", String(n));
    return `/finance?${q.toString()}`;
  };

  // Each row converts at the exchange rate on ITS OWN date, not today's rate —
  // so a transaction from six months ago shows what it was worth back then.
  const canShowUsd = settings.currency.toUpperCase() !== "USD";
  const showUsd = canShowUsd && sp.fx === "usd";
  const usdRates = showUsd ? await historicalRates(settings.currency, "USD", txns.map((t) => t.date)) : null;
  const fxToggleHref = () => {
    const q = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]);
    if (showUsd) q.delete("fx"); else q.set("fx", "usd");
    return `/finance?${q.toString()}`;
  };

  const ledgerRows: LedgerRow[] = txns.map((t) => {
    const rate = showUsd ? usdRates?.get(isoDate(t.date)) : undefined;
    return {
      id: t.id,
      date: t.date.toISOString(),
      category: t.category,
      description: t.description,
      vendor: t.vendor,
      type: t.type,
      amount: t.amount.toString(),
      isAuto: Boolean(t.healthRecordId || t.feedLogId),
      animal: t.animal,
      animalLabel: t.animalLabel,
      usdText: showUsd ? (rate ? `≈ ${money(Number(t.amount) * rate, "USD")} on ${fmtDate(t.date)}` : "USD rate unavailable") : null,
    };
  });

  return (
    <>
      <PageHeader title="Finances" subtitle={`${fmtDate(from)} — ${fmtDate(to)}`} />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Income" value={money(income, settings.currency)} tone="good" />
        <StatTile label="Expenses" value={money(expense, settings.currency)} tone="bad" />
        <StatTile label="Net" value={money(income - expense, settings.currency)} tone={income - expense >= 0 ? "good" : "bad"} />
        <StatTile label="Entries" value={txnCount} hint="Matching your filters" />
      </div>

      {needsReviewCount > 0 && (
        <div className="mb-4">
          <Section
            title="Needs review"
            subtitle={`${needsReviewCount} expense${needsReviewCount === 1 ? "" : "s"} with no animal — link ${needsReviewCount === 1 ? "it" : "them"} or mark as farm-wide, so cost-per-animal stays accurate`}
          >
            <ul>
              {needsReview.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 first:border-t-0">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge>{t.category}</Badge>
                      <span className="text-[13.5px]">{t.description ?? "—"}</span>
                    </div>
                    <div className="mt-0.5 text-[12.5px] text-muted">
                      {fmtDate(t.date)} · <span className="font-semibold text-bad">{money(t.amount, settings.currency)}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
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
                      <button className="btn-ghost btn-sm" title="This is a general farm cost, not tied to one animal">Farm-wide</button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
            {needsReviewCount > needsReview.length && (
              <p className="border-t border-line px-4 py-2.5 text-[12.5px] text-muted">
                Showing the most recent {needsReview.length} of {needsReviewCount}.
              </p>
            )}
          </Section>
        </div>
      )}

      <div className="mb-4">
        <Disclosure label="Add transaction">
          <Card className="p-4">
            <ActionForm action={saveTransactionAction} className="grid gap-4 sm:grid-cols-2" resetOnSuccess>
              <Field label="Type">
                <select name="type" className="input"><option value="EXPENSE">Expense</option><option value="INCOME">Income</option></select>
              </Field>
              <Field label="Date *"><input type="date" name="date" required defaultValue={dateVal(now)} className="input" /></Field>
              <Field label="Category *">
                <input name="category" required className="input" list="cat-opts" placeholder="Feed" />
                <datalist id="cat-opts">{[...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES].map((c) => <option key={c} value={c} />)}</datalist>
              </Field>
              <Field label={`Amount (${settings.currency}) *`}><input name="amount" required inputMode="decimal" className="input" placeholder="0" /></Field>
              <Field label="Description" className="sm:col-span-2"><input name="description" className="input" /></Field>
              <Field label="Linked animal" hint="Optional — lets you see cost per animal">
                <select name="animalId" className="input">
                  <option value="">— Not animal-specific —</option>
                  {animals.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.tagId})</option>)}
                </select>
              </Field>
              <Field label="Vendor / paid to"><input name="vendor" className="input" /></Field>
              <Field label="Payment method">
                <input name="paymentMethod" className="input" list="pay-opts" />
                <datalist id="pay-opts"><option value="Cash" /><option value="Bank transfer" /><option value="Mobile wallet" /><option value="Cheque" /><option value="Credit" /></datalist>
              </Field>
              <Field label="Reference / receipt no."><input name="reference" className="input" /></Field>
              <div className="sm:col-span-2"><SubmitButton>Save transaction</SubmitButton></div>
            </ActionForm>
          </Card>
        </Disclosure>
      </div>

      <div className="mb-4">
        <Disclosure label="Add multiple expenses" tone="ghost">
          <Card className="p-4">
            <ActionForm action={saveBulkTransactionsAction} className="flex flex-col gap-4" resetOnSuccess>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Type">
                  <select name="type" className="input"><option value="EXPENSE">Expense</option><option value="INCOME">Income</option></select>
                </Field>
                <Field label="Date *" hint="Applies to every line below">
                  <input type="date" name="date" required defaultValue={dateVal(now)} className="input" />
                </Field>
                <Field label="Category *" className="sm:col-span-2">
                  <input name="category" required className="input" list="bulk-cat-opts" placeholder="Startup Cost" />
                  <datalist id="bulk-cat-opts">{[...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES, "Startup Cost"].map((c) => <option key={c} value={c} />)}</datalist>
                </Field>
                <Field label="Linked animal" className="sm:col-span-2" hint="Leave as farm-wide unless every line below is one animal's cost">
                  <select name="animalId" className="input">
                    <option value="">— Farm-wide (not one animal) —</option>
                    {animals.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.tagId})</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Expenses — one per line, as: description, amount" hint='e.g. "Gate 8 foot, 22500"'>
                <textarea name="lines" required rows={10} className="input resize-y font-mono text-[13px]" placeholder={"Gate 8 foot, 22500\nPipe 100 foot, 5300"} />
              </Field>
              <div><SubmitButton>Save all</SubmitButton></div>
            </ActionForm>
          </Card>
        </Disclosure>
      </div>

      <form className="mb-4 flex flex-wrap items-end gap-2" action="/finance">
        <Field label="From"><input type="date" name="from" defaultValue={dateVal(from)} className="input w-auto" /></Field>
        <Field label="To"><input type="date" name="to" defaultValue={dateVal(to)} className="input w-auto" /></Field>
        <Field label="Type">
          <select name="type" defaultValue={sp.type ?? "ALL"} className="input w-auto">
            <option value="ALL">All</option><option value="INCOME">Income</option><option value="EXPENSE">Expense</option>
          </select>
        </Field>
        <Field label="Category">
          <select name="category" defaultValue={sp.category ?? "ALL"} className="input w-auto">
            <option value="ALL">All categories</option>
            {[...new Set(byCategory.map((c) => c.category))].sort().map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <button className="btn-ghost">Apply</button>
      </form>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Section title="Income vs expenses" subtitle={chartSubtitle} className="lg:col-span-2">
          <IncomeExpenseChart data={chartBuckets} currency={settings.currency} />
        </Section>

        <Section title="Expenses by category">
          <BarList
            items={byCategory.filter((c) => c.type === "EXPENSE")
              .map((c) => ({ label: c.category, value: Number(c._sum.amount ?? 0), display: money(c._sum.amount, settings.currency) }))
              .sort((a, b) => b.value - a.value)}
            accent="b"
            emptyText="No expenses in this period."
          />
        </Section>

        <Section title="Income by category">
          <BarList
            items={byCategory.filter((c) => c.type === "INCOME")
              .map((c) => ({ label: c.category, value: Number(c._sum.amount ?? 0), display: money(c._sum.amount, settings.currency) }))
              .sort((a, b) => b.value - a.value)}
            accent="a"
            emptyText="No income in this period."
          />
        </Section>

        <Section title="Cost per animal" subtitle="Highest spend in this period" className="lg:col-span-2">
          <BarList
            items={perAnimal.map((p) => {
              const a = animalNames.get(p.animalId!);
              return {
                label: a ? `${a.name} (${a.tagId})` : "Unknown",
                value: Number(p._sum.amount ?? 0),
                display: money(p._sum.amount, settings.currency),
              };
            })}
            emptyText="Link transactions, feed or health records to animals to see this."
          />
        </Section>

        <Section
          title="Ledger"
          subtitle={pageInfo}
          className="lg:col-span-2"
          action={
            <div className="flex items-center gap-2">
              {canShowUsd && (
                <Link href={fxToggleHref()} className="btn-ghost btn-sm">
                  {showUsd ? "Hide USD" : "Show USD"}
                </Link>
              )}
              {deletableCount > 0 && (
                <form action={deleteFilteredTransactionsAction}>
                  <input type="hidden" name="from" value={dateVal(from)} />
                  <input type="hidden" name="to" value={dateVal(to)} />
                  <input type="hidden" name="type" value={sp.type ?? "ALL"} />
                  <input type="hidden" name="category" value={sp.category ?? "ALL"} />
                  <ConfirmSubmit
                    message={`Delete ${deletableCount} transaction${deletableCount === 1 ? "" : "s"} (${fmtDate(from)} — ${fmtDate(to)}, category "${sp.category && sp.category !== "ALL" ? sp.category : "All categories"}")?${txnCount > deletableCount ? ` ${txnCount - deletableCount} auto-linked health/feed ${txnCount - deletableCount === 1 ? "entry" : "entries"} will be kept.` : ""} This cannot be undone.`}
                    className="btn-danger btn-sm"
                  >
                    Delete all {deletableCount} shown
                  </ConfirmSubmit>
                </form>
              )}
            </div>
          }
        >
          {ledgerRows.length === 0 ? (
            <Empty icon="🧾" title="No transactions in this period" />
          ) : (
            <LedgerTable
              rows={ledgerRows}
              currency={settings.currency}
              deleteOne={deleteTransactionAction}
              deleteSelected={deleteSelectedTransactionsAction}
            />
          )}

          {lastPage > 1 && (
            <nav className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-[13.5px]">
              {page > 1
                ? <Link href={pageHref(page - 1)} className="btn-ghost btn-sm">← Newer</Link>
                : <span />}
              <span className="text-muted">Page {page} of {lastPage}</span>
              {page < lastPage
                ? <Link href={pageHref(page + 1)} className="btn-ghost btn-sm">Older →</Link>
                : <span />}
            </nav>
          )}
        </Section>
      </div>
    </>
  );
}
