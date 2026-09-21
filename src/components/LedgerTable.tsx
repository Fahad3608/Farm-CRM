"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Avatar, Badge } from "./ui";
import ConfirmSubmit from "./ConfirmSubmit";
import { Icon } from "./icons";
import { SPECIES } from "@/lib/domain";
import { fmtDate, money } from "@/lib/format";

export type LedgerRow = {
  id: string;
  date: string;
  category: string;
  description: string | null;
  vendor: string | null;
  type: "INCOME" | "EXPENSE";
  amount: string;
  isAuto: boolean;
  animal: { id: string; name: string; species: keyof typeof SPECIES; profilePhotoId: string | null } | null;
  animalLabel: string | null;
  usdText: string | null;
};

/**
 * The ledger table plus a checkbox on every deletable row, so you can pick
 * any arbitrary mix of entries (not just "everything matching this filter")
 * and delete them together in one confirm.
 */
export default function LedgerTable({
  rows, currency, deleteOne, deleteSelected,
}: {
  rows: LedgerRow[];
  currency: string;
  deleteOne: (fd: FormData) => Promise<void>;
  deleteSelected: (fd: FormData) => Promise<void>;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const selectableIds = rows.filter((r) => !r.isAuto).map((r) => r.id);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected((s) => (s.size === selectableIds.length ? new Set() : new Set(selectableIds)));

  function handleDeleteSelected() {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} selected transaction${selected.size === 1 ? "" : "s"}? This cannot be undone.`)) return;
    const fd = new FormData();
    selected.forEach((id) => fd.append("ids", id));
    startTransition(async () => {
      await deleteSelected(fd);
      setSelected(new Set());
    });
  }

  return (
    <>
      {selected.size > 0 && (
        <div className="flex items-center justify-between gap-3 border-b border-line bg-surface2/60 px-4 py-2.5">
          <span className="text-[13px] text-muted">{selected.size} selected</span>
          <button type="button" onClick={handleDeleteSelected} disabled={isPending} className="btn-danger btn-sm">
            {isPending ? "Deleting…" : "Delete selected"}
          </button>
        </div>
      )}
      <div className="scroll-x">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr>
              <th className="th w-8">
                {selectableIds.length > 0 && (
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="h-4 w-4 accent-[rgb(var(--brand))]"
                    aria-label="Select all"
                  />
                )}
              </th>
              <th className="th">Date</th><th className="th">Category</th><th className="th">Description</th>
              <th className="th">Animal</th><th className="th">Vendor</th><th className="th text-right">Amount</th><th className="th"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id} className="row">
                <td className="td">
                  {!t.isAuto && (
                    <input
                      type="checkbox"
                      checked={selected.has(t.id)}
                      onChange={() => toggle(t.id)}
                      className="h-4 w-4 accent-[rgb(var(--brand))]"
                      aria-label="Select transaction"
                    />
                  )}
                </td>
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
                  {t.type === "INCOME" ? "+" : "−"}{money(t.amount, currency)}
                  {t.usdText && <div className="text-[11px] font-normal text-muted">{t.usdText}</div>}
                </td>
                <td className="td text-right">
                  {t.isAuto ? (
                    <span className="text-[11.5px] text-muted" title="Created from a health or feed record">auto</span>
                  ) : (
                    <form action={deleteOne}>
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
    </>
  );
}
