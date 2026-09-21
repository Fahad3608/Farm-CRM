import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getSettings } from "@/lib/settings";
import { dateInput, fmtDate, money } from "@/lib/format";
import { EQUIPMENT_KIND, EQUIPMENT_STATUS, EQUIPMENT_COST_CATEGORIES, LINKABLE_EQUIPMENT_EXPENSE } from "@/lib/equipment";
import { addEquipmentExpenseAction, deleteEquipmentAction, linkEquipmentExpenseAction, unlinkEquipmentExpenseAction } from "@/app/actions/equipment";
import EquipmentForm from "@/components/EquipmentForm";
import RecordActions from "@/components/RecordActions";
import ConfirmSubmit from "@/components/ConfirmSubmit";
import Disclosure from "@/components/Disclosure";
import ActionForm, { SubmitButton } from "@/components/ActionForm";
import { Badge, Card, Empty, Field, PageHeader, Section, StatTile } from "@/components/ui";

export const dynamic = "force-dynamic";
export default async function EquipmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!can.viewFinance(user.role)) redirect("/dashboard");
  const { id } = await params;
  const [item, settings, available, payers] = await Promise.all([
    prisma.equipment.findUnique({ where: { id }, include: { transactions: { where: { type: "EXPENSE" }, orderBy: { date: "desc" } } } }),
    getSettings(), prisma.transaction.findMany({ where: LINKABLE_EQUIPMENT_EXPENSE, orderBy: { date: "desc" }, select: { id: true, date: true, description: true, category: true, amount: true } }),
    prisma.payer.findMany({ orderBy: { name: "asc" }, select: { name: true } }),
  ]);
  if (!item) notFound();
  const total = item.transactions.reduce((sum, t) => sum + Number(t.amount), 0);
  return <>
    <Link href="/equipment" className="mb-3 inline-block text-[13px] text-muted hover:text-brand">← All equipment & construction</Link>
    <PageHeader title={item.name} subtitle={`${EQUIPMENT_KIND[item.kind]}${item.location ? ` · ${item.location}` : ""}`} action={
      <RecordActions label="Equipment actions"><form action={deleteEquipmentAction}>
        <input type="hidden" name="id" value={id} />
        <ConfirmSubmit className="record-delete-action" message={`Remove ${item.name} from the equipment list? All expenses stay in Finance. This cannot be undone.`}>Remove item</ConfirmSubmit>
      </form></RecordActions>
    } />
    <div className="mb-4 flex flex-wrap items-center gap-3"><Badge tone={item.status === "COMPLETED" ? "good" : "brand"}>{EQUIPMENT_STATUS[item.status]}</Badge>{item.notes && <p className="text-[14px] text-muted">{item.notes}</p>}</div>
    <div className="mb-5 grid gap-3 sm:grid-cols-2"><StatTile label="Recorded cost" value={money(total, settings.currency)} hint="All linked expenses, counted once in Finance" /><StatTile label="Expense entries" value={item.transactions.length} /></div>
    <div className="mb-5"><Disclosure label="Edit item" tone="ghost"><Card className="p-4"><EquipmentForm item={item} /></Card></Disclosure></div>
    <div className="mb-5 grid items-start gap-4 lg:grid-cols-2">
      <Section title="Record a new expense">
        <ActionForm action={addEquipmentExpenseAction} resetOnSuccess className="grid gap-3 p-4 sm:grid-cols-2">
          <input name="equipmentId" value={id} type="hidden" />
          <Field label="Date *"><input name="date" type="date" required defaultValue={dateInput(new Date())} className="input" /></Field>
          <Field label="Category"><select name="category" className="input" defaultValue={item.kind === "CONSTRUCTION" ? "Construction" : "Equipment"}>{EQUIPMENT_COST_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Description *" className="sm:col-span-2"><input name="description" required className="input" placeholder="e.g. Steel pipes, welding labour" /></Field>
          <Field label={`Amount (${settings.currency}) *`}><input name="amount" required inputMode="decimal" className="input" /></Field>
          <Field label="Paid to / vendor"><input name="vendor" className="input" /></Field>
          <Field label="Paid by"><input name="paidBy" list="equipment-payers" className="input" /><datalist id="equipment-payers">{payers.map(p => <option key={p.name} value={p.name} />)}</datalist></Field>
          <div className="self-end"><SubmitButton>Add expense</SubmitButton></div>
          <p className="text-[12px] text-muted sm:col-span-2">Saved directly in Finance. If already recorded, link it below instead.</p>
        </ActionForm>
      </Section>
      <Section title="Link an existing expense" subtitle="Use a cost already recorded in Finance">
        {available.length ? <ActionForm action={linkEquipmentExpenseAction} className="grid gap-3 p-4" resetOnSuccess>
          <input type="hidden" name="equipmentId" value={id} />
          <Field label="Expense"><select name="transactionId" className="input" required defaultValue=""><option disabled value="">Choose an expense…</option>{available.map(t => <option value={t.id} key={t.id}>{fmtDate(t.date)} · {t.description ?? t.category} · {money(t.amount, settings.currency)}</option>)}</select></Field>
          <p className="text-[12px] text-muted">Only unlinked, manual farm-wide expenses appear. Linking keeps the existing category and amount.</p>
          <div><SubmitButton>Link expense</SubmitButton></div>
        </ActionForm> : <Empty title="No available expenses" hint="Record a new expense here, or add a farm-wide expense in Finance." />}
      </Section>
    </div>
    <Section title="Linked expenses" subtitle="Removing a link keeps the expense in Finance" action={<Link href="/finance#ledger" className="btn-ghost btn-sm">Finance ledger</Link>}>
      {!item.transactions.length ? <Empty title="No costs recorded yet" /> : <ul className="divide-y divide-line">{item.transactions.map(t => <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div><p className="font-medium">{t.description ?? t.category}</p><p className="text-[12px] text-muted">{fmtDate(t.date)} · {t.category}{t.vendor ? ` · ${t.vendor}` : ""}</p></div>
        <div className="flex items-center gap-3"><span className="font-semibold tabular-nums">{money(t.amount, settings.currency)}</span><RecordActions label="Expense link actions"><form action={unlinkEquipmentExpenseAction}>
          <input type="hidden" name="equipmentId" value={id} /><input type="hidden" name="transactionId" value={t.id} />
          <ConfirmSubmit className="record-delete-action" message="Unlink this expense? It stays in Finance but no longer counts toward this item's cost.">Unlink expense</ConfirmSubmit>
        </form></RecordActions></div>
      </li>)}</ul>}
    </Section>
  </>;
}
