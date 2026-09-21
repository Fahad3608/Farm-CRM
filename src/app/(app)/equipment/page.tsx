import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getSettings } from "@/lib/settings";
import { money } from "@/lib/format";
import { EQUIPMENT_KIND, EQUIPMENT_STATUS } from "@/lib/equipment";
import { Badge, Card, Empty, PageHeader, StatTile } from "@/components/ui";
import Disclosure from "@/components/Disclosure";
import EquipmentForm from "@/components/EquipmentForm";

export const dynamic = "force-dynamic";
export default async function EquipmentPage() {
  const user = await requireUser();
  if (!can.viewFinance(user.role)) redirect("/dashboard");
  const [settings, items, costs] = await Promise.all([
    getSettings(), prisma.equipment.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.transaction.groupBy({ by: ["equipmentId"], where: { equipmentId: { not: null }, type: "EXPENSE" }, _sum: { amount: true } }),
  ]);
  const totals = new Map(costs.map(c => [c.equipmentId, Number(c._sum.amount ?? 0)]));
  return <>
    <PageHeader title="Equipment & construction" subtitle="What we are building for the farm and what it has cost" action={<Link className="btn-ghost btn-sm" href="/finance">View Finance</Link>} />
    <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Object.entries(EQUIPMENT_STATUS).map(([key, label]) => <StatTile key={key} label={label} value={items.filter(i => i.status === key).length} />)}
      <StatTile label="Recorded costs" value={money([...totals.values()].reduce((sum, amount) => sum + amount, 0), settings.currency)} hint="Linked expenses · all time" />
    </div>
    <div className="mb-5"><Disclosure label="Add equipment or construction"><Card className="p-4"><EquipmentForm /></Card></Disclosure></div>
    {items.length === 0 ? <Card><Empty title="No items tracked yet" hint="Add equipment you are making or construction work, then record or link its expenses." /></Card> : <div className="grid gap-4 sm:grid-cols-2">
      {items.map(item => <Link key={item.id} href={`/equipment/${item.id}`} className="card block p-4 hover:border-brand">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="h2">{item.name}</h2><Badge tone={item.status === "COMPLETED" ? "good" : item.status === "IN_PROGRESS" ? "brand" : "muted"}>{EQUIPMENT_STATUS[item.status]}</Badge></div>
        <p className="mt-1 text-[13px] text-muted">{EQUIPMENT_KIND[item.kind]}{item.location ? ` · ${item.location}` : ""}</p>
        {item.notes && <p className="mt-2 line-clamp-2 text-[14px]">{item.notes}</p>}
        <p className="mt-4 font-semibold">{money(totals.get(item.id) ?? 0, settings.currency)} <span className="text-[12px] font-normal text-muted">recorded cost</span></p>
        <span className="mt-2 block text-[13px] text-brand">View item and expenses →</span>
      </Link>)}
    </div>}
  </>;
}
