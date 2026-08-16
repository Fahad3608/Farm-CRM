"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { loginAction } from "@/app/actions/auth";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button className="btn-primary mt-1 w-full" disabled={pending}>
      {pending ? "Signing in…" : "Sign in"}
    </button>
  );
}

export default function LoginForm() {
  const [state, action] = useActionState(loginAction, undefined);

  return (
    <form action={action} className="flex flex-col gap-3.5">
      <label className="block">
        <span className="label">Email</span>
        <input name="email" type="email" autoComplete="username" required className="input" placeholder="you@farm.local" />
      </label>
      <label className="block">
        <span className="label">Password</span>
        <input name="password" type="password" autoComplete="current-password" required className="input" placeholder="••••••••" />
      </label>
      {state?.error && (
        <p role="alert" className="rounded-lg border border-bad/30 bg-bad/10 px-3 py-2 text-[13px] text-bad">
          {state.error}
        </p>
      )}
      <Submit />
    </form>
  );
}
