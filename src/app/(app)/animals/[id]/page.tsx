import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getSettings } from "@/lib/settings";
import { Avatar, Badge, Card, Empty, Section } from "@/components/ui";
import { Icon } from "@/components/icons";
import Tabs from "@/components/Tabs";
import Disclosure from "@/components/Disclosure";
import ConfirmSubmit from "@/components/ConfirmSubmit";
import PhotoUploader from "@/components/PhotoUploader";
import HealthRecordForm from "@/components/HealthRecordForm";
import BreedingForm from "@/components/BreedingForm";
import FeedLogForm from "@/components/FeedLogForm";
import { AddMilkForm, AddWeightForm, SaleForm } from "@/components/LogForms";
import { BarList } from "@/components/charts";
import {
  ACQUISITION_LABEL, BREEDING_METHOD_LABEL, BREEDING_STATUS_LABEL, HEALTH_TYPE,
  REPRO_LABEL, SPECIES, STATUS_LABEL, VACCINE_SUGGESTIONS, lifeStage,
} from "@/lib/domain";
import { ageFrom, fmtDate, money, num, relativeDue } from "@/lib/format";
import { deletePhotoAction, setProfilePhotoAction, deleteAnimalAction } from "@/app/actions/animals";
import { deleteHealthRecordAction } from "@/app/actions/health";
import { deleteLogAction } from "@/app/actions/logs";
import { deleteBreedingAction } from "@/app/actions/breeding";

export const dynamic = "force-dynamic";

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="border-b border-line px-4 py-2.5 last:border-b-0 sm:border-b-0">
      <dt className="text-[12px] uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 text-[14.5px]">{value ?? "—"}</dd>
    </div>
  );
}

