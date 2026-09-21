"use client";

import ActionForm, { SubmitButton } from "./ActionForm";
import { addBatchCostAction } from "@/app/actions/batches";
import { Field } from "./ui";

const SUGGESTIONS = [
  "Parchi mandi",
  "Baba helper",
  "Karaya loader",
  "Transport",
  "Funds transfer",
  "Market fee",
  "Commission",
];

export default function BatchCostForm({ batchId }: { batchId: string }) {
  return (
    <ActionForm action={addBatchCostAction} className="grid gap-4" resetOnSuccess>
      <input type="hidden" name="batchId" value={batchId} />
      <Field label="Description *" hint="e.g. Parchi mandi, Karaya loader, Transport">
        <input name="description" required className="input" list="batch-cost-suggestions" placeholder="Parchi mandi" />
        <datalist id="batch-cost-suggestions">
          {SUGGESTIONS.map((s) => <option key={s} value={s} />)}
        </datalist>
      </Field>
      <Field label="Amount *">
        <input name="amount" required inputMode="decimal" className="input" placeholder="0" />
      </Field>
      <SubmitButton>Add cost</SubmitButton>
    </ActionForm>
  );
}
