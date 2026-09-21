"use client";

import Link from "next/link";
import { Fragment, useState, useTransition } from "react";
import { Avatar, Badge, Field } from "./ui";
import ActionForm, { SubmitButton, type ActionState } from "./ActionForm";
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
  paymentMethod: string | null;
  reference: string | null;
  paidBy: string | null;
  type: "INCOME" | "EXPENSE";
  amount: string;
  isAuto: boolean;
  animal: { id: string; name: string; species: keyof typeof SPECIES; profilePhotoId: string | null } | null;
  animalLabel: string | null;
  usdText: string | null;
};

type AnimalOpt = { id: string; name: string; tagId: string };

/**
 * The ledger table: a checkbox on every deletable row for picking an
 * arbitrary mix to delete together, plus an inline edit form so a mistake
 * in an existing entry (wrong amount, category, date...) can be corrected
 * in place instead of deleting and re-adding it.
 */
export default function LedgerTable({
  rows, currency, animals, categories, payers, deleteOne, deleteSelected, bulkEditSelected, saveTransaction,
}: {
  rows: LedgerRow[];
  currency: string;
  animals: AnimalOpt[];
  categories: string[];
  payers: string[];
  deleteOne: (fd: FormData) => Promise<void>;
  deleteSelected: (fd: FormData) => Promise<void>;
  bulkEditSelected: (fd: FormData) => Promise<void>;
  saveTransaction: (prev: ActionState, fd: FormData) => Promise<ActionState>;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkDate, setBulkDate] = useState("");
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkPaidBy, setBulkPaidBy] = useState("");
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

  function handleBulkEdit() {
    if (selected.size === 0 || (!bulkDate && !bulkCategory && !bulkPaidBy)) return;
    const what = [bulkDate && "date", bulkCategory && "category", bulkPaidBy && "payer"].filter(Boolean).join(" and ");
    if (!confirm(`Set the ${what} for ${selected.size} selected transaction${selected.size === 1 ? "" : "s"}?`)) return;
    const fd = new FormData();
    selected.forEach((id) => fd.append("ids", id));
    if (bulkDate) fd.append("date", bulkDate);
    if (bulkCategory) fd.append("category", bulkCategory);
    if (bulkPaidBy) fd.append("paidBy", bulkPaidBy);
    startTransition(async () => {
      await bulkEditSelected(fd);
      setSelected(new Set());
      setBulkEditOpen(false);
      setBulkDate("");
      setBulkCategory("");
      setBulkPaidBy("");
    });
  }

  return (
    <>
      {selected.size > 0 && (
        <div className="border-b border-line bg-surface2/60 px-4 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-[13px] text-muted">{selected.size} selected</span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setBulkEditOpen((o) => !o)} className="btn-ghost btn-sm">
                {bulkEditOpen ? "Cancel edit" : "Edit selected"}
              </button>
              <button type="button" onClick={handleDeleteSelected} disabled={isPending} className="btn-danger btn-sm">
                {isPending ? "Deleting…" : "Delete selected"}
              </button>
            </div>
          </div>
          {bulkEditOpen && (
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <Field label="New date" className="w-auto">
                <input type="date" value={bulkDate} onChange={(e) => setBulkDate(e.target.value)} className="input w-auto" />
              </Field>
              <Field label="New category" className="w-auto">
                <input
                  value={bulkCategory} onChange={(e) => setBulkCategory(e.target.value)}
                  list="bulk-edit-cat-opts" className="input w-auto" placeholder="Leave blank to keep"
                />
                <datalist id="bulk-edit-cat-opts">{categories.map((c) => <option key={c} value={c} />)}</datalist>
              </Field>
              <Field label="Paid by" className="w-auto">
                <input
                  value={bulkPaidBy} onChange={(e) => setBulkPaidBy(e.target.value)}
                  list="bulk-edit-payer-opts" className="input w-auto" placeholder="Leave blank to keep"
                />
                <datalist id="bulk-edit-payer-opts">{payers.map((p) => <option key={p} value={p} />)}</datalist>
              </Field>
              <button
                type="button" onClick={handleBulkEdit} disabled={isPending || (!bulkDate && !bulkCategory && !bulkPaidBy)}
                className="btn-primary btn-sm"
              >
                {isPending ? "Applying…" : `Apply to ${selected.size}`}
              </button>
            </div>
          )}
        </div>
      )}
      <div className="scroll-x">
        <table className="w-full min-w-[900px]">
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
              <th className="th">Animal</th><th className="th">Vendor</th><th className="th">Paid by</th><th className="th text-right">Amount</th><th className="th"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <Fragment key={t.id}>
                <tr className="row">
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
                  <td className="td">{t.paidBy ? <Badge tone="brand">{t.paidBy}</Badge> : <span className="text-muted">—</span>}</td>
                  <td className={`td text-right font-semibold tabular-nums ${t.type === "INCOME" ? "text-good" : "text-bad"}`}>
                    {t.type === "INCOME" ? "+" : "−"}{money(t.amount, currency)}
                    {t.usdText && <div className="text-[11px] font-normal text-muted">{t.usdText}</div>}
                  </td>
                  <td className="td text-right">
                    {t.isAuto ? (
                      <span className="text-[11.5px] text-muted" title="Created from a health or feed record">auto</span>
                    ) : (
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingId(editingId === t.id ? null : t.id)}
                          className="rounded-lg p-1.5 text-muted hover:bg-surface2 hover:text-ink"
                          aria-label="Edit transaction"
                        >
                          <Icon.pencil className="h-4 w-4" />
                        </button>
                        <form action={deleteOne}>
                          <input type="hidden" name="id" value={t.id} />
                          <ConfirmSubmit message="Delete this transaction?" className="rounded-lg p-1.5 text-muted hover:text-bad">
                            <Icon.trash className="h-4 w-4" />
                          </ConfirmSubmit>
                        </form>
                      </div>
                    )}
                  </td>
                </tr>
                {editingId === t.id && (
                  <tr>
                    <td colSpan={9} className="border-t border-line bg-surface2/40 p-4">
                      <ActionForm
                        action={saveTransaction}
                        className="grid gap-4 sm:grid-cols-2"
                        onSuccess={() => setEditingId(null)}
                      >
                        <input type="hidden" name="id" value={t.id} />
                        <Field label="Type">
                          <select name="type" defaultValue={t.type} className="input">
                            <option value="EXPENSE">Expense</option>
                            <option value="INCOME">Income</option>
                          </select>
                        </Field>
                        <Field label="Date *"><input type="date" name="date" required defaultValue={t.date.slice(0, 10)} className="input" /></Field>
                        <Field label="Category *">
                          <input name="category" required defaultValue={t.category} className="input" list={`edit-cat-opts-${t.id}`} />
                          <datalist id={`edit-cat-opts-${t.id}`}>{categories.map((c) => <option key={c} value={c} />)}</datalist>
                        </Field>
                        <Field label={`Amount (${currency}) *`}><input name="amount" required inputMode="decimal" defaultValue={t.amount} className="input" /></Field>
                        <Field label="Description" className="sm:col-span-2"><input name="description" defaultValue={t.description ?? ""} className="input" /></Field>
                        <Field label="Linked animal" hint="Optional — lets you see cost per animal">
                          <select name="animalId" defaultValue={t.animal?.id ?? ""} className="input">
                            <option value="">— Not animal-specific —</option>
                            {animals.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.tagId})</option>)}
                          </select>
                        </Field>
                        <Field label="Vendor / paid to"><input name="vendor" defaultValue={t.vendor ?? ""} className="input" /></Field>
                        <Field label="Paid by" hint="Whose money this was">
                          <input name="paidBy" defaultValue={t.paidBy ?? ""} className="input" list={`edit-payer-opts-${t.id}`} />
                          <datalist id={`edit-payer-opts-${t.id}`}>{payers.map((p) => <option key={p} value={p} />)}</datalist>
                        </Field>
                        <Field label="Payment method"><input name="paymentMethod" defaultValue={t.paymentMethod ?? ""} className="input" /></Field>
                        <Field label="Reference / receipt no."><input name="reference" defaultValue={t.reference ?? ""} className="input" /></Field>
                        <div className="flex items-center gap-2 sm:col-span-2">
                          <SubmitButton>Save changes</SubmitButton>
                          <button type="button" onClick={() => setEditingId(null)} className="btn-ghost">Cancel</button>
                        </div>
                      </ActionForm>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