export default async function AnimalPage({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const tab = (await searchParams).tab ?? "overview";
  const settings = await getSettings();
  const showMoney = can.viewFinance(user.role);

  const animal = await prisma.animal.findUnique({
    where: { id },
    include: {
      mother: { select: { id: true, name: true, tagId: true } },
      father: { select: { id: true, name: true, tagId: true } },
      damOf: { select: { id: true, name: true, tagId: true, dateOfBirth: true }, orderBy: { dateOfBirth: "desc" } },
      photos: { orderBy: { createdAt: "desc" }, select: { id: true, caption: true, createdAt: true } },
      healthRecords: { orderBy: { date: "desc" }, include: { vet: { select: { name: true } } } },
      weights: { orderBy: { date: "desc" }, take: 30 },
      milkRecords: { orderBy: { date: "desc" }, take: 30 },
      breedingAsDam: { orderBy: { breedingDate: "desc" }, include: { sire: { select: { name: true, tagId: true } } } },
      feedLogs: { orderBy: { date: "desc" }, take: 60, include: { feedType: { select: { name: true, unit: true } } } },
    },
  });
  if (!animal) notFound();

  const sp = SPECIES[animal.species];
  const age = ageFrom(animal.dateOfBirth, animal.exitDate);
  const stage = lifeStage(animal.species, animal.sex, animal.dateOfBirth);

  const [spend, earned, feedByType, allAnimals] = await Promise.all([
    prisma.transaction.groupBy({ by: ["category"], where: { animalId: id, type: "EXPENSE" }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { animalId: id, type: "INCOME" }, _sum: { amount: true } }),
    prisma.feedLog.groupBy({ by: ["feedTypeId"], where: { animalId: id }, _sum: { quantity: true, totalCost: true } }),
    prisma.animal.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true, tagId: true, sex: true, species: true }, orderBy: { tagId: "asc" } }),
  ]);

  const feedTypes = await prisma.feedType.findMany({ where: { active: true }, orderBy: { name: "asc" } });
  const feedNameById = new Map(feedTypes.map((f) => [f.id, f]));

  const totalSpent = spend.reduce((s, r) => s + Number(r._sum.amount ?? 0), 0);
  const totalEarned = Number(earned._sum.amount ?? 0);
  const dueSoon = animal.healthRecords.filter((r) => r.nextDueDate && !r.followUpDone);

  const opt = (a: { id: string; name: string; tagId: string; species: string }) => ({ id: a.id, label: `${a.name} (${a.tagId})`, species: a.species });
  const dams = allAnimals.filter((a) => a.sex === "FEMALE").map(opt);
  const sires = allAnimals.filter((a) => a.sex === "MALE").map(opt);

  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "health", label: "Health", count: animal.healthRecords.length },
    { key: "feed", label: "Feed", count: animal.feedLogs.length },
    ...(animal.sex === "FEMALE" ? [{ key: "breeding", label: "Breeding", count: animal.breedingAsDam.length }] : []),
    { key: "growth", label: "Growth & milk", count: animal.weights.length + animal.milkRecords.length },
    { key: "photos", label: "Photos", count: animal.photos.length },
    ...(showMoney ? [{ key: "costs", label: "Costs" }] : []),
  ];

  return (
    <>
      <Link href="/animals" className="mb-3 inline-flex items-center gap-1.5 text-[13.5px] text-muted hover:text-ink">
        <Icon.back className="h-4 w-4" /> All animals
      </Link>

      <header className="mb-5 flex flex-wrap items-start gap-4">
        <Avatar photoId={animal.profilePhotoId} name={animal.name} size={92} emoji={sp.emoji} />
        <div className="min-w-0 flex-1">
          <h1 className="h1">{animal.name}</h1>
          <p className="mt-0.5 text-[14px] text-muted">
            <span className="font-mono">{animal.tagId}</span> · {sp.label} · {stage}
            {animal.breed ? ` · ${animal.breed}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge tone={animal.status === "ACTIVE" ? "good" : "muted"}>{STATUS_LABEL[animal.status]}</Badge>
            {age && <Badge>{age.label} old{animal.ageIsEstimated ? " (est.)" : ""}</Badge>}
            {animal.reproStatus !== "NOT_APPLICABLE" && <Badge tone={animal.reproStatus === "PREGNANT" ? "brand" : "muted"}>{REPRO_LABEL[animal.reproStatus]}</Badge>}
            {animal.expectedDueDate && <Badge tone="warn">Due {fmtDate(animal.expectedDueDate)} · {relativeDue(animal.expectedDueDate)}</Badge>}
            {animal.penOrLocation && <Badge>{animal.penOrLocation}</Badge>}
          </div>
        </div>
        {can.manageAnimals(user.role) && (
          <div className="flex gap-2">
            <Link href={`/animals/${animal.id}/edit`} className="btn-ghost btn-sm">Edit</Link>
          </div>
        )}
      </header>

      {dueSoon.length > 0 && (
        <div className="mb-4 rounded-xl border border-warn/30 bg-warn/10 px-4 py-3 text-[13.5px] text-warn">
          <strong className="font-semibold">Follow-up due:</strong>{" "}
          {dueSoon.slice(0, 3).map((r) => `${r.title} (${relativeDue(r.nextDueDate)})`).join(" · ")}
        </div>
      )}

      <Tabs base={`/animals/${animal.id}`} current={tab} tabs={tabs} />

      {tab === "overview" && (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <Section title="Identity & features">
            <dl className="grid sm:grid-cols-2 sm:gap-y-1 sm:py-2">
              <Detail label="Sex" value={animal.sex === "FEMALE" ? "Female" : "Male"} />
              <Detail label="Colour" value={animal.color} />
              <Detail label="Horns" value={animal.hornStatus} />
              <Detail label="Distinguishing marks" value={animal.markings} />
              <Detail label="Microchip / RFID" value={animal.microchip} />
              <Detail label="Insurance no." value={animal.insuranceNo} />
            </dl>
          </Section>

          <Section title="Age & arrival">
            <dl className="grid sm:grid-cols-2 sm:gap-y-1 sm:py-2">
              <Detail label="Date of birth" value={animal.dateOfBirth ? `${fmtDate(animal.dateOfBirth)}${animal.ageIsEstimated ? " (est.)" : ""}` : "Unknown"} />
              <Detail label="Current age" value={age?.label ?? "Unknown"} />
              <Detail label="Joined the farm" value={fmtDate(animal.dateJoined)} />
              <Detail label="How it joined" value={ACQUISITION_LABEL[animal.acquisition]} />
              <Detail label="Seller / source" value={animal.sourceName} />
              {showMoney && <Detail label="Purchase price" value={animal.purchasePrice ? money(animal.purchasePrice, settings.currency) : "—"} />}
            </dl>
          </Section>

          <Section title="Family">
            <dl className="grid sm:grid-cols-2 sm:gap-y-1 sm:py-2">
              <Detail label="Mother" value={animal.mother ? <Link className="text-brand hover:underline" href={`/animals/${animal.mother.id}`}>{animal.mother.name} ({animal.mother.tagId})</Link> : "Unknown"} />
              <Detail label="Father" value={animal.father ? <Link className="text-brand hover:underline" href={`/animals/${animal.father.id}`}>{animal.father.name} ({animal.father.tagId})</Link> : "Unknown"} />
              <Detail
                label="Offspring"
                value={animal.damOf.length
                  ? <span className="flex flex-wrap gap-1.5">{animal.damOf.map((c) => <Link key={c.id} href={`/animals/${c.id}`} className="chip hover:bg-surface2">{c.name}</Link>)}</span>
                  : "None recorded"}
              />
            </dl>
          </Section>

          <Section title="Notes">
            <p className="whitespace-pre-wrap px-4 py-3 text-[14.5px] text-muted">{animal.notes || "No notes yet."}</p>
          </Section>

          {animal.status !== "ACTIVE" && (
            <Section title="Left the farm">
              <dl className="grid sm:grid-cols-2 sm:gap-y-1 sm:py-2">
                <Detail label="Status" value={STATUS_LABEL[animal.status]} />
                <Detail label="Date" value={fmtDate(animal.exitDate)} />
                <Detail label="Buyer" value={animal.buyerName} />
                {showMoney && <Detail label="Sale price" value={animal.salePrice ? money(animal.salePrice, settings.currency) : "—"} />}
                <Detail label="Reason" value={animal.exitReason} />
              </dl>
            </Section>
          )}

          {can.manageAnimals(user.role) && animal.status === "ACTIVE" && (
            <Section title="Record a sale, death or transfer">
              <div className="p-4"><SaleForm animalId={animal.id} currency={settings.currency} /></div>
            </Section>
          )}

          {can.manageAnimals(user.role) && (
            <Card className="p-4">
              <h2 className="h2 text-bad">Danger zone</h2>
              <p className="mt-1 text-[13px] text-muted">
                Deleting removes this animal and its health, feed, breeding and photo records permanently.
                Money already spent stays in your accounts, labelled &ldquo;{animal.name} ({animal.tagId})&rdquo;,
                so your totals do not change. To keep the full history, mark it Sold or Deceased instead.
              </p>
              <form action={deleteAnimalAction} className="mt-3">
                <input type="hidden" name="id" value={animal.id} />
                <ConfirmSubmit message={`Delete ${animal.name} and all its records? This cannot be undone.`}>
                  <Icon.trash className="h-4 w-4" /> Delete animal
                </ConfirmSubmit>
              </form>
            </Card>
          )}
        </div>
      )}

      {tab === "health" && (
        <div className="flex flex-col gap-4">
          {can.writeHealth(user.role) && (
            <Disclosure label="Add health record">
              <Card className="p-4">
                <HealthRecordForm animals={[]} animalId={animal.id} vaccineSuggestions={VACCINE_SUGGESTIONS[animal.species] ?? []} />
              </Card>
            </Disclosure>
          )}

          <Section title="Vaccination, injection & treatment history" subtitle={`${animal.healthRecords.length} records`}>
            {animal.healthRecords.length === 0 ? (
              <Empty icon="💉" title="No health records yet" hint="Every vaccine, injection, deworming and vet visit will show up here." />
            ) : (
              <ul>
                {animal.healthRecords.map((r) => (
                  <li key={r.id} className="border-t border-line px-4 py-3 first:border-t-0">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={HEALTH_TYPE[r.type].tone}>{HEALTH_TYPE[r.type].label}</Badge>
                          <span className="font-medium">{r.title}</span>
                        </div>
                        <div className="mt-1 text-[13px] text-muted">
                          {fmtDate(r.date)}
                          {r.medicine && ` · ${r.medicine}`}
                          {r.dosage && ` · ${r.dosage}`}
                          {r.route && ` · ${r.route}`}
                          {r.batchNo && ` · batch ${r.batchNo}`}
                        </div>
                        {(r.symptoms || r.diagnosis || r.treatment) && (
                          <div className="mt-1 text-[13.5px]">
                            {r.symptoms && <div><span className="text-muted">Symptoms: </span>{r.symptoms}</div>}
                            {r.diagnosis && <div><span className="text-muted">Diagnosis: </span>{r.diagnosis}</div>}
                            {r.treatment && <div><span className="text-muted">Treatment: </span>{r.treatment}</div>}
                          </div>
                        )}
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {(r.vet?.name || r.vetName) && <Badge>Vet: {r.vet?.name ?? r.vetName}</Badge>}
                          {r.temperatureC && <Badge>{String(r.temperatureC)} °C</Badge>}
                          {r.weightKg && <Badge>{String(r.weightKg)} kg</Badge>}
                          {r.withdrawalUntil && <Badge tone="warn">Withdrawal until {fmtDate(r.withdrawalUntil)}</Badge>}
                          {r.nextDueDate && <Badge tone={r.followUpDone ? "good" : "warn"}>Next: {fmtDate(r.nextDueDate)}{r.followUpDone ? " ✓" : ""}</Badge>}
                        </div>
                        {r.notes && <p className="mt-1.5 text-[13.5px] text-muted">{r.notes}</p>}
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        {showMoney && (Number(r.medicineCost ?? 0) + Number(r.vetFee ?? 0) > 0) && (
                          <span className="tabular-nums text-[14px] font-semibold">
                            {money(Number(r.medicineCost ?? 0) + Number(r.vetFee ?? 0), settings.currency)}
                          </span>
                        )}
                        {can.writeHealth(user.role) && (
                          <form action={deleteHealthRecordAction}>
                            <input type="hidden" name="id" value={r.id} />
                            <ConfirmSubmit message="Delete this health record?" className="rounded-lg p-1.5 text-muted hover:bg-surface2 hover:text-bad">
                              <Icon.trash className="h-4 w-4" />
                            </ConfirmSubmit>
                          </form>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      )}

      {tab === "feed" && (
        <div className="flex flex-col gap-4">
          {can.writeDailyLogs(user.role) && (
            <Disclosure label="Log feed for this animal">
              <Card className="p-4">
                <FeedLogForm
                  feeds={feedTypes.map((f) => ({ id: f.id, name: f.name, unit: f.unit, costPerUnit: f.costPerUnit.toString() }))}
                  animals={[]}
                  animalId={animal.id}
                  currency={settings.currency}
                />
              </Card>
            </Disclosure>
          )}

          {feedByType.length > 0 && (
            <Section title="What this animal eats" subtitle="Total consumed to date">
              <BarList
                items={feedByType
                  .map((f) => ({
                    label: feedNameById.get(f.feedTypeId)?.name ?? "Feed",
                    value: Number(f._sum.quantity ?? 0),
                    display: `${num(f._sum.quantity, 1)} ${feedNameById.get(f.feedTypeId)?.unit ?? "kg"}${showMoney ? ` · ${money(f._sum.totalCost, settings.currency)}` : ""}`,
                  }))
                  .sort((a, b) => b.value - a.value)}
              />
            </Section>
          )}

          <Section title="Feeding log" subtitle={`Last ${animal.feedLogs.length} entries`}>
            {animal.feedLogs.length === 0 ? (
              <Empty icon="🌾" title="No feed logged yet" hint="Log what this animal eats to build up an accurate cost per animal." />
            ) : (
              <div className="scroll-x">
                <table className="w-full min-w-[520px]">
                  <thead><tr><th className="th">Date</th><th className="th">Feed</th><th className="th">Quantity</th>{showMoney && <th className="th">Cost</th>}<th className="th">Group</th></tr></thead>
                  <tbody>
                    {animal.feedLogs.map((l) => (
                      <tr key={l.id} className="row">
                        <td className="td whitespace-nowrap">{fmtDate(l.date)}</td>
                        <td className="td">{l.feedType.name}</td>
                        <td className="td tabular-nums">{num(l.quantity, 2)} {l.feedType.unit}</td>
                        {showMoney && <td className="td tabular-nums">{money(l.totalCost, settings.currency)}</td>}
                        <td className="td text-muted">{l.groupLabel ?? "Individual"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </div>
      )}

      {tab === "breeding" && (
        <div className="flex flex-col gap-4">
          {can.writeBreeding(user.role) && (
            <Disclosure label="Add breeding record">
              <Card className="p-4">
                <BreedingForm dams={dams} sires={sires} damId={animal.id} showCost={showMoney} />
              </Card>
            </Disclosure>
          )}
          <Section title="Breeding history">
            {animal.breedingAsDam.length === 0 ? (
              <Empty icon="🍼" title="No breeding records yet" hint="Record a service date and we'll work out the expected delivery date for you." />
            ) : (
              <ul>
                {animal.breedingAsDam.map((b) => (
                  <li key={b.id} className="border-t border-line px-4 py-3 first:border-t-0">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={b.status === "CONFIRMED_PREGNANT" ? "brand" : b.status === "DELIVERED" ? "good" : b.status === "ABORTED" ? "bad" : "muted"}>
                            {BREEDING_STATUS_LABEL[b.status]}
                          </Badge>
                          <span className="text-[14px] font-medium">{BREEDING_METHOD_LABEL[b.method]}</span>
                        </div>
                        <div className="mt-1 text-[13px] text-muted">
                          Served {fmtDate(b.breedingDate)}
                          {b.sire ? ` · sire ${b.sire.name} (${b.sire.tagId})` : b.sireName ? ` · sire ${b.sireName}` : ""}
                          {b.expectedDueDate && ` · due ${fmtDate(b.expectedDueDate)}`}
                          {b.actualBirthDate && ` · delivered ${fmtDate(b.actualBirthDate)}`}
                          {b.offspringCount ? ` · ${b.offspringCount} young` : ""}
                        </div>
                        {b.offspringNotes && <p className="mt-1 text-[13.5px]">{b.offspringNotes}</p>}
                        {b.notes && <p className="mt-1 text-[13.5px] text-muted">{b.notes}</p>}
                      </div>
                      {can.writeBreeding(user.role) && (
                        <form action={deleteBreedingAction}>
                          <input type="hidden" name="id" value={b.id} />
                          <ConfirmSubmit message="Delete this breeding record?" className="rounded-lg p-1.5 text-muted hover:bg-surface2 hover:text-bad">
                            <Icon.trash className="h-4 w-4" />
                          </ConfirmSubmit>
                        </form>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      )}

      {tab === "growth" && (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <Section title="Weight history" subtitle={animal.weights[0] ? `Latest: ${num(animal.weights[0].weightKg, 1)} kg` : undefined}>
            <div className="border-b border-line p-4"><AddWeightForm animalId={animal.id} /></div>
            {animal.weights.length === 0 ? (
              <Empty icon="⚖️" title="No weights recorded" />
            ) : (
              <BarList
                items={[...animal.weights].reverse().map((w) => ({
                  label: fmtDate(w.date), value: Number(w.weightKg), display: `${num(w.weightKg, 1)} kg`,
                }))}
              />
            )}
          </Section>

          <Section title="Milk production" subtitle="Last 30 entries">
            {can.writeDailyLogs(user.role) && <div className="border-b border-line p-4"><AddMilkForm animalId={animal.id} /></div>}
            {animal.milkRecords.length === 0 ? (
              <Empty icon="🥛" title="No milk recorded" hint="Useful for dairy cows and does in milk." />
            ) : (
              <div className="scroll-x">
                <table className="w-full min-w-[380px]">
                  <thead><tr><th className="th">Date</th><th className="th">Session</th><th className="th">Litres</th><th className="th"></th></tr></thead>
                  <tbody>
                    {animal.milkRecords.map((m) => (
                      <tr key={m.id} className="row">
                        <td className="td whitespace-nowrap">{fmtDate(m.date)}</td>
                        <td className="td">{m.session}</td>
                        <td className="td tabular-nums">{num(m.litres, 2)}</td>
                        <td className="td text-right">
                          <form action={deleteLogAction}>
                            <input type="hidden" name="kind" value="milk" />
                            <input type="hidden" name="id" value={m.id} />
                            <input type="hidden" name="animalId" value={animal.id} />
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
      )}

      {tab === "photos" && (
        <div className="flex flex-col gap-4">
          <Section title="Add a photo" subtitle="Profile picture, markings, injuries — anything worth a record">
            <div className="p-4"><PhotoUploader animalId={animal.id} isFirst={animal.photos.length === 0} /></div>
          </Section>

          {animal.photos.length === 0 ? (
            <Card><Empty icon="📷" title="No photos yet" hint="The first photo you upload becomes the profile picture." /></Card>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {animal.photos.map((p) => (
                <li key={p.id} className="card overflow-hidden">
                  <a href={`/api/photos/${p.id}`} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/photos/${p.id}?v=thumb`} alt={p.caption ?? animal.name} className="aspect-square w-full object-cover" />
                  </a>
                  <div className="flex items-center justify-between gap-2 px-2.5 py-2">
                    <span className="truncate text-[12.5px] text-muted">{p.caption ?? fmtDate(p.createdAt)}</span>
                    <div className="flex shrink-0 items-center gap-1">
                      {animal.profilePhotoId === p.id ? (
                        <Badge tone="brand">Profile</Badge>
                      ) : (
                        <form action={setProfilePhotoAction}>
                          <input type="hidden" name="animalId" value={animal.id} />
                          <input type="hidden" name="photoId" value={p.id} />
                          <button className="text-[12px] text-brand hover:underline">Set profile</button>
                        </form>
                      )}
                      {can.manageAnimals(user.role) && (
                        <form action={deletePhotoAction}>
                          <input type="hidden" name="animalId" value={animal.id} />
                          <input type="hidden" name="photoId" value={p.id} />
                          <ConfirmSubmit message="Delete this photo?" className="rounded p-1 text-muted hover:text-bad">
                            <Icon.trash className="h-3.5 w-3.5" />
                          </ConfirmSubmit>
                        </form>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "costs" && showMoney && (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <Card className="p-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-[12px] uppercase tracking-wide text-muted">Spent</div>
                <div className="mt-1 text-[22px] font-semibold text-bad">{money(totalSpent, settings.currency)}</div>
              </div>
              <div>
                <div className="text-[12px] uppercase tracking-wide text-muted">Earned</div>
                <div className="mt-1 text-[22px] font-semibold text-good">{money(totalEarned, settings.currency)}</div>
              </div>
              <div>
                <div className="text-[12px] uppercase tracking-wide text-muted">Net</div>
                <div className={`mt-1 text-[22px] font-semibold ${totalEarned - totalSpent >= 0 ? "text-good" : "text-bad"}`}>
                  {money(totalEarned - totalSpent, settings.currency)}
                </div>
              </div>
            </div>
            <p className="mt-3 text-[12.5px] text-muted">
              Includes the purchase price, all feed, medicine and vet costs logged against {animal.name}, and any income from sales.
            </p>
          </Card>

          <Section title="Where the money went">
            <BarList
              items={spend
                .map((s) => ({ label: s.category, value: Number(s._sum.amount ?? 0), display: money(s._sum.amount, settings.currency) }))
                .sort((a, b) => b.value - a.value)}
              emptyText="No costs recorded against this animal yet."
            />
          </Section>
        </div>
      )}
    </>
  );
}
