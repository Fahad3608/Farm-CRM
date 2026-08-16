import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Avatar, Badge, Card, Empty, PageHeader, Section, StatTile } from "@/components/ui";
import Disclosure from "@/components/Disclosure";
import HealthRecordForm from "@/components/HealthRecordForm";
import BreedingForm from "@/components/BreedingForm";
import { HEALTH_TYPE, SPECIES, VACCINE_SUGGESTIONS } from "@/lib/domain";
import { ageFrom, fmtDate, relativeDue } from "@/lib/format";
import { markFollowUpDoneAction } from "@/app/actions/health";

export const dynamic = "force-dynamic";

/**
 * The veterinarian's home screen. Deliberately narrow: animals, health and
 * breeding only — no finances, no purchase or sale prices anywhere.
 */
export default async function VetPage() {
  const user = await requireUser();
  if (user.role !== "VET") redirect("/dashboard");

  const in30 = new Date(Date.now() + 30 * 86400000);

  const [animals, due, mine, pregnant] = await Promise.all([
    prisma.animal.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, tagId: true, species: true, sex: true, dateOfBirth: true, profilePhotoId: true, reproStatus: true },
      orderBy: { tagId: "asc" },
    }),
    prisma.healthRecord.findMany({
      where: { followUpDone: false, nextDueDate: { not: null, lte: in30 } },
      orderBy: { nextDueDate: "asc" },
      include: { animal: { select: { id: true, name: true, tagId: true, species: true, profilePhotoId: true } } },
    }),
    prisma.healthRecord.findMany({
      where: { OR: [{ vetId: user.id }, { createdById: user.id }] },
      orderBy: { date: "desc" },
      take: 12,
      include: { animal: { select: { id: true, name: true, tagId: true, species: true, profilePhotoId: true } } },
    }),
    prisma.animal.count({ where: { status: "ACTIVE", reproStatus: { in: ["PREGNANT", "BRED"] } } }),
  ]);

  const opts = animals.map((a) => ({ id: a.id, label: `${a.name} (${a.tagId})`, species: a.species }));
  const dams = animals.filter((a) => a.sex === "FEMALE").map((a) => ({ id: a.id, label: `${a.name} (${a.tagId})` }));
  const sires = animals.filter((a) => a.sex === "MALE").map((a) => ({ id: a.id, label: `${a.name} (${a.tagId})` }));
  const allSuggestions = [...new Set(Object.values(VACCINE_SUGGESTIONS).flat())];

  return (
    <>
      <PageHeader title="Veterinary queue" subtitle={`Signed in as ${user.name} — you can add health and breeding records.`} />

      <div className="mb-4 grid grid-cols-3 gap-3">
        <StatTile label="Animals" value={animals.length} href="/animals" />
        <StatTile label="Due / overdue" value={due.length} tone={due.length ? "warn" : "muted"} />
        <StatTile label="Expecting" value={pregnant} tone={pregnant ? "brand" : "muted"} href="/breeding" />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Disclosure label="New health record">
          <Card className="p-4"><HealthRecordForm animals={opts} vaccineSuggestions={allSuggestions} /></Card>
        </Disclosure>
        <Disclosure label="New breeding record" tone="ghost">
          <Card className="p-4"><BreedingForm dams={dams} sires={sires} showCost={false} /></Card>
        </Disclosure>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Section title="Due & overdue" subtitle="Next doses and follow-ups within 30 days">
          {due.length === 0 ? (
            <Empty icon="✅" title="Nothing outstanding" hint="Follow-up dates set on records appear here." />
          ) : (
            <ul>
              {due.map((r) => (
                <li key={r.id} className="flex items-center gap-3 border-t border-line px-4 py-3 first:border-t-0">
                  <Avatar photoId={r.animal.profilePhotoId} name={r.animal.name} size={36} emoji={SPECIES[r.animal.species].emoji} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/animals/${r.animal.id}?tab=health`} className="block truncate text-[14px] font-medium hover:underline">{r.title}</Link>
                    <div className="truncate text-[12.5px] text-muted">{r.animal.name} ({r.animal.tagId}) · {fmtDate(r.nextDueDate)}</div>
                  </div>
                  <Badge tone={r.nextDueDate && r.nextDueDate < new Date() ? "bad" : "warn"} className="shrink-0">{relativeDue(r.nextDueDate)}</Badge>
                  <form action={markFollowUpDoneAction}>
                    <input type="hidden" name="id" value={r.id} />
                    <button className="btn-ghost btn-sm">Done</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Your recent entries">
          {mine.length === 0 ? (
            <Empty icon="📝" title="No records from you yet" hint="Use “New health record” above to add your first one." />
          ) : (
            <ul>
              {mine.map((r) => (
                <li key={r.id} className="border-t border-line first:border-t-0">
                  <Link href={`/animals/${r.animal.id}?tab=health`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface2/60">
                    <Avatar photoId={r.animal.profilePhotoId} name={r.animal.name} size={36} emoji={SPECIES[r.animal.species].emoji} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14px] font-medium">{r.title}</div>
                      <div className="truncate text-[12.5px] text-muted">{r.animal.name} · {fmtDate(r.date)}</div>
                    </div>
                    <Badge tone={HEALTH_TYPE[r.type].tone}>{HEALTH_TYPE[r.type].label}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Animals on the farm" className="lg:col-span-2">
          <ul className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
            {animals.map((a) => {
              const age = ageFrom(a.dateOfBirth);
              return (
                <li key={a.id}>
                  <Link href={`/animals/${a.id}?tab=health`} className="flex items-center gap-3 rounded-xl border border-line p-2.5 hover:bg-surface2/60">
                    <Avatar photoId={a.profilePhotoId} name={a.name} size={42} emoji={SPECIES[a.species].emoji} />
                    <div className="min-w-0">
                      <div className="truncate text-[14px] font-medium">{a.name} <span className="font-mono text-[11.5px] text-muted">{a.tagId}</span></div>
                      <div className="truncate text-[12.5px] text-muted">{SPECIES[a.species].label}{age ? ` · ${age.label}` : ""}</div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Section>
      </div>
    </>
  );
}
