import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getSettings } from "@/lib/settings";
import { Avatar, Badge, Card, Empty, Field, PageHeader, Section, StatTile } from "@/components/ui";
import Disclosure from "@/components/Disclosure";
import ActionForm, { SubmitButton } from "@/components/ActionForm";
import ConfirmSubmit from "@/components/ConfirmSubmit";
import { BarList, IncomeExpenseChart } from "@/components/charts";
import { deleteTransactionAction, saveTransactionAction } from "@/app/actions/finance";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, SPECIES } from "@/lib/domain";
import { fmtDate, money } from "@/lib/format";
import { Icon } from "@/components/icons";

export const dynamic = "force-dynamic";

type Search = { from?: string; to?: string; type?: string; category?: string; page?: string };

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

  const [txns, txnCount, totals, byCategory, animals, perAnimal] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: { date: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      include: { animal: { select: { id: true, name: true, tagId: true, species: true, profilePhotoId: true } } },
    }),
    prisma.transaction.count({ where }),
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

  return (
    <>
      <PageHeader title="Finances" subtitle={`${fmtDate(from)} — ${fmtDate(to)}`} />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Income" value={money(income, settings.currency)} tone="good" />
        <StatTile label="Expenses" value={money(expense, settings.currency)} tone="bad" />
        <StatTile label="Net" value={money(income - expense, settings.currency)} tone={income - expense >= 0 ? "good" : "bad"} />
        <StatTile label="Entries" value={txnCount} hint="Matching your filters" />
      </div>

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

        <Section title="Ledger" subtitle={pageInfo} className="lg:col-span-2">
          {txns.length === 0 ? (
            <Empty icon="🧾" title="No transactions in this period" />
          ) : (
            <div className="scroll-x">
              <table className="w-full min-w-[760px]">
                <thead>
                  <tr>
                    <th className="th">Date</th><th className="th">Category</th><th className="th">Description</th>
                    <th className="th">Animal</th><th className="th">Vendor</th><th className="th text-right">Amount</th><th className="th"></th>
                  </tr>
                </thead>
                <tbody>
                  {txns.map((t) => (
                    <tr key={t.id} className="row">
                      <td className="td whitespace-nowrap">{fmtDate(t.date)}</td>
                      <td className="td">
                        <Badge tone={t.type === "INCOME" ? "good" : "muted"}>{t.category}</Badge>
                      </td>
                      <td className="td">{t.description ?? "—"}</td>
                      <td className="td">
                        {t.animal ? (
                          <Link href={`/animals/${t.animal.id}?tab=costs`} className="inline-flex items-center gap-1.5 text-brand hover:underline">
                            <Avatar photoId={t.animal.profilePhotoId} name={t.animal.name} size={22} emoji={SPECIES[t.animal.species].emoji} />
                            {t.animal.name}
                          </Link>
                        ) : t.animalLabel ? (
                          <span className="text-muted" title="This animal has been removed from the farm records">
                            {t.animalLabel} <span className="text-[11.5px]">(removed)</span>
                          </span>
                        ) : "—"}
                      </td>
                      <td className="td text-muted">{t.vendor ?? "—"}</td>
                      <td className={`td text-right font-semibold tabular-nums ${t.type === "INCOME" ? "text-good" : "text-bad"}`}>
                        {t.type === "INCOME" ? "+" : "−"}{money(t.amount, settings.currency)}
                      </td>
                      <td className="td text-right">
                        {t.healthRecordId || t.feedLogId ? (
                          <span className="text-[11.5px] text-muted" title="Created from a health or feed record">auto</span>
                        ) : (
                          <form action={deleteTransactionAction}>
                            <input type="hidden" name="id" value={t.id} />
                            <ConfirmSubmit message="Delete this transaction?" className="rounded-lg p-1.5 text-muted hover:text-bad">
                              <Icon.trash className="h-4 w-4" />
                            </ConfirmSubmit>
                          </form>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
