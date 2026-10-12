import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { Badge, Empty, Field, PageHeader, Section } from "@/components/ui";
import ActionForm, { SubmitButton } from "@/components/ActionForm";
import RecordActions from "@/components/RecordActions";
import ConfirmSubmit from "@/components/ConfirmSubmit";
import AutoSubmitSelect from "@/components/AutoSubmitSelect";
import { createCategoryAction, deleteCategoryAction, setCategoryGroupAction } from "@/app/actions/categories";
import { CATEGORY_GROUPS, EXPENSE_CATEGORIES, EXPENSE_GROUP_LABELS, categoryGroupOf } from "@/lib/domain";
import { money } from "@/lib/format";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

/**
 * The sub-categories Finance offers, and which main category each rolls up
 * into — the spreadsheet's two category columns, editable in one place.
 */
export default async function ManageCategoriesPage() {
  const user = await requireUser();
  if (!can.editFinance(user.role)) redirect("/finance");

  const settings = await getSettings();

  const [dbCategories, used, spendByCategory] = await Promise.all([
    prisma.category.findMany({ where: { type: "EXPENSE" }, orderBy: { name: "asc" } }),
    prisma.transaction.findMany({ where: { type: "EXPENSE" }, select: { category: true }, distinct: ["category"] }),
    prisma.transaction.groupBy({ by: ["category"], where: { type: "EXPENSE" }, _sum: { amount: true }, _count: true }),
  ]);

  const assigned = new Map(dbCategories.filter((c) => c.group).map((c) => [c.name, c.group!]));
  const usedNames = new Set(used.map((u) => u.category));
  const spend = new Map(spendByCategory.map((r) => [r.category, { total: Number(r._sum.amount ?? 0), count: r._count }]));
  const customRow = new Map(dbCategories.map((c) => [c.name, c]));

  // Everything Finance could offer: the built-in sheet list, anything added
  // here, and anything already sitting on a transaction.
  const allNames = [...new Set([
    ...EXPENSE_CATEGORIES,
    ...dbCategories.map((c) => c.name),
    ...used.map((u) => u.category),
  ])];

  const groups = CATEGORY_GROUPS.map((group) => ({
    group,
    names: allNames.filter((n) => categoryGroupOf(n, assigned) === group).sort(),
  })).filter((g) => g.names.length > 0);

  const totalFor = (name: string) => spend.get(name);

  return (
    <>
      <PageHeader
        title="Finance categories"
        subtitle="Which sub-categories Finance offers, and the main category each rolls up into"
        action={<Link href="/finance" className="btn-ghost btn-sm">Back to Finance</Link>}
      />

      <Section title="Add a sub-category" subtitle="It appears in the Add expense picker straight away" className="mb-4">
        <div className="p-4">
          <ActionForm action={createCategoryAction} className="flex flex-wrap items-end gap-3" resetOnSuccess>
            <input type="hidden" name="type" value="EXPENSE" />
            <Field label="Name *"><input name="name" required className="input w-auto" placeholder="Transport" /></Field>
            <Field label="Main category *">
              <select name="group" required className="input w-auto" defaultValue="Running Expense">
                {CATEGORY_GROUPS.map((g) => (
                  <option key={g} value={g}>{EXPENSE_GROUP_LABELS[g] ?? g}</option>
                ))}
              </select>
            </Field>
            <SubmitButton>Add sub-category</SubmitButton>
          </ActionForm>
        </div>
      </Section>

      <Section
        title="Sub-categories by main category"
        subtitle="Change a main category here and every month regroups to match"
      >
        <p className="border-b border-line px-4 py-3 text-[13px] text-muted">
          Removing a sub-category only takes it out of the picker — entries already
          filed under it keep their category and still show in Finance.
        </p>

        {groups.map((g) => (
          <div key={g.group}>
            <div className="border-y border-line bg-surface2/50 px-4 py-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                {EXPENSE_GROUP_LABELS[g.group] ?? g.group}
              </span>
            </div>
            <ul className="divide-y divide-line">
              {g.names.map((name) => {
                const s = totalFor(name);
                const row = customRow.get(name);
                return (
                  <li key={name} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
                    <span className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="truncate text-[14px] font-medium">{name}</span>
                      {!EXPENSE_CATEGORIES.includes(name) && <Badge tone="muted">Added</Badge>}
                      {s ? (
                        <span className="text-[12.5px] text-muted">
                          {s.count} {s.count === 1 ? "entry" : "entries"} · {money(s.total, settings.currency)}
                        </span>
                      ) : (
                        <span className="text-[12.5px] text-muted">Not used yet</span>
                      )}
                    </span>
                    <span className="flex items-center gap-2">
                      <form action={setCategoryGroupAction}>
                        <input type="hidden" name="name" value={name} />
                        <AutoSubmitSelect
                          name="group"
                          defaultValue={categoryGroupOf(name, assigned)}
                          options={CATEGORY_GROUPS}
                          labels={EXPENSE_GROUP_LABELS}
                        />
                      </form>
                      {row && !usedNames.has(name) && (
                        <RecordActions label="Category actions"><form action={deleteCategoryAction}>
                          <input type="hidden" name="id" value={row.id} />
                          <ConfirmSubmit className="record-delete-action" message={`Remove "${name}" from the picker?`}>
                            Remove sub-category
                          </ConfirmSubmit>
                        </form></RecordActions>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        {groups.length === 0 && <Empty icon="🏷️" title="No categories yet" />}
      </Section>
    </>
  );
}
