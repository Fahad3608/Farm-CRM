import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { Avatar, Badge, Card, Empty, PageHeader, Section, StatTile } from "@/components/ui";
import Disclosure from "@/components/Disclosure";
import BreedingForm from "@/components/BreedingForm";
import { BREEDING_METHOD_LABEL, BREEDING_STATUS_LABEL, SPECIES } from "@/lib/domain";
import { fmtDate, relativeDue } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function BreedingPage() {
  const user = await requireUser();
  const showMoney = can.viewFinance(user.role);

  const [animals, records, born12] = await Promise.all([
    prisma.animal.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, tagId: true, sex: true, species: true },
      orderBy: { tagId: "asc" },
    }),
    prisma.breedingRecord.findMany({
      orderBy: [{ status: "asc" }, { expectedDueDate: "asc" }],
      include: {
        dam: { select: { id: true, name: true, tagId: true, species: true, profilePhotoId: true } },
        sire: { select: { name: true, tagId: true } },
      },
    }),
    prisma.animal.count({
      where: { acquisition: "BORN_ON_FARM", dateJoined: { gte: new Date(Date.now() - 365 * 86400000) } },
    }),
  ]);

  const dams = animals.filter((a) => a.sex === "FEMALE").map((a) => ({ id: a.id, label: `${a.name} (${a.tagId})` }));
  const sires = animals.filter((a) => a.sex === "MALE").map((a) => ({ id: a.id, label: `${a.name} (${a.tagId})` }));

  const expecting = records.filter((r) => r.status === "BRED" || r.status === "CONFIRMED_PREGNANT");
  const past = records.filter((r) => r.status !== "BRED" && r.status !== "CONFIRMED_PREGNANT");

  return (
    <>
      <PageHeader title="Breeding & pregnancies" subtitle="Services, confirmations and expected deliveries" />

      <div className="mb-4 grid grid-cols-3 gap-3">
        <StatTile label="Expecting now" value={expecting.length} tone={expecting.length ? "brand" : "muted"} />
        <StatTile label="Due within 30 days" value={expecting.filter((r) => r.expectedDueDate && r.expectedDueDate <= new Date(Date.now() + 30 * 86400000)).length} tone="warn" />
        <StatTile label="Born on farm (12 mo)" value={born12} tone="good" />
      </div>

      {can.writeBreeding(user.role) && (
        <div className="mb-4">
          <Disclosure label="Add breeding record">
            <Card className="p-4"><BreedingForm dams={dams} sires={sires} showCost={showMoney} /></Card>
          </Disclosure>
        </div>
      )}

      <div className="grid gap-4">
        <Section title="Expecting" subtitle="Bred and confirmed pregnant">
          {expecting.length === 0 ? (
            <Empty icon="🍼" title="No active pregnancies" hint="Record a service date and the due date is calculated from the species' gestation period." />
          ) : (
            <ul>
              {expecting.map((r) => (
                <li key={r.id} className="border-t border-line first:border-t-0">
                  <Link href={`/animals/${r.dam.id}?tab=breeding`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface2/60">
                    <Avatar photoId={r.dam.profilePhotoId} name={r.dam.name} size={44} emoji={SPECIES[r.dam.species].emoji} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{r.dam.name} <span className="font-mono text-[12px] text-muted">{r.dam.tagId}</span></div>
                      <div className="truncate text-[13px] text-muted">
                        {BREEDING_METHOD_LABEL[r.method]} on {fmtDate(r.breedingDate)}
                        {r.sire ? ` · sire ${r.sire.name}` : r.sireName ? ` · sire ${r.sireName}` : ""}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <Badge tone={r.status === "CONFIRMED_PREGNANT" ? "brand" : "muted"}>{BREEDING_STATUS_LABEL[r.status]}</Badge>
                      {r.expectedDueDate && <div className="mt-1 text-[12.5px] text-muted">Due {fmtDate(r.expectedDueDate)} · {relativeDue(r.expectedDueDate)}</div>}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Past breeding records">
          {past.length === 0 ? (
            <Empty icon="📗" title="No completed records yet" />
          ) : (
            <div className="scroll-x">
              <table className="w-full min-w-[640px]">
                <thead><tr><th className="th">Mother</th><th className="th">Served</th><th className="th">Sire</th><th className="th">Outcome</th><th className="th">Delivered</th><th className="th">Young</th></tr></thead>
                <tbody>
                  {past.map((r) => (
                    <tr key={r.id} className="row">
                      <td className="td"><Link href={`/animals/${r.dam.id}?tab=breeding`} className="text-brand hover:underline">{r.dam.name}</Link></td>
                      <td className="td whitespace-nowrap">{fmtDate(r.breedingDate)}</td>
                      <td className="td">{r.sire?.name ?? r.sireName ?? "—"}</td>
                      <td className="td"><Badge tone={r.status === "DELIVERED" ? "good" : r.status === "ABORTED" ? "bad" : "muted"}>{BREEDING_STATUS_LABEL[r.status]}</Badge></td>
                      <td className="td whitespace-nowrap">{fmtDate(r.actualBirthDate)}</td>
                      <td className="td">{r.offspringCount ?? "—"}{r.offspringNotes ? ` · ${r.offspringNotes}` : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </div>
    </>
  );
}
