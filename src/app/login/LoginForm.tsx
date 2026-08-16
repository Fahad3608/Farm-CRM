"use client";

import ActionForm, { SubmitButton } from "@/components/ActionForm";
import { loginAction } from "@/app/actions/auth";

export default function LoginForm() {
  return (
    <ActionForm action={loginAction} className="flex flex-col gap-3.5">
      <label className="block">
        <span className="label">Email</span>
        <input name="email" type="email" autoComplete="username" required className="input" placeholder="you@farm.local" />
      </label>
      <label className="block">
        <span className="label">Password</span>
        <input name="password" type="password" autoComplete="current-password" required className="input" placeholder="••••••••" />
      </label>
      <SubmitButton className="btn-primary mt-1 w-full" pendingLabel="Signing in…">Sign in</SubmitButton>
    </ActionForm>
  );
}
