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
import { fmtDate } from "@/lib/format";
import { Icon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const me = await requireUser();
  if (!can.manageSettings(me.role)) redirect("/dashboard");

  const settings = await getSettings();
  const users = can.manageUsers(me.role)
    ? await prisma.user.findMany({ orderBy: [{ role: "asc" }, { name: "asc" }] })
    : [];

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
