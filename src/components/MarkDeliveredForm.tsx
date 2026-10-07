"use client";

import { useState } from "react";
import ActionForm, { SubmitButton } from "./ActionForm";
import { markDeliveredAction } from "@/app/actions/breeding";
import { Field } from "./ui";

export default function MarkDeliveredForm({
  recordId, onDone,
}: { recordId: string; onDone?: () => void }) {
  const [open, setOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  if (!open) {
    return (
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
        className="btn-ghost btn-sm text-good"
      >
        Mark delivered
      </button>
    );
  }

  return (
    <div onClick={(e) => e.preventDefault()}>
      <ActionForm
        action={markDeliveredAction}
        className="flex flex-col gap-3"
        onSuccess={() => { setOpen(false); onDone?.(); }}
      >
        <input type="hidden" name="id" value={recordId} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Birth date *">
            <input type="date" name="actualBirthDate" required defaultValue={today} className="input" />
          </Field>
          <Field label="Number of young born">
            <input name="offspringCount" inputMode="numeric" className="input" placeholder="1" />
          </Field>
          <Field label="Notes on the young" className="sm:col-span-2">
            <input name="offspringNotes" className="input" placeholder="1 male kid, healthy" />
          </Field>
        </div>
        <div className="flex items-center gap-2">
          <SubmitButton>Confirm delivery</SubmitButton>
          <button type="button" onClick={() => setOpen(false)} className="btn-ghost btn-sm">Cancel</button>
        </div>
      </ActionForm>
    </div>
  );
}
