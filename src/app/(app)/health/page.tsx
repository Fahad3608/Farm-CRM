import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getSettings } from "@/lib/settings";
import { Avatar, Badge, Card, Empty, PageHeader, Section } from "@/components/ui";
import Disclosure from "@/components/Disclosure";
import HealthRecordForm from "@/components/HealthRecordForm";
import { HEALTH_TYPE, SPECIES, VACCINE_SUGGESTIONS } from "@/lib/domain";
import { fmtDate, money, relativeDue } from "@/lib/format";
import { markFollowUpDoneAction } from "@/app/actions/health";

export const dynamic = "force-dynamic";

export default async function HealthPage({ searchParams }: { searchParams: Promise<{ type?: string; animal?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const settings = await getSettings();
  const showMoney = can.viewFinance(user.role);

  const [animals, records, due] = await Promise.all([
    prisma.animal.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, tagId: true, species: true },
      orderBy: { tagId: "asc" },
    }),
    prisma.healthRecord.findMany({
      where: {
        ...(sp.type && sp.type !== "ALL" ? { type: sp.type as never } : {}),
        ...(sp.animal ? { animalId: sp.animal } : {}),
      },
      orderBy: { date: "desc" },
      take: 200,
      include: { animal: { select: { id: true, name: true, tagId: true, species: true, profilePhotoId: true } }, vet: { select: { name: true } } },
    }),
    prisma.healthRecord.findMany({
      where: { followUpDone: false, nextDueDate: { not: null } },
      orderBy: { nextDueDate: "asc" },
      take: 25,
      include: { animal: { select: { id: true, name: true, tagId: true, species: true, profilePhotoId: true } } },
    }),
  ]);

  const animalOpts = animals.map((a) => ({ id: a.id, label: `${a.name} (${a.tagId})`, species: a.species }));
  const allSuggestions = [...new Set(Object.values(VACCINE_SUGGESTIONS).flat())];

  return (
    <>
      <PageHeader title="Health & veterinary" subtitle="Vaccinations, injections, treatments and vet visits" />

      {can.writeHealth(user.role) && (
        <div className="mb-4">
          <Disclosure label="Add health record">
            <Card className="p-4">
              <HealthRecordForm animals={animalOpts} vaccineSuggestions={allSuggestions} />
            </Card>
          </Disclosure>
        </div>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[1fr_360px]">
        <Section
          title="History"
          subtitle={`${records.length} records`}
          action={
            <form className="flex gap-2">
              <select name="type" defaultValue={sp.type ?? "ALL"} className="input w-auto py-1.5 text-[13px]">
                <option value="ALL">All types</option>
                {Object.entries(HEALTH_TYPE).map(([v, t]) => <option key={v} value={v}>{t.label}</option>)}
              </select>
              <button className="btn-ghost btn-sm">Filter</button>
            </form>
          }
        >
          {records.length === 0 ? (
            <Empty icon="💉" title="No health records yet" hint="Records added by you or your vet will appear here." />
          ) : (
            <ul>
              {records.map((r) => (
                <li key={r.id} className="border-t border-line px-4 py-3 first:border-t-0">
                  <div className="flex items-start gap-3">
                    <Link href={`/animals/${r.animal.id}?tab=health`} className="shrink-0">
                      <Avatar photoId={r.animal.profilePhotoId} name={r.animal.name} size={40} emoji={SPECIES[r.animal.species].emoji} />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={HEALTH_TYPE[r.type].tone}>{HEALTH_TYPE[r.type].label}</Badge>
                        <span className="font-medium">{r.title}</span>
                      </div>
                      <div className="mt-0.5 text-[13px] text-muted">
                        <Link href={`/animals/${r.animal.id}`} className="hover:underline">{r.animal.name} ({r.animal.tagId})</Link>
                        {" · "}{fmtDate(r.date)}
                        {r.medicine && ` · ${r.medicine}`}
                        {r.dosage && ` · ${r.dosage}`}
                        {(r.vet?.name || r.vetName) && ` · ${r.vet?.name ?? r.vetName}`}
                      </div>
                      {r.nextDueDate && (
                        <div className="mt-1"><Badge tone={r.followUpDone ? "good" : "warn"}>Next due {fmtDate(r.nextDueDate)}{r.followUpDone ? " · done" : ""}</Badge></div>
                      )}
                    </div>
                    {showMoney && (Number(r.medicineCost ?? 0) + Number(r.vetFee ?? 0) > 0) && (
                      <span className="shrink-0 tabular-nums text-[14px] font-semibold">
                        {money(Number(r.medicineCost ?? 0) + Number(r.vetFee ?? 0), settings.currency)}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Due & overdue" subtitle="Follow-ups and next doses">
          {due.length === 0 ? (
            <Empty icon="✅" title="Nothing outstanding" />
          ) : (
            <ul>
              {due.map((r) => (
                <li key={r.id} className="flex items-center gap-3 border-t border-line px-4 py-3 first:border-t-0">
                  <Avatar photoId={r.animal.profilePhotoId} name={r.animal.name} size={34} emoji={SPECIES[r.animal.species].emoji} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-medium">{r.title}</div>
                    <div className="truncate text-[12.5px] text-muted">{r.animal.name} · {relativeDue(r.nextDueDate)}</div>
                  </div>
                  <form action={markFollowUpDoneAction}>
                    <input type="hidden" name="id" value={r.id} />
                    <button className="btn-ghost btn-sm">Done</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </>
  );
}
