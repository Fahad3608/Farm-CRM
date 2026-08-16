import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { Avatar, Badge, Empty, PageHeader } from "@/components/ui";
import { Icon } from "@/components/icons";
import { SPECIES, STATUS_LABEL, lifeStage, REPRO_LABEL } from "@/lib/domain";
import { ageFrom, fmtDate } from "@/lib/format";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

type Search = { q?: string; species?: string; status?: string; stage?: string };

export default async function AnimalsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";

  const where: Prisma.AnimalWhereInput = {
    ...(sp.status && sp.status !== "ALL" ? { status: sp.status as never } : sp.status === "ALL" ? {} : { status: "ACTIVE" }),
    ...(sp.species && sp.species !== "ALL" ? { species: sp.species as never } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { tagId: { contains: q, mode: "insensitive" } },
            { breed: { contains: q, mode: "insensitive" } },
            { penOrLocation: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const animals = await prisma.animal.findMany({
    where,
    orderBy: [{ species: "asc" }, { tagId: "asc" }],
    select: {
      id: true, tagId: true, name: true, species: true, sex: true, breed: true, dateOfBirth: true,
      dateJoined: true, status: true, reproStatus: true, expectedDueDate: true, profilePhotoId: true,
      penOrLocation: true,
    },
  });

  const counts = await prisma.animal.groupBy({ by: ["species"], where: { status: "ACTIVE" }, _count: true });
  const shown = sp.stage === "young" ? animals.filter((a) => {
    const age = ageFrom(a.dateOfBirth);
    return age !== null && age.months < SPECIES[a.species].matureMonths;
  }) : animals;

  const qs = (patch: Partial<Search>) => {
    const p = new URLSearchParams({ ...(sp as Record<string, string>), ...patch } as Record<string, string>);
    for (const [k, v] of [...p.entries()]) if (!v) p.delete(k);
    return `/animals?${p.toString()}`;
  };

  return (
    <>
      <PageHeader
        title="Animals"
        subtitle={`${shown.length} shown · ${counts.reduce((s, c) => s + c._count, 0)} on the farm`}
        action={
          can.manageAnimals(user.role) ? (
            <Link href="/animals/new" className="btn-primary"><Icon.plus className="h-4 w-4" /> Add animal</Link>
          ) : null
        }
      />

      <form className="mb-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap" action="/animals">
        <div className="relative col-span-2 min-w-[180px] sm:flex-1">
          <Icon.search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input name="q" defaultValue={q} placeholder="Search name, tag, breed…" className="input pl-9" />
        </div>
        <select name="species" defaultValue={sp.species ?? "ALL"} className="input sm:w-auto">
          <option value="ALL">All species</option>
          {Object.entries(SPECIES).map(([v, s]) => <option key={v} value={v}>{s.emoji} {s.label}</option>)}
        </select>
        <select name="status" defaultValue={sp.status ?? "ACTIVE"} className="input sm:w-auto">
          <option value="ACTIVE">On farm</option>
          <option value="ALL">All statuses</option>
          <option value="SOLD">Sold</option>
          <option value="DECEASED">Deceased</option>
          <option value="CULLED">Culled</option>
        </select>
        <select name="stage" defaultValue={sp.stage ?? ""} className="input sm:w-auto">
          <option value="">Any age</option>
          <option value="young">Young only (calves / kids)</option>
        </select>
        <button className="btn-ghost">Filter</button>
      </form>

      {counts.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          <Link href={qs({ species: "ALL" })} className="chip hover:bg-surface2">All · {counts.reduce((s, c) => s + c._count, 0)}</Link>
          {counts.map((c) => (
            <Link key={c.species} href={qs({ species: c.species })} className="chip hover:bg-surface2">
              {SPECIES[c.species].emoji} {SPECIES[c.species].label} · {c._count}
            </Link>
          ))}
        </div>
      )}

      {shown.length === 0 ? (
        <div className="card">
          <Empty
            icon="🐄"
            title="No animals match this view"
            hint="Try clearing the filters, or add your first animal to get started."
            action={can.manageAnimals(user.role) ? <Link href="/animals/new" className="btn-primary btn-sm">Add animal</Link> : undefined}
          />
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((a) => {
            const age = ageFrom(a.dateOfBirth);
            const stage = lifeStage(a.species, a.sex, a.dateOfBirth);
            return (
              <li key={a.id}>
                <Link href={`/animals/${a.id}`} className="card flex h-full items-center gap-3 p-3 transition-colors hover:bg-surface2/60">
                  <Avatar photoId={a.profilePhotoId} name={a.name} size={60} emoji={SPECIES[a.species].emoji} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-semibold">{a.name}</span>
                      <span className="shrink-0 font-mono text-[11.5px] text-muted">{a.tagId}</span>
                    </div>
                    <div className="mt-0.5 truncate text-[13px] text-muted">
                      {stage}{a.breed ? ` · ${a.breed}` : ""}{age ? ` · ${age.label}` : " · age unknown"}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {a.status !== "ACTIVE" && <Badge tone="muted">{STATUS_LABEL[a.status]}</Badge>}
                      {a.reproStatus === "PREGNANT" && (
                        <Badge tone="brand">Pregnant{a.expectedDueDate ? ` · due ${fmtDate(a.expectedDueDate)}` : ""}</Badge>
                      )}
                      {a.reproStatus === "LACTATING" && <Badge tone="good">{REPRO_LABEL.LACTATING}</Badge>}
                      {a.penOrLocation && <Badge>{a.penOrLocation}</Badge>}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
