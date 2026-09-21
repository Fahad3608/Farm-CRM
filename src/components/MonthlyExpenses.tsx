import Link from "next/link";
import { Empty, Section } from "./ui";
import { money } from "@/lib/format";
import { EXPENSE_GROUP_LABELS, monthlyExpenseHref, type ExpenseMonth } from "@/lib/monthlyExpenses";

export default function MonthlyExpenses({ months, currency, params }: {
  months: ExpenseMonth[]; currency: string; params: URLSearchParams;
}) {
  return (
    <Section title="Monthly expenses" subtitle="Where the money went, month by month" action={
      <Link href="/settings#expense-groups" className="btn-ghost btn-sm">Manage categories</Link>
    }>
      <p className="border-b border-line px-4 py-3 text-[13px] text-muted">
        Matches your filters. Operational costs cover day-to-day operations; equipment, construction and animal purchases are shown separately.
        Dates follow the ledger entry, so a partial month includes only the selected days.
      </p>
      {months.length === 0 ? <Empty title="No expenses match these filters" hint="Choose a wider date range or include expenses in the type filter." /> : (
        <div className="divide-y divide-line">
          {months.map((month, index) => (
            <details key={month.key} open={index === 0} className="group/month">
              <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3 px-4 py-4 hover:bg-surface2">
                <span className="font-semibold">{new Date(`${month.key}-01T12:00:00Z`).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" })}</span>
                <span className="flex items-center gap-3"><span className="font-semibold tabular-nums">{money(month.total, currency)}</span><span className="text-muted group-open/month:rotate-180" aria-hidden>⌄</span></span>
              </summary>
              <div className="grid gap-3 px-4 pb-4 sm:grid-cols-2">
                {month.groups.map((group) => (
                  <div key={group.name} className="rounded-xl border border-line p-3">
                    <div className="mb-2 flex flex-wrap justify-between gap-2 text-[14px] font-semibold">
                      <h3>{EXPENSE_GROUP_LABELS[group.name] ?? group.name}</h3>
                      <span className="tabular-nums">{money(group.total, currency)}</span>
                    </div>
                    {group.name === "Other" && <p className="mb-2 text-[12px] text-muted">Review these categories if their purpose is known.</p>}
                    <ul className="divide-y divide-line">
                      {group.categories.map((category) => (
                        <li key={category.name}>
                          <Link href={monthlyExpenseHref(params, month.key, category.name)} className="flex items-start justify-between gap-3 py-2 text-[13px] hover:text-brand">
                            <span>{category.name}<span className="block text-[12px] text-muted">{category.count} {category.count === 1 ? "entry" : "entries"}</span></span>
                            <span className="shrink-0 tabular-nums">{money(category.total, currency)} →</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <div className="px-4 pb-4"><Link href={monthlyExpenseHref(params, month.key)} className="text-[13px] font-medium text-brand hover:underline">View this month’s expense entries →</Link></div>
            </details>
          ))}
        </div>
      )}
    </Section>
  );
}
