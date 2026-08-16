"use client";

import ActionForm, { SubmitButton } from "./ActionForm";
import { addMilkAction, addWeightAction } from "@/app/actions/logs";
import { recordSaleAction } from "@/app/actions/animals";
import { Field } from "./ui";

const today = () => new Date().toISOString().slice(0, 10);

export function AddWeightForm({ animalId }: { animalId: string }) {
  return (
    <ActionForm action={addWeightAction} className="grid gap-3 sm:grid-cols-[1fr_1fr_2fr_auto] sm:items-end" resetOnSuccess>
      <input type="hidden" name="animalId" value={animalId} />
      <Field label="Date"><input type="date" name="date" required defaultValue={today()} className="input" /></Field>
      <Field label="Weight (kg)"><input name="weightKg" required inputMode="decimal" className="input" placeholder="240" /></Field>
      <Field label="Notes"><input name="notes" className="input" placeholder="Optional" /></Field>
      <SubmitButton className="btn-primary">Add</SubmitButton>
    </ActionForm>
  );
}

export function AddMilkForm({ animalId }: { animalId: string }) {
  return (
    <ActionForm action={addMilkAction} className="grid gap-3 sm:grid-cols-[1fr_auto_1fr_2fr_auto] sm:items-end" resetOnSuccess>
      <input type="hidden" name="animalId" value={animalId} />
      <Field label="Date"><input type="date" name="date" required defaultValue={today()} className="input" /></Field>
      <Field label="Session">
        <select name="session" className="input"><option>AM</option><option>PM</option></select>
      </Field>
      <Field label="Litres"><input name="litres" required inputMode="decimal" className="input" placeholder="6.5" /></Field>
      <Field label="Notes"><input name="notes" className="input" placeholder="Optional" /></Field>
      <SubmitButton className="btn-primary">Add</SubmitButton>
    </ActionForm>
  );
}

export function SaleForm({ animalId, currency }: { animalId: string; currency: string }) {
  return (
    <ActionForm action={recordSaleAction} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="animalId" value={animalId} />
      <Field label="What happened">
        <select name="status" className="input">
          <option value="SOLD">Sold</option>
          <option value="DECEASED">Died</option>
          <option value="CULLED">Culled</option>
          <option value="LOANED_OUT">Loaned out</option>
        </select>
      </Field>
      <Field label="Date"><input type="date" name="exitDate" required defaultValue={today()} className="input" /></Field>
      <Field label={`Sale price (${currency})`} hint="Recorded as income if sold">
        <input name="salePrice" inputMode="decimal" className="input" placeholder="0" />
      </Field>
      <Field label="Buyer"><input name="buyerName" className="input" /></Field>
      <Field label="Reason / notes" className="sm:col-span-2"><input name="exitReason" className="input" /></Field>
      <div className="sm:col-span-2"><SubmitButton>Record</SubmitButton></div>
    </ActionForm>
  );
}
