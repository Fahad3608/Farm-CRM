"use client";

import { useMemo, useState } from "react";
import ActionForm, { SubmitButton } from "./ActionForm";
import { markDeliveredAction } from "@/app/actions/breeding";
import { Field } from "./ui";

type AnimalOpt = { id: string; label: string };

export default function MarkDeliveredForm({
  recordId, animals = [], onDone,
}: { recordId: string; animals?: AnimalOpt[]; onDone?: () => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const today = new Date().toISOString().slice(0, 10);

  const filtered = useMemo(() => {
    if (!search) return animals;
    const q = search.toLowerCase();
    return animals.filter((a) => a.label.toLowerCase().includes(q));
  }, [animals, search]);

  function toggleAnimal(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className="btn-ghost btn-sm text-good"
      >
        Mark delivered
      </button>
    );
  }

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <ActionForm
        action={markDeliveredAction}
        className="flex flex-col gap-3"
        onSuccess={() => { setOpen(false); setSelectedIds(new Set()); onDone?.(); }}
      >
        <input type="hidden" name="id" value={recordId} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Birth date *">
            <input type="date" name="actualBirthDate" required defaultValue={today} className="input" />
          </Field>
          <Field label="Number of young born">
            <input name="offspringCount" inputMode="numeric" className="input" placeholder="1" />
          </Field>
        </div>

        {animals.length > 0 && (
          <div>
            <span className="mb-1 block text-[13px] font-semibold uppercase tracking-wide text-muted">
              Link offspring
              {selectedIds.size > 0 && <span className="ml-1 normal-case tracking-normal text-ink">({selectedIds.size} selected)</span>}
            </span>
            {animals.length > 8 && (
              <input
                type="search" placeholder="Search animals…" value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input mb-2"
              />
            )}
            <div className="max-h-40 overflow-y-auto rounded-xl border border-line bg-surface2 p-1">
              {filtered.map((a) => (
                <label key={a.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-[14px] hover:bg-surface">
                  <input
                    type="checkbox" name="offspringId" value={a.id}
                    checked={selectedIds.has(a.id)}
                    onChange={() => toggleAnimal(a.id)}
                    className="h-4 w-4 accent-[rgb(var(--brand))]"
                  />
                  {a.label}
                </label>
              ))}
              {filtered.length === 0 && (
                <p className="px-2.5 py-2 text-[13px] text-muted">No animals match</p>
              )}
            </div>
          </div>
        )}

        <Field label="Notes">
          <input name="offspringNotes" className="input" placeholder="Any notes about the delivery" />
        </Field>

        <div className="flex items-center gap-2">
          <SubmitButton>Confirm delivery</SubmitButton>
          <button type="button" onClick={() => setOpen(false)} className="btn-ghost btn-sm">Cancel</button>
        </div>
      </ActionForm>
    </div>
  );
}
