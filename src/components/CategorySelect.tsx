"use client";

import { useState } from "react";
import { Field } from "./ui";
import { EXPENSE_GROUP_LABELS, CATEGORY_GROUPS, categoryGroupOf } from "@/lib/domain";

/**
 * Picks an expense sub-category from the farm's own list, grouped under the
 * main category it belongs to. The main category is never chosen separately —
 * it follows from the sub-category, and is shown below so that's obvious.
 */
export default function CategorySelect({
  categories, assigned, defaultValue = "", idPrefix = "cat",
}: {
  categories: string[];
  /** Explicit sub-category → main category overrides set in Finance → Categories. */
  assigned: Record<string, string>;
  defaultValue?: string;
  idPrefix?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const map = new Map(Object.entries(assigned));
  const mainOf = (c: string) => categoryGroupOf(c, map);

  const groups = CATEGORY_GROUPS
    .map((group) => ({ group, items: categories.filter((c) => mainOf(c) === group).sort() }))
    .filter((g) => g.items.length > 0);

  // A category whose group isn't one of the known main categories still has to
  // be pickable, so it goes in a trailing catch-all rather than disappearing.
  const grouped = new Set(groups.flatMap((g) => g.items));
  const ungrouped = categories.filter((c) => !grouped.has(c)).sort();

  return (
    <Field
      label="Sub category *"
      hint={value ? `Main category: ${EXPENSE_GROUP_LABELS[mainOf(value)] ?? mainOf(value)}` : "Its main category follows automatically"}
    >
      <select
        name="category"
        required
        className="input"
        id={`${idPrefix}-category`}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      >
        <option value="" disabled>Choose a sub category…</option>
        {groups.map((g) => (
          <optgroup key={g.group} label={EXPENSE_GROUP_LABELS[g.group] ?? g.group}>
            {g.items.map((c) => <option key={c} value={c}>{c}</option>)}
          </optgroup>
        ))}
        {ungrouped.length > 0 && (
          <optgroup label="Ungrouped">
            {ungrouped.map((c) => <option key={c} value={c}>{c}</option>)}
          </optgroup>
        )}
      </select>
    </Field>
  );
}
