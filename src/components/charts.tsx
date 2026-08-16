"use client";

import { useState } from "react";

/* Palette validated with the dataviz palette validator (light + dark, all checks pass). */
const SERIES = {
  a: "var(--series-a)",
  b: "var(--series-b)",
};

function VizVars({ children }: { children: React.ReactNode }) {
  return (
    <div className="viz-root">
      {/* Both modes are selected, not flipped — the dark steps are chosen for the
          dark surface and validated against it as their own set. */}
      <style>{`
        .viz-root { --series-a:#2a78d6; --series-b:#eb6834; }
        @media (prefers-color-scheme: dark) {
          :root:not([data-theme="light"]) .viz-root { --series-a:#3987e5; --series-b:#d95926; }
        }
        :root[data-theme="dark"] .viz-root { --series-a:#3987e5; --series-b:#d95926; }
      `}</style>
      {children}
    </div>
  );
}

export type BarItem = { label: string; value: number; display?: string; href?: string; hint?: string };

/**
 * Horizontal magnitude bars. One series → no legend; every bar is direct-labelled.
 * Bars are thin, rounded at the data end, and anchored to a shared baseline.
 */
export function BarList({ items, accent = "brand", emptyText = "Nothing recorded yet." }: {
  items: BarItem[]; accent?: "brand" | "a" | "b"; emptyText?: string;
}) {
  if (!items.length) return <p className="px-4 py-8 text-center text-[13.5px] text-muted">{emptyText}</p>;
  const max = Math.max(...items.map((i) => Math.abs(i.value)), 1);
  const color = accent === "brand" ? "rgb(var(--brand))" : accent === "a" ? SERIES.a : SERIES.b;

  return (
    <VizVars>
      <ul className="flex flex-col gap-2.5 px-4 py-4">
        {items.map((item) => (
          <li key={item.label}>
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <span className="truncate text-[13.5px] text-ink">{item.label}</span>
              <span className="shrink-0 tabular-nums text-[13px] font-semibold text-ink">
                {item.display ?? item.value.toLocaleString()}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface2">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{ width: `${Math.max(2, (Math.abs(item.value) / max) * 100)}%`, background: color }}
                title={item.hint}
              />
            </div>
          </li>
        ))}
      </ul>
    </VizVars>
  );
}

export type MonthPoint = { month: string; income: number; expense: number };

/** Grouped bars: money in vs money out, one shared axis. Hover shows both values. */
export function IncomeExpenseChart({ data, currency }: { data: MonthPoint[]; currency: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...data.flatMap((d) => [d.income, d.expense]), 1);
  const fmt = (n: number) =>
    new Intl.NumberFormat(undefined, { notation: n >= 100000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(n);

  if (!data.some((d) => d.income || d.expense))
    return <p className="px-4 py-10 text-center text-[13.5px] text-muted">No transactions recorded yet.</p>;

  return (
    <VizVars>
      <div className="px-4 pb-4 pt-3">
        <div className="mb-3 flex items-center gap-4 text-[12.5px] text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES.a }} /> Income
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES.b }} /> Expense
          </span>
          <span className="ml-auto tabular-nums">{currency}</span>
        </div>

        <div className="relative flex h-44 items-end gap-1.5 border-b border-line">
          {data.map((d, i) => (
            <div
              key={d.month}
              className="group relative flex h-full flex-1 items-end justify-center gap-[2px]"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              tabIndex={0}
            >
              <div
                className="w-1/2 rounded-t transition-all"
                style={{ height: `${(d.income / max) * 100}%`, background: SERIES.a, minHeight: d.income ? 3 : 0 }}
              />
              <div
                className="w-1/2 rounded-t transition-all"
                style={{ height: `${(d.expense / max) * 100}%`, background: SERIES.b, minHeight: d.expense ? 3 : 0 }}
              />
              {hover === i && (
                <div className="pointer-events-none absolute bottom-full z-10 mb-2 w-max max-w-[190px] rounded-xl border border-line bg-surface px-3 py-2 text-[12.5px] shadow-lg">
                  <div className="mb-1 font-semibold">{d.month}</div>
                  <div className="flex items-center justify-between gap-4 tabular-nums">
                    <span className="text-muted">Income</span><span className="font-medium">{fmt(d.income)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 tabular-nums">
                    <span className="text-muted">Expense</span><span className="font-medium">{fmt(d.expense)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-4 border-t border-line pt-1 tabular-nums">
                    <span className="text-muted">Net</span>
                    <span className={`font-semibold ${d.income - d.expense >= 0 ? "text-good" : "text-bad"}`}>
                      {fmt(d.income - d.expense)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-2 flex gap-1.5">
          {data.map((d) => (
            <div key={d.month} className="flex-1 truncate text-center text-[11.5px] text-muted">
              {d.month.split(" ")[0]}
            </div>
          ))}
        </div>
      </div>
    </VizVars>
  );
}
