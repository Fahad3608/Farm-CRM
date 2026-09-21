"use client";

/** A <select> that submits its enclosing form as soon as the value changes. */
export default function AutoSubmitSelect({
  name, defaultValue, options, className = "input w-auto py-1.5 text-[13px]",
}: { name: string; defaultValue: string; options: readonly string[]; className?: string }) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      className={className}
      onChange={(e) => e.currentTarget.form?.requestSubmit()}
    >
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}
