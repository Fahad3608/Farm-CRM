"use client";

import ActionForm, { SubmitButton } from "./ActionForm";
import { saveCustomerAction } from "@/app/actions/customers";
import { Field } from "./ui";

export default function CustomerForm({
  customer,
}: {
  customer?: { id: string; name: string; phone: string | null; address: string | null; notes: string | null; active: boolean };
}) {
  return (
    <ActionForm action={saveCustomerAction} className="grid gap-4" resetOnSuccess={!customer}>
      {customer && <input type="hidden" name="id" value={customer.id} />}
      <Field label="Buyer name *">
        <input name="name" required className="input" defaultValue={customer?.name ?? ""} placeholder="e.g. Rashid Dairy Shop" />
      </Field>
      <Field label="Phone">
        <input name="phone" className="input" defaultValue={customer?.phone ?? ""} placeholder="03xx-xxxxxxx" />
      </Field>
      <Field label="Address / area">
        <input name="address" className="input" defaultValue={customer?.address ?? ""} placeholder="Shop, street or village" />
      </Field>
      <Field label="Notes" hint="Payment day, delivery time, anything worth remembering">
        <textarea name="notes" rows={2} className="input" defaultValue={customer?.notes ?? ""} />
      </Field>
      {customer && (
        <label className="flex items-center gap-2 text-[13.5px]">
          <input type="checkbox" name="active" defaultChecked={customer.active} className="h-4 w-4 accent-[rgb(var(--brand))]" />
          Still buying (uncheck to archive)
        </label>
      )}
      <SubmitButton>{customer ? "Update buyer" : "Add buyer"}</SubmitButton>
    </ActionForm>
  );
}
