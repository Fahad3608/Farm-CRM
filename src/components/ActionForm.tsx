"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

export type ActionState = { error?: string; ok?: string } | undefined;
type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

export function SubmitButton({
  children = "Save", className = "btn-primary", pendingLabel = "Saving…",
}: { children?: React.ReactNode; className?: string; pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return <button className={className} disabled={pending}>{pending ? pendingLabel : children}</button>;
}

/**
 * Wraps a server action with inline success/error feedback,
 * and clears the form after a successful create.
 */
export default function ActionForm({
  action, children, className = "", resetOnSuccess = false, onSuccess,
}: {
  action: Action;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  onSuccess?: () => void;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) {
      if (resetOnSuccess) ref.current?.reset();
      onSuccess?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form ref={ref} action={formAction} className={className}>
      {children}
      {state?.error && (
        <p role="alert" className="mt-3 rounded-lg border border-bad/30 bg-bad/10 px-3 py-2 text-[13px] text-bad">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p role="status" className="mt-3 rounded-lg border border-good/30 bg-good/10 px-3 py-2 text-[13px] text-good">
          {state.ok}
        </p>
      )}
    </form>
  );
}
