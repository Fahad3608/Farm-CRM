import ActionForm, { SubmitButton } from "./ActionForm";
import { Field } from "./ui";
import { CATEGORY_GROUPS } from "@/lib/domain";
import { EXPENSE_GROUP_LABELS } from "@/lib/monthlyExpenses";
import { createCategoryAction, saveExpenseCategoryGroupAction } from "@/app/actions/categories";

function GroupSelect({ value = "Other" }: { value?: string }) {
  return <select name="group" defaultValue={value} className="input">
    {!CATEGORY_GROUPS.includes(value as typeof CATEGORY_GROUPS[number]) && <option value={value}>{value}</option>}
    {CATEGORY_GROUPS.map(group => <option key={group} value={group}>{EXPENSE_GROUP_LABELS[group]}</option>)}
  </select>;
}

export default function ExpenseCategoryManager({ categories }: {
  categories: { name: string; group: string }[];
}) {
  return <details id="manage-expense-categories" className="card mb-4 scroll-mt-4">
    <summary className="cursor-pointer px-4 py-3 font-semibold">Manage expense categories</summary>
    <div className="border-t border-line p-4">
      <p className="mb-3 text-[13px] text-muted">Categories describe what you paid for. Groups separate running costs, equipment and construction, animal purchases, and other costs.</p>
      <ActionForm action={createCategoryAction} className="grid items-end gap-3 sm:grid-cols-3" resetOnSuccess>
        <input type="hidden" name="type" value="EXPENSE" />
        <Field label="New category"><input name="name" required className="input" placeholder="e.g. Electricity" /></Field>
        <Field label="Spending group"><GroupSelect /></Field>
        <div><SubmitButton>Add category</SubmitButton></div>
      </ActionForm>
      <p className="my-4 text-[13px] text-muted">Changing a category’s group updates its breakdown in every month. To change one expense, use “Change category” in the ledger; select multiple entries to edit them together.</p>
      <div className="max-h-96 divide-y divide-line overflow-y-auto">
        {categories.map(category => <ActionForm key={`${category.name}:${category.group}`} action={saveExpenseCategoryGroupAction} className="flex flex-wrap items-end gap-3 py-3">
          <input type="hidden" name="name" value={category.name} />
          <Field label={category.name} className="min-w-0 flex-1"><GroupSelect value={category.group} /></Field>
          <SubmitButton className="btn-ghost">Save group</SubmitButton>
        </ActionForm>)}
      </div>
    </div>
  </details>;
}
