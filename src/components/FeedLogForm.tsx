"use client";

import { useState } from "react";
import ActionForm, { SubmitButton } from "./ActionForm";
import { addFeedLogAction } from "@/app/actions/feed";
import { Field } from "./ui";

type FeedOpt = { id: string; name: string; unit: string; costPerUnit: string };
type AnimalOpt = { id: string; label: string; species: string };

/**
 * Feed is usually given to a pen, not one animal — so a group log splits the
 * quantity and cost evenly across the animals you tick.
 */
export default function FeedLogForm({
  feeds, animals, animalId, currency,
}: { feeds: FeedOpt[]; animals: AnimalOpt[]; animalId?: string; currency: string }) {
  const [target, setTarget] = useState<"animal" | "group">(animalId ? "animal" : "group");
  const [feedId, setFeedId] = useState(feeds[0]?.id ?? "");
  const [picked, setPicked] = useState<string[]>([]);
  const feed = feeds.find((f) => f.id === feedId);
  const today = new Date().toISOString().slice(0, 10);

  if (!feeds.length) {
    return <p className="text-[13.5px] text-muted">Add a feed type first, then you can log feeding.</p>;
  }

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <ActionForm action={addFeedLogAction} className="flex flex-col gap-4" resetOnSuccess>
      <input type="hidden" name="target" value={target} />
      {animalId && <input type="hidden" name="animalId" value={animalId} />}

      {!animalId && (
        <div className="flex gap-2">
          {(["animal", "group"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTarget(t)}
              className={`btn btn-sm ${target === t ? "bg-brand text-brandInk" : "border border-line text-muted"}`}
            >
              {t === "animal" ? "One animal" : "A group / pen"}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Feed *">
          <select name="feedTypeId" value={feedId} onChange={(e) => setFeedId(e.target.value)} className="input">
            {feeds.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </Field>
        <Field label="Date *"><input type="date" name="date" required defaultValue={today} className="input" /></Field>

        {!animalId && target === "animal" && (
          <Field label="Animal *" className="sm:col-span-2">
            <select name="animalId" required className="input">
              {animals.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
          </Field>
        )}

        <Field label={`Quantity (${feed?.unit ?? "kg"}) *`} hint={target === "group" ? "Total for the whole group" : undefined}>
          <input name="quantity" required inputMode="decimal" className="input" placeholder="10" />
        </Field>
        <Field label={`Cost per ${feed?.unit ?? "kg"} (${currency})`} hint="Defaults to the feed's saved price">
          <input name="unitCost" inputMode="decimal" defaultValue={feed?.costPerUnit ?? ""} key={feedId} className="input" />
        </Field>
      </div>

      {!animalId && target === "group" && (
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="label mb-0">Animals in this group ({picked.length} selected)</span>
            <button type="button" className="btn-ghost btn-sm" onClick={() => setPicked(picked.length === animals.length ? [] : animals.map((a) => a.id))}>
              {picked.length === animals.length ? "Clear all" : "Select all"}
            </button>
          </div>
          <input name="groupLabel" className="input mb-2" placeholder="Group name — e.g. Goat pen B" />
          <div className="max-h-56 overflow-y-auto rounded-xl border border-line p-2">
            {animals.map((a) => (
              <label key={a.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[14px] hover:bg-surface2">
                <input
                  type="checkbox" name="groupAnimalIds" value={a.id}
                  checked={picked.includes(a.id)} onChange={() => toggle(a.id)}
                  className="h-4 w-4 accent-[rgb(var(--brand))]"
                />
                {a.label}
              </label>
            ))}
          </div>
        </div>
      )}

      <Field label="Notes"><input name="notes" className="input" placeholder="Optional" /></Field>
      <div><SubmitButton>Log feed</SubmitButton></div>
    </ActionForm>
  );
}
