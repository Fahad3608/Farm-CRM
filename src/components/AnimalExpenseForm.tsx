"use client";

import { useState } from "react";
import ActionForm, { SubmitButton } from "./ActionForm";
import { saveTransactionAction } from "@/app/actions/finance";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/domain";
import { Field } from "./ui";

/** A quick way to log a cost (or a bit of income) against this animal specifically. */
export default function AnimalExpenseForm({ animalId, currency }: { animalId: string; currency: string }) {
  const [type, setType] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const today = new Date().toISOString().slice(0, 10);
  const categories = type === "EXPENSE" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  return (
    <ActionForm action={saveTransactionAction} className="grid gap-4 sm:grid-cols-2" resetOnSuccess>
      <input type="hidden" name="animalId" value={animalId} />
      <Field label="Type">
        <select name="type" value={type} onChange={(e) => setType(e.target.value as "EXPENSE" | "INCOME")} className="input">
          <option value="EXPENSE">Expense</option>
          <option value="INCOME">Income</option>
        </select>
      </Field>
      <Field label="Date *"><input type="date" name="date" required defaultValue={today} className="input" /></Field>
      <Field label="Category *">
        <input name="category" required className="input" list="animal-expense-cat-opts" placeholder={type === "EXPENSE" ? "Transport" : "Milk Sales"} key={type} />
        <datalist id="animal-expense-cat-opts">{categories.map((c) => <option key={c} value={c} />)}</datalist>
      </Field>
      <Field label={`Amount (${currency}) *`}><input name="amount" required inputMode="decimal" className="input" placeholder="0" /></Field>
      <Field label="Description" className="sm:col-span-2"><input name="description" className="input" /></Field>
      <Field label="Vendor / paid to"><input name="vendor" className="input" /></Field>
      <Field label="Payment method">
        <input name="paymentMethod" className="input" list="animal-expense-pay-opts" />
        <datalist id="animal-expense-pay-opts"><option value="Cash" /><option value="Bank transfer" /><option value="Mobile wallet" /><option value="Cheque" /><option value="Credit" /></datalist>
      </Field>
      <div className="sm:col-span-2"><SubmitButton>{type === "EXPENSE" ? "Log expense" : "Log income"}</SubmitButton></div>
    </ActionForm>
  );
}
