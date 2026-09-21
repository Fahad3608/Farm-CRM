import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can, ROLE_BLURB, ROLE_LABEL } from "@/lib/permissions";
import { CURRENCIES, getSettings } from "@/lib/settings";
import { Badge, Card, Empty, Field, PageHeader, Section } from "@/components/ui";
import ActionForm, { SubmitButton } from "@/components/ActionForm";
import ConfirmSubmit from "@/components/ConfirmSubmit";
import Disclosure from "@/components/Disclosure";
import { deleteUserAction, saveFarmSettingsAction, saveUserAction } from "@/app/actions/settings";
import { createCategoryAction, deleteCategoryAction, setCategoryGroupAction } from "@/app/actions/categories";
import { backfillPurchaseTransactionsAction } from "@/app/actions/animals";
import { backfillBatchCostTransactionsAction } from "@/app/actions/batches";
import { fmtDate } from "@/lib/format";
import { Icon } from "@/components/icons";
import { CATEGORY_GROUPS, EXPENSE_CATEGORIES, categoryGroupOf } from "@/lib/domain";
import AutoSubmitSelect from "@/components/AutoSubmitSelect";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const me = await requireUser();
  if (!can.manageSettings(me.role)) redirect("/dashboard");

  const settings = await getSettings();
  const users = can.manageUsers(me.role)
    ? await prisma.user.findMany({ orderBy: [{ role: "asc" }, { name: "asc" }] })
    : [];
  const categories = can.editFinance(me.role)
    ? await prisma.category.findMany({ orderBy: [{ type: "asc" }, { name: "asc" }] })
    : [];

  // Every expense category anyone could see on Finance — built-in, custom, or
  // just typed once on a transaction — so grouping covers all of them, not
  // only the ones deliberately added as suggestions.
  const usedExpenseCategories = can.editFinance(me.role)
    ? (await prisma.transaction.findMany({ where: { type: "EXPENSE" }, select: { category: true }, distinct: ["category"] })).map((t) => t.category)
    : [];
  const assignedGroups = new Map(categories.filter((c) => c.type === "EXPENSE" && c.group).map((c) => [c.name, c.group!]));
  const allExpenseCategories = [...new Set([
    ...EXPENSE_CATEGORIES,
    ...categories.filter((c) => c.type === "EXPENSE").map((c) => c.name),
    ...usedExpenseCategories,
  ])].sort();

  return (
    <>
      <PageHeader title="Settings" subtitle="Farm details and who can access what" />

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Section title="Farm details">
          <ActionForm action={saveFarmSettingsAction} className="grid gap-4 p-4 sm:grid-cols-2">
            <Field label="Farm name *" className="sm:col-span-2">
              <input name="farmName" required defaultValue={settings.farmName} className="input" />
            </Field>
            <Field label="Currency" hint="Used everywhere money is shown">
              <input name="currency" defaultValue={settings.currency} list="cur-opts" maxLength={3} className="input uppercase" />
              <datalist id="cur-opts">{CURRENCIES.map((c) => <option key={c} value={c} />)}</datalist>
            </Field>
            <Field label="Weight unit">
              <select name="weightUnit" defaultValue={settings.weightUnit} className="input"><option value="kg">Kilograms (kg)</option><option value="lb">Pounds (lb)</option></select>
            </Field>
            <div className="sm:col-span-2"><SubmitButton>Save settings</SubmitButton></div>
          </ActionForm>
        </Section>

        <Section title="Who can see what" subtitle="Roles are fixed — pick the right one per person">
          <ul className="divide-y divide-line">
            {(Object.keys(ROLE_LABEL) as (keyof typeof ROLE_LABEL)[]).map((r) => (
              <li key={r} className="px-4 py-3">
                <div className="font-medium">{ROLE_LABEL[r]}</div>
                <p className="mt-0.5 text-[13px] text-muted">{ROLE_BLURB[r]}</p>
              </li>
            ))}
          </ul>
        </Section>

        {can.editFinance(me.role) && (
          <Section title="Expense & income categories" subtitle="Always offered as a suggestion on Finance, even before you've used them" className="lg:col-span-2">
            <div className="border-b border-line p-4">
              <ActionForm action={createCategoryAction} className="flex flex-wrap items-end gap-3" resetOnSuccess>
                <Field label="Name *"><input name="name" required className="input w-auto" placeholder="Dewar Labour" /></Field>
                <Field label="Type">
                  <select name="type" className="input w-auto"><option value="EXPENSE">Expense</option><option value="INCOME">Income</option></select>
                </Field>
                <SubmitButton>Add category</SubmitButton>
              </ActionForm>
            </div>

            {categories.length === 0 ? (
              <Empty icon="🏷️" title="No custom categories yet" hint="The usual ones (Feed, Veterinary, Milk Sales…) already show up as suggestions — add your own here too." />
            ) : (
              <ul className="divide-y divide-line">
                {categories.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <span className="flex items-center gap-2 text-[14px]">
                      {c.name}
                      <Badge tone={c.type === "INCOME" ? "good" : "muted"}>{c.type === "INCOME" ? "Income" : "Expense"}</Badge>
                    </span>
                    <form action={deleteCategoryAction}>
                      <input type="hidden" name="id" value={c.id} />
                      <ConfirmSubmit message={`Remove "${c.name}" from your category suggestions? Existing transactions keep it.`} className="rounded-lg p-1.5 text-muted hover:text-bad">
                        <Icon.trash className="h-4 w-4" />
                      </ConfirmSubmit>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        )}

        {can.editFinance(me.role) && (
          <Section
            title="Group your expense categories"
            subtitle="Powers Finance's Expenses by group and Monthly operational cost — pick which bucket each category rolls up into"
            className="lg:col-span-2"
          >
            <ul className="divide-y divide-line">
              {allExpenseCategories.map((name) => (
                <li key={name} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span className="truncate text-[14px]">{name}</span>
                  <form action={setCategoryGroupAction}>
                    <input type="hidden" name="name" value={name} />
                    <AutoSubmitSelect name="group" defaultValue={categoryGroupOf(name, assignedGroups)} options={CATEGORY_GROUPS} />
                  </form>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {can.editFinance(me.role) && (
          <Section
            title="Animal purchases in Finance"
            subtitle="Every purchased animal should show up as an expense here — use this if any bought before are missing"
            className="lg:col-span-2"
          >
            <div className="p-4">
              <ActionForm action={backfillPurchaseTransactionsAction}>
                <SubmitButton className="btn-ghost">Sync animal purchases into Finance</SubmitButton>
              </ActionForm>
              <ActionForm action={backfillBatchCostTransactionsAction}>
                <SubmitButton className="btn-ghost">Sync batch costs into Finance</SubmitButton>
              </ActionForm>
            </div>
          </Section>
        )}

        {can.manageUsers(me.role) && (
          <Section
            title="People with access"
            subtitle={`${users.length} accounts`}
            className="lg:col-span-2"
          >
            <div className="border-b border-line p-4">
              <Disclosure label="Add person">
                <Card className="p-4">
                  <ActionForm action={saveUserAction} className="grid gap-4 sm:grid-cols-2" resetOnSuccess>
                    <Field label="Full name *"><input name="name" required className="input" placeholder="Dr. Ayesha Khan" /></Field>
                    <Field label="Email *" hint="This is their username"><input name="email" type="email" required className="input" /></Field>
                    <Field label="Password *" hint="At least 8 characters — share it with them securely">
                      <input name="password" type="text" required minLength={8} className="input" />
                    </Field>
                    <Field label="Role *">
                      <select name="role" className="input" defaultValue="VET">
                        {(Object.keys(ROLE_LABEL) as (keyof typeof ROLE_LABEL)[]).map((r) => (
                          <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Phone"><input name="phone" className="input" /></Field>
                    <Field label="Clinic (for vets)"><input name="clinic" className="input" /></Field>
                    <Field label="Licence no. (for vets)"><input name="licenseNo" className="input" /></Field>
                    <div className="sm:col-span-2"><SubmitButton>Create account</SubmitButton></div>
                  </ActionForm>
                </Card>
              </Disclosure>
            </div>

            {users.length === 0 ? (
              <Empty icon="👥" title="No accounts yet" />
            ) : (
              <ul className="divide-y divide-line">
                {users.map((u) => (
                  <li key={u.id} className="px-4 py-3">
                    <details>
                      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2">
                        <span className="font-medium">{u.name}</span>
                        <Badge tone={u.role === "OWNER" ? "brand" : u.role === "VET" ? "good" : "muted"}>{ROLE_LABEL[u.role]}</Badge>
                        {!u.active && <Badge tone="bad">Disabled</Badge>}
                        <span className="text-[13px] text-muted">{u.email}</span>
                        <span className="ml-auto text-[12px] text-muted">
                          {u.lastLoginAt ? `Last signed in ${fmtDate(u.lastLoginAt)}` : "Never signed in"}
                        </span>
                      </summary>

                      <div className="mt-3 rounded-xl border border-line p-4">
                        <ActionForm action={saveUserAction} className="grid gap-4 sm:grid-cols-2">
                          <input type="hidden" name="id" value={u.id} />
                          <Field label="Full name"><input name="name" defaultValue={u.name} className="input" /></Field>
                          <Field label="Email"><input name="email" type="email" defaultValue={u.email} className="input" /></Field>
                          <Field label="Role">
                            <select name="role" defaultValue={u.role} className="input">
                              {(Object.keys(ROLE_LABEL) as (keyof typeof ROLE_LABEL)[]).map((r) => (
                                <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                              ))}
                            </select>
                          </Field>
                          <Field label="New password" hint="Leave blank to keep the current one">
                            <input name="password" type="text" minLength={8} className="input" />
                          </Field>
                          <Field label="Phone"><input name="phone" defaultValue={u.phone ?? ""} className="input" /></Field>
                          <Field label="Clinic"><input name="clinic" defaultValue={u.clinic ?? ""} className="input" /></Field>
                          <Field label="Licence no."><input name="licenseNo" defaultValue={u.licenseNo ?? ""} className="input" /></Field>
                          <label className="flex items-center gap-2 self-end pb-2.5 text-[14px]">
                            <input type="checkbox" name="active" defaultChecked={u.active} className="h-4 w-4 accent-[rgb(var(--brand))]" />
                            Account is active
                          </label>
                          <div className="flex gap-2 sm:col-span-2"><SubmitButton>Save changes</SubmitButton></div>
                        </ActionForm>

                        {u.id !== me.id && (
                          <form action={deleteUserAction} className="mt-3 border-t border-line pt-3">
                            <input type="hidden" name="id" value={u.id} />
                            <ConfirmSubmit message={`Delete the account for ${u.name}? Their records stay on the farm.`}>
                              <Icon.trash className="h-4 w-4" /> Delete account
                            </ConfirmSubmit>
                          </form>
                        )}
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        )}
      </div>
    </>
  );
}
