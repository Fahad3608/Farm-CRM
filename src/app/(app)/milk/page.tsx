import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getSettings } from "@/lib/settings";
import { Avatar, Card, Empty, PageHeader, Section, StatTile } from "@/components/ui";
import Disclosure from "@/components/Disclosure";
import { BarList } from "@/components/charts";
import { SPECIES } from "@/lib/domain";
import { fmtDate, money, num } from "@/lib/format";
import { AddMilkForm } from "@/components/LogForms";
import { Icon } from "@/components/icons";
import { deleteLogAction } from "@/app/actions/logs";

export const dynamic = "force-dynamic";

export default async function MilkPage() {
  const user = await requireUser();
  if (user.role === "VET") redirect("/vet");

  const settings = await getSettings();
  const showMoney = can.viewFinance(user.role);
  const milkRate = Number(settings.milkRate) || 0;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 86400000 - 1);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const [
    todayRecords,
    monthTotal,
    monthByAnimal,
    sixMonthRecords,
    recentLogs,
    milkingAnimals,
  ] = await Promise.all([
    prisma.milkRecord.findMany({
      where: { date: { gte: todayStart, lte: todayEnd } },
      include: { animal: { select: { id: true, name: true, tagId: true, species: true, profilePhotoId: true } } },
      orderBy: [{ session: "asc" }, { animal: { name: "asc" } }],
    }),
    prisma.milkRecord.aggregate({
      where: { date: { gte: monthStart } },
      _sum: { litres: true },
      _count: true,
    }),
    prisma.milkRecord.groupBy({
      by: ["animalId"],
      where: { date: { gte: monthStart } },
      _sum: { litres: true },
    }),
    prisma.milkRecord.findMany({
      where: { date: { gte: sixMonthsAgo } },
      select: { date: true, litres: true },
    }),
    prisma.milkRecord.findMany({
      orderBy: { date: "desc" },
      take: 50,
      include: { animal: { select: { id: true, name: true, tagId: true, species: true } } },
    }),
    prisma.animal.findMany({
      where: { status: "ACTIVE", sex: "FEMALE", species: { in: ["COW", "BUFFALO", "GOAT", "SHEEP"] } },
      select: { id: true, name: true, tagId: true, species: true, profilePhotoId: true, reproStatus: true },
      orderBy: { tagId: "asc" },
    }),
  ]);

  const todayLitres = todayRecords.reduce((s, r) => s + Number(r.litres), 0);
  const todayAM = todayRecords.filter((r) => r.session === "AM").reduce((s, r) => s + Number(r.litres), 0);
  const todayPM = todayRecords.filter((r) => r.session === "PM").reduce((s, r) => s + Number(r.litres), 0);
  const monthLitres = Number(monthTotal._sum.litres ?? 0);
  const monthRevenue = monthLitres * milkRate;

  // Monthly operational cost for profit calc
  let monthFeedCost = 0;
  if (showMoney) {
    const feedExpense = await prisma.transaction.aggregate({
      where: { type: "EXPENSE", date: { gte: monthStart }, category: { in: ["Feed", "Chaara (Green Fodder)", "Wanda / Khal"] } },
      _sum: { amount: true },
    });
    monthFeedCost = Number(feedExpense._sum.amount ?? 0);
  }

  // Per-animal breakdown
  const animalMap = new Map(milkingAnimals.map((a) => [a.id, a]));
  const perAnimalMilk = monthByAnimal
    .map((r) => {
      const a = animalMap.get(r.animalId);
      return {
        id: r.animalId,
        name: a ? `${a.name} (${a.tagId})` : r.animalId,
        litres: Number(r._sum.litres ?? 0),
        emoji: a ? SPECIES[a.species].emoji : "",
        profilePhotoId: a?.profilePhotoId ?? null,
      };
    })
    .sort((a, b) => b.litres - a.litres);

  // 6-month trend
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return {
      key: `${d.getFullYear()}-${d.getMonth()}`,
      month: d.toLocaleDateString(undefined, { month: "short", year: "2-digit" }),
      litres: 0,
    };
  });
  const byKey = new Map(months.map((m) => [m.key, m]));
  for (const r of sixMonthRecords) {
    const d = new Date(r.date);
    const m = byKey.get(`${d.getFullYear()}-${d.getMonth()}`);
    if (m) m.litres += Number(r.litres);
  }

  return (
    <>
      <PageHeader title="Milk" subtitle="Daily collection, monthly production and revenue" />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Today"
          value={`${num(todayLitres, 1)} L`}
          hint={`AM: ${num(todayAM, 1)} L · PM: ${num(todayPM, 1)} L`}
          tone="brand"
        />
        <StatTile
          label="This month"
          value={`${num(monthLitres, 1)} L`}
          hint={`${monthTotal._count} entries`}
        />
        {showMoney && (
          <>
            <StatTile
              label="Monthly revenue (est.)"
              value={money(monthRevenue, settings.currency)}
              hint={`@ ${money(milkRate, settings.currency)} / litre`}
              tone="good"
            />
            <StatTile
              label="Milk profit (est.)"
              value={money(monthRevenue - monthFeedCost, settings.currency)}
              hint={`Revenue − feed cost (${money(monthFeedCost, settings.currency)})`}
              tone={monthRevenue - monthFeedCost >= 0 ? "good" : "bad"}
            />
          </>
        )}
        {!showMoney && (
          <StatTile
            label="Milking animals"
            value={milkingAnimals.filter((a) => a.reproStatus === "LACTATING").length}
            hint={`${milkingAnimals.length} total females`}
          />
        )}
      </div>

      <div className="mb-4">
        <Disclosure label="Record milk">
          <Card className="p-4">
            <p className="mb-3 text-[13px] text-muted">Pick an animal and enter litres — or go to each animal's page to record there.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {milkingAnimals.slice(0, 12).map((a) => (
                <div key={a.id} className="rounded-xl border border-line p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <Avatar photoId={a.profilePhotoId} name={a.name} size={28} emoji={SPECIES[a.species].emoji} />
                    <span className="text-[14px] font-medium">{a.name}</span>
                    <span className="text-[12px] text-muted">{a.tagId}</span>
                  </div>
                  <AddMilkForm animalId={a.id} />
                </div>
              ))}
            </div>
            {milkingAnimals.length > 12 && (
              <p className="mt-3 text-[13px] text-muted">Showing first 12 animals. Record for others on their individual pages.</p>
            )}
            {milkingAnimals.length === 0 && (
              <Empty icon="🥛" title="No female cattle/goats on farm" hint="Add cows, buffaloes, goats or sheep to see them here." />
            )}
          </Card>
        </Disclosure>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Section title="Today's collection" subtitle={fmtDate(now)}>
          {todayRecords.length === 0 ? (
            <Empty icon="🥛" title="No milk recorded today" hint="Use the form above to record AM and PM collections." />
          ) : (
            <ul>
              {todayRecords.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 border-t border-line px-4 py-2.5 first:border-t-0">
                  <div className="flex items-center gap-2.5">
                    <Avatar photoId={r.animal.profilePhotoId} name={r.animal.name} size={32} emoji={SPECIES[r.animal.species].emoji} />
                    <div>
                      <Link href={`/animals/${r.animal.id}?tab=growth`} className="text-[14px] font-medium hover:text-brand">{r.animal.name}</Link>
                      <div className="text-[12px] text-muted">{r.session} · {r.animal.tagId}</div>
                    </div>
                  </div>
                  <span className="tabular-nums text-[15px] font-semibold">{num(r.litres, 2)} L</span>
                </li>
              ))}
              <li className="flex items-center justify-between gap-3 border-t border-line bg-surface2/40 px-4 py-2.5 font-semibold">
                <span>Total</span>
                <span className="tabular-nums text-[15px]">{num(todayLitres, 1)} L{showMoney && milkRate > 0 ? ` · ${money(todayLitres * milkRate, settings.currency)}` : ""}</span>
              </li>
            </ul>
          )}
        </Section>

        <Section title="Production this month" subtitle="By animal — highest producer first">
          <BarList
            items={perAnimalMilk.map((a) => ({
              label: a.name,
              value: a.litres,
              display: `${num(a.litres, 1)} L${showMoney && milkRate > 0 ? ` · ${money(a.litres * milkRate, settings.currency)}` : ""}`,
            }))}
            emptyText="No milk recorded this month."
          />
        </Section>

        <Section title="Monthly trend" subtitle="Last 6 months" className="lg:col-span-2">
          <BarList
            items={months.map((m) => ({
              label: m.month,
              value: m.litres,
              display: `${num(m.litres, 1)} L${showMoney && milkRate > 0 ? ` · ${money(m.litres * milkRate, settings.currency)}` : ""}`,
            }))}
            emptyText="No milk records yet."
          />
        </Section>

        <Section title="Recent entries" subtitle="Last 50 records" className="lg:col-span-2">
          {recentLogs.length === 0 ? (
            <Empty icon="🥛" title="No milk recorded yet" />
          ) : (
            <div className="scroll-x">
              <table className="w-full min-w-[480px]">
                <thead><tr><th className="th">Date</th><th className="th">Animal</th><th className="th">Session</th><th className="th">Litres</th>{showMoney && <th className="th">Value</th>}<th className="th"></th></tr></thead>
                <tbody>
                  {recentLogs.map((l) => (
                    <tr key={l.id} className="row">
                      <td className="td whitespace-nowrap">{fmtDate(l.date)}</td>
                      <td className="td">
                        <Link href={`/animals/${l.animal.id}?tab=growth`} className="text-brand hover:underline">{l.animal.name}</Link>
                      </td>
                      <td className="td">{l.session}</td>
                      <td className="td tabular-nums">{num(l.litres, 2)} L</td>
                      {showMoney && <td className="td tabular-nums text-muted">{milkRate > 0 ? money(Number(l.litres) * milkRate, settings.currency) : "—"}</td>}
                      <td className="td text-right">
                        <form action={deleteLogAction}>
                          <input type="hidden" name="kind" value="milk" />
                          <input type="hidden" name="id" value={l.id} />
                          <input type="hidden" name="animalId" value={l.animal.id} />
                          <button className="rounded-lg p-1.5 text-muted hover:text-bad"><Icon.trash className="h-4 w-4" /></button>
                        </form>
                      </td>
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
