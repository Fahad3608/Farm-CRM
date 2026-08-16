"use client";

import { createContext, startTransition, useActionState, useContext, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

export type ActionState = { error?: string; ok?: string } | undefined;
type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

/** Lets SubmitButton show progress even though the form submits via onSubmit. */
const PendingContext = createContext(false);

export function SubmitButton({
  children = "Save", className = "btn-primary", pendingLabel = "Saving…",
}: { children?: React.ReactNode; className?: string; pendingLabel?: string }) {
  const contextPending = useContext(PendingContext);
  const { pending } = useFormStatus();
  const busy = contextPending || pending;
  return <button className={className} disabled={busy}>{busy ? pendingLabel : children}</button>;
}

/**
 * Wraps a server action with inline success/error feedback.
 *
 * Submits through onSubmit rather than `<form action={…}>` on purpose: React 19
 * clears an uncontrolled form once its action resolves, which would wipe
 * everything typed whenever the action comes back with a validation error.
 * Driving the action ourselves keeps the fields intact, so the user only has to
 * correct the one field that was wrong. We still reset explicitly on success
 * where that is what you want.
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
  const [state, formAction, isPending] = useActionState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) {
      if (resetOnSuccess) ref.current?.reset();
      onSuccess?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => formAction(data));
  }

  return (
    <PendingContext.Provider value={isPending}>
      <form ref={ref} onSubmit={handleSubmit} className={className}>
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
    </PendingContext.Provider>
  );
}
