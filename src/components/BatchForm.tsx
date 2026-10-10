"use client";

import ActionForm, { SubmitButton } from "./ActionForm";
import { saveBatchAction } from "@/app/actions/batches";
import { Field } from "./ui";
import { dateInput } from "@/lib/format";

export default function BatchForm({
  batch,
}: {
  batch?: { id: string; name: string; date: Date; notes: string | null };
}) {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <ActionForm action={saveBatchAction} className="grid gap-4" resetOnSuccess={!batch}>
      {batch && <input type="hidden" name="id" value={batch.id} />}
      <Field label="Batch name *">
        <input name="name" required className="input" defaultValue={batch?.name ?? ""} placeholder="e.g. June 13th — Mandi Batch 1" />
      </Field>
      <Field label="Date *">
        <input type="date" name="date" required className="input" defaultValue={batch ? dateInput(batch.date) : today} />
      </Field>
      <Field label="Notes">
        <textarea name="notes" className="input" rows={2} defaultValue={batch?.notes ?? ""} placeholder="Optional notes about this trip" />
      </Field>
      <SubmitButton>{batch ? "Update batch" : "Create batch"}</SubmitButton>
    </ActionForm>
  );
}
