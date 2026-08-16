import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getSettings } from "@/lib/settings";
import { Avatar, Badge, Empty, PageHeader, Section, StatTile } from "@/components/ui";
import { BarList, IncomeExpenseChart } from "@/components/charts";
import { SPECIES, HEALTH_TYPE } from "@/lib/domain";
import { ageFrom, fmtDate, money, num, relativeDue } from "@/lib/format";
import { Icon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const user = await requireUser();
  if (user.role === "VET") redirect("/vet");

  const settings = await getSettings();
  const showMoney = can.viewFinance(user.role);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const in30 = new Date(now.getTime() + 30 * 86400000);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const [bySpecies, active, pregnant, dueFollowUps, dueBirths, recentHealth, monthTxns, txnRange, milkMonth] =
    await Promise.all([
      prisma.animal.groupBy({ by: ["species"], where: { status: "ACTIVE" }, _count: true }),
      prisma.animal.findMany({
        where: { status: "ACTIVE" },
        select: { id: true, species: true, sex: true, dateOfBirth: true },
      }),
      prisma.animal.findMany({
        where: { status: "ACTIVE", reproStatus: { in: ["PREGNANT", "BRED"] } },
        select: { id: true, name: true, tagId: true, species: true, expectedDueDate: true, profilePhotoId: true, reproStatus: true },
        orderBy: { expectedDueDate: "asc" },
      }),
      prisma.healthRecord.findMany({
        where: { followUpDone: false, nextDueDate: { not: null, lte: in30 } },
        include: { animal: { select: { id: true, name: true, tagId: true, species: true, profilePhotoId: true } } },
        orderBy: { nextDueDate: "asc" },
        take: 8,
      }),
      prisma.breedingRecord.count({ where: { status: { in: ["BRED", "CONFIRMED_PREGNANT"] }, expectedDueDate: { lte: in30 } } }),
      prisma.healthRecord.findMany({
        orderBy: { date: "desc" },
        take: 6,
        include: { animal: { select: { id: true, name: true, tagId: true, species: true, profilePhotoId: true } } },
      }),
      showMoney
        ? prisma.transaction.groupBy({ by: ["type"], where: { date: { gte: monthStart } }, _sum: { amount: true } })
        : Promise.resolve([]),
      showMoney
        ? prisma.transaction.findMany({ where: { date: { gte: sixMonthsAgo } }, select: { date: true, type: true, amount: true, category: true } })
        : Promise.resolve([]),
      prisma.milkRecord.aggregate({ where: { date: { gte: monthStart } }, _sum: { litres: true } }),
    ]);

  const totalActive = active.length;
  const young = active.filter((a) => {
    const age = ageFrom(a.dateOfBirth);
    return age !== null && age.months < SPECIES[a.species].matureMonths;
  }).length;

  const income = Number(monthTxns.find((t) => t.type === "INCOME")?._sum.amount ?? 0);
  const expense = Number(monthTxns.find((t) => t.type === "EXPENSE")?._sum.amount ?? 0);

  // Last 6 months, oldest first.
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return { key: `${d.getFullYear()}-${d.getMonth()}`, month: d.toLocaleDateString(undefined, { month: "short", year: "2-digit" }), income: 0, expense: 0 };
  });
  const byKey = new Map(months.map((m) => [m.key, m]));
  for (const t of txnRange) {
    const d = new Date(t.date);
    const m = byKey.get(`${d.getFullYear()}-${d.getMonth()}`);
    if (m) m[t.type === "INCOME" ? "income" : "expense"] += Number(t.amount);
  }

  const expenseByCategory = new Map<string, number>();
  for (const t of txnRange) {
    if (t.type !== "EXPENSE" || new Date(t.date) < monthStart) continue;
    expenseByCategory.set(t.category, (expenseByCategory.get(t.category) ?? 0) + Number(t.amount));
  }

  return (
    <>
      <PageHeader
        title={`Good day, ${user.name.split(" ")[0]}`}
        subtitle={settings.farmName}
        action={can.manageAnimals(user.role) ? <Link href="/animals/new" className="btn-primary"><Icon.plus className="h-4 w-4" /> Add animal</Link> : undefined}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Animals on farm" value={totalActive} hint={`${young} young · ${totalActive - young} adult`} href="/animals" />
        <StatTile label="Expecting" value={pregnant.length} hint={dueBirths ? `${dueBirths} due within 30 days` : "No births due soon"} href="/breeding" tone={pregnant.length ? "brand" : "muted"} />
        <StatTile label="Health follow-ups" value={dueFollowUps.length} hint="Due in the next 30 days" href="/health" tone={dueFollowUps.length ? "warn" : "muted"} />
        {showMoney ? (
          <StatTile
            label="This month's net"
            value={money(income - expense, settings.currency)}
            hint={`${money(income, settings.currency)} in · ${money(expense, settings.currency)} out`}
            tone={income - expense >= 0 ? "good" : "bad"}
            href="/finance"
          />
        ) : (
          <StatTile label="Milk this month" value={`${num(milkMonth._sum.litres, 1)} L`} hint="All animals" />
        )}
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Section title="Herd composition" subtitle="Animals currently on the farm">
          <BarList
            items={bySpecies
              .map((s) => ({ label: `${SPECIES[s.species].emoji} ${SPECIES[s.species].label}`, value: s._count, display: String(s._count) }))
              .sort((a, b) => b.value - a.value)}
            emptyText="No animals added yet."
          />
        </Section>

        {showMoney ? (
          <Section title="Income vs expenses" subtitle="Last 6 months">
            <IncomeExpenseChart data={months} currency={settings.currency} />
          </Section>
        ) : (
          <Section title="Recent health activity">
            <RecentHealth items={recentHealth} />
          </Section>
        )}

        <Section
          title="Coming up: vaccinations & follow-ups"
          action={<Link href="/health" className="text-[13px] text-brand hover:underline">All health</Link>}
        >
          {dueFollowUps.length === 0 ? (
            <Empty icon="✅" title="Nothing due in the next 30 days" hint="Follow-up dates you set on health records appear here." />
          ) : (
            <ul>
              {dueFollowUps.map((r) => (
                <li key={r.id} className="border-t border-line first:border-t-0">
                  <Link href={`/animals/${r.animal.id}?tab=health`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface2/60">
                    <Avatar photoId={r.animal.profilePhotoId} name={r.animal.name} size={38} emoji={SPECIES[r.animal.species].emoji} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14px] font-medium">{r.title}</div>
                      <div className="truncate text-[13px] text-muted">{r.animal.name} ({r.animal.tagId}) · {fmtDate(r.nextDueDate)}</div>
                    </div>
                    <Badge tone={(r.nextDueDate && r.nextDueDate < now) ? "bad" : "warn"}>{relativeDue(r.nextDueDate)}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Expecting mothers" action={<Link href="/breeding" className="text-[13px] text-brand hover:underline">Breeding</Link>}>
          {pregnant.length === 0 ? (
            <Empty icon="🍼" title="No pregnancies recorded" hint="Add a breeding record and the due date is worked out for you." />
          ) : (
            <ul>
              {pregnant.map((a) => (
                <li key={a.id} className="border-t border-line first:border-t-0">
                  <Link href={`/animals/${a.id}?tab=breeding`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface2/60">
                    <Avatar photoId={a.profilePhotoId} name={a.name} size={38} emoji={SPECIES[a.species].emoji} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14px] font-medium">{a.name} <span className="font-mono text-[12px] text-muted">{a.tagId}</span></div>
                      <div className="truncate text-[13px] text-muted">
                        {a.expectedDueDate ? `Due ${fmtDate(a.expectedDueDate)}` : "Awaiting confirmation"}
                      </div>
                    </div>
                    {a.expectedDueDate && <Badge tone="brand">{relativeDue(a.expectedDueDate)}</Badge>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {showMoney && (
          <>
            <Section title="This month's spending" subtitle="By category">
              <BarList
                items={[...expenseByCategory.entries()]
                  .map(([label, value]) => ({ label, value, display: money(value, settings.currency) }))
                  .sort((a, b) => b.value - a.value)}
                emptyText="No expenses this month."
              />
            </Section>
            <Section title="Recent health activity" action={<Link href="/health" className="text-[13px] text-brand hover:underline">All</Link>}>
              <RecentHealth items={recentHealth} />
            </Section>
          </>
        )}
      </div>
    </>
  );
}

function RecentHealth({
  items,
}: {
  items: { id: string; title: string; date: Date; type: keyof typeof HEALTH_TYPE; animal: { id: string; name: string; tagId: string; species: keyof typeof SPECIES; profilePhotoId: string | null } }[];
}) {
  if (!items.length) return <Empty icon="💉" title="No health records yet" />;
  return (
    <ul>
      {items.map((r) => (
        <li key={r.id} className="border-t border-line first:border-t-0">
          <Link href={`/animals/${r.animal.id}?tab=health`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface2/60">
            <Avatar photoId={r.animal.profilePhotoId} name={r.animal.name} size={38} emoji={SPECIES[r.animal.species].emoji} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-medium">{r.title}</div>
              <div className="truncate text-[13px] text-muted">{r.animal.name} · {fmtDate(r.date)}</div>
            </div>
            <Badge tone={HEALTH_TYPE[r.type].tone}>{HEALTH_TYPE[r.type].label}</Badge>
          </Link>
        </li>
      ))}
    </ul>
  );
}
