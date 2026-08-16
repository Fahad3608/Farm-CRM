"use client";

import { useState } from "react";
import ActionForm, { SubmitButton } from "./ActionForm";
import { saveBreedingAction } from "@/app/actions/breeding";
import { Field } from "./ui";

type Opt = { id: string; label: string };

const METHODS = [["NATURAL", "Natural service"], ["ARTIFICIAL_INSEMINATION", "Artificial insemination"], ["EMBRYO_TRANSFER", "Embryo transfer"]];
const STATUSES = [["BRED", "Bred — awaiting confirmation"], ["CONFIRMED_PREGNANT", "Confirmed pregnant"],
  ["NOT_PREGNANT", "Not pregnant"], ["ABORTED", "Aborted"], ["DELIVERED", "Delivered"]];

export default function BreedingForm({
  dams, sires, damId, showCost = true, onDone,
}: { dams: Opt[]; sires: Opt[]; damId?: string; showCost?: boolean; onDone?: () => void }) {
  const [status, setStatus] = useState("BRED");
  const today = new Date().toISOString().slice(0, 10);

  return (
    <ActionForm action={saveBreedingAction} className="flex flex-col gap-4" resetOnSuccess onSuccess={onDone}>
      <div className="grid gap-4 sm:grid-cols-2">
        {damId ? <input type="hidden" name="damId" value={damId} /> : (
          <Field label="Female (dam) *">
            <select name="damId" required className="input">{dams.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select>
          </Field>
        )}
        <Field label="Method">
          <select name="method" className="input">{METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        </Field>
        <Field label="Breeding / service date *"><input type="date" name="breedingDate" required defaultValue={today} className="input" /></Field>
        <Field label="Expected due date" hint="Left blank, we calculate it from the species' gestation period">
          <input type="date" name="expectedDueDate" className="input" />
        </Field>
        <Field label="Sire on the farm">
          <select name="sireId" className="input"><option value="">— None / external —</option>{sires.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select>
        </Field>
        <Field label="External sire / semen bull"><input name="sireName" className="input" placeholder="Bull name or semen code" /></Field>
        <Field label="Status">
          <select name="status" value={status} onChange={(e) => setStatus(e.target.value)} className="input">
            {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
        {status === "CONFIRMED_PREGNANT" && (
          <Field label="Pregnancy confirmed on"><input type="date" name="confirmedAt" className="input" /></Field>
        )}
        {status === "DELIVERED" && (
          <>
            <Field label="Actual birth date"><input type="date" name="actualBirthDate" className="input" /></Field>
            <Field label="Number of young born"><input name="offspringCount" inputMode="numeric" className="input" placeholder="1" /></Field>
            <Field label="Notes on the young" className="sm:col-span-2">
              <input name="offspringNotes" className="input" placeholder="1 male kid, healthy; 1 stillborn" />
            </Field>
          </>
        )}
        {showCost && <Field label="Cost (AI / stud fee)"><input name="cost" inputMode="decimal" className="input" placeholder="0" /></Field>}
        <Field label="Notes" className="sm:col-span-2"><textarea name="notes" rows={2} className="input resize-y" /></Field>
      </div>
      <div><SubmitButton>Save breeding record</SubmitButton></div>
    </ActionForm>
  );
}
