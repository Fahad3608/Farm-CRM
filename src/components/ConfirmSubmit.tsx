"use client";

/** A submit button that asks before doing something destructive. */
export default function ConfirmSubmit({
  message, children, className = "btn-danger btn-sm",
}: { message: string; children: React.ReactNode; className?: string }) {
  return (
    <button
      className={className}
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
