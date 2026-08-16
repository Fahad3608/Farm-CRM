"use client";

import ActionForm, { SubmitButton } from "@/components/ActionForm";
import { Field } from "@/components/ui";
import { completeSetupAction } from "@/app/actions/setup";
import { CURRENCIES } from "@/lib/settings";

export default function SetupForm() {
  return (
    <ActionForm action={completeSetupAction} className="flex flex-col gap-4">
      <Field label="Farm name *" hint="Shown across the app — you can change it later">
        <input name="farmName" required className="input" placeholder="Green Acres Farm" />
      </Field>

      <Field label="Currency">
        <input name="currency" defaultValue="PKR" list="cur-opts" maxLength={3} className="input uppercase" />
        <datalist id="cur-opts">{CURRENCIES.map((c) => <option key={c} value={c} />)}</datalist>
      </Field>

      <hr className="border-line" />

      <Field label="Your name *">
        <input name="name" required className="input" autoComplete="name" placeholder="Fahad" />
      </Field>

      <Field label="Email *" hint="You will sign in with this">
        <input name="email" type="email" required className="input" autoComplete="username" placeholder="you@example.com" />
      </Field>

      <Field label="Phone">
        <input name="phone" className="input" autoComplete="tel" />
      </Field>

      <Field label="Password *" hint="At least 8 characters">
        <input name="password" type="password" required minLength={8} className="input" autoComplete="new-password" />
      </Field>

      <Field label="Confirm password *">
        <input name="confirm" type="password" required minLength={8} className="input" autoComplete="new-password" />
      </Field>

      <SubmitButton className="btn-primary w-full" pendingLabel="Setting up…">
        Create my farm
      </SubmitButton>
    </ActionForm>
  );
}
