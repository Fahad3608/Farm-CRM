import { categoryGroupOf, CATEGORY_GROUPS } from "./domain";

export const EXPENSE_GROUP_LABELS: Record<string, string> = {
  Operational: "Running costs",
  "Capital & Construction": "Equipment & construction",
  "Animal Purchases": "Animal purchases",
  Other: "Other / review",
};

type Entry = { date: Date; type: string; category: string; amount: { toString(): string } };
export type ExpenseMonth = {
  key: string;
  total: number;
  groups: { name: string; total: number; categories: { name: string; total: number; count: number }[] }[];
};

/** Use ledger dates in UTC and sum minor units so category totals reconcile. */
export function monthlyExpenses(entries: Entry[], assigned: Map<string, string>): ExpenseMonth[] {
  const months = new Map<string, Map<string, Map<string, { cents: number; count: number }>>>();
  for (const entry of entries) {
    if (entry.type !== "EXPENSE") continue;
    const key = entry.date.toISOString().slice(0, 7);
    const group = categoryGroupOf(entry.category, assigned);
    const groups = months.get(key) ?? new Map();
    const categories = groups.get(group) ?? new Map();
    const value = categories.get(entry.category) ?? { cents: 0, count: 0 };
    value.cents += Math.round(Number(entry.amount.toString()) * 100);
    value.count += 1;
    categories.set(entry.category, value);
    groups.set(group, categories);
    months.set(key, groups);
  }
  return [...months].sort(([a], [b]) => b.localeCompare(a)).map(([key, groups]) => {
    const rows = [...groups].map(([name, categories]) => ({
      name,
      total: [...categories.values()].reduce((sum, c) => sum + c.cents, 0) / 100,
      categories: [...categories].map(([name, c]) => ({ name, total: c.cents / 100, count: c.count }))
        .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name)),
    })).sort((a, b) => CATEGORY_GROUPS.indexOf(a.name as typeof CATEGORY_GROUPS[number]) - CATEGORY_GROUPS.indexOf(b.name as typeof CATEGORY_GROUPS[number]));
    return { key, total: rows.reduce((sum, g) => sum + Math.round(g.total * 100), 0) / 100, groups: rows };
  });
}

/** Drill-downs keep the selected payer and intersect the month with the date range. */
export function monthlyExpenseHref(params: URLSearchParams, month: string, category?: string): string {
  const q = new URLSearchParams(params);
  const first = `${month}-01`;
  const [year, monthNumber] = month.split("-").map(Number);
  const last = new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
  q.set("from", q.get("from") && q.get("from")! > first ? q.get("from")! : first);
  q.set("to", q.get("to") && q.get("to")! < last ? q.get("to")! : last);
  q.set("type", "EXPENSE");
  q.delete("page");
  if (category !== undefined) {
    q.delete("category");
    q.set("category", category);
  }
  return `/finance?${q.toString()}#ledger`;
}
