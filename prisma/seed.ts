/* eslint-disable no-console */
import { PrismaClient, type Species } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const daysAgo = (n: number) => new Date(Date.now() - n * 86400000);
const monthsAgo = (n: number) => {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d;
};

async function main() {
  const email = (process.env.SEED_OWNER_EMAIL ?? "owner@farm.local").toLowerCase();
  const password = process.env.SEED_OWNER_PASSWORD ?? "ChangeMe123!";
  const name = process.env.SEED_OWNER_NAME ?? "Farm Owner";

  const owner = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name, role: "OWNER", passwordHash: await bcrypt.hash(password, 10) },
  });
  console.log(`✔ Owner account ready:  ${email}  /  ${password}`);

  for (const [key, value] of Object.entries({ farmName: "My Farm", currency: "PKR", weightUnit: "kg" })) {
    await prisma.setting.upsert({ where: { key }, create: { key, value }, update: {} });
  }

  if (process.env.SEED_DEMO_DATA !== "true") {
    console.log("Skipping demo data (set SEED_DEMO_DATA=true to include it).");
    return;
  }

  if ((await prisma.animal.count()) > 0) {
    console.log("Animals already exist — skipping demo data.");
    return;
  }

  const vet = await prisma.user.upsert({
    where: { email: "vet@farm.local" },
    update: {},
    create: {
      email: "vet@farm.local", name: "Dr. Sana Iqbal", role: "VET",
      clinic: "Green Valley Veterinary", licenseNo: "VET-4417",
      passwordHash: await bcrypt.hash("VetPass123!", 10),
    },
  });
  console.log("✔ Demo vet account:     vet@farm.local  /  VetPass123!");

  const feeds = await Promise.all(
    [
      { name: "Wheat Straw", category: "Roughage", unit: "kg", costPerUnit: 18, supplier: "Local mill" },
      { name: "Green Fodder (Berseem)", category: "Green fodder", unit: "kg", costPerUnit: 12 },
      { name: "Maize Silage", category: "Silage", unit: "kg", costPerUnit: 15 },
      { name: "Dairy Concentrate", category: "Concentrate", unit: "kg", costPerUnit: 95, supplier: "AgriFeeds Ltd" },
      { name: "Mineral Mixture", category: "Mineral / vitamin", unit: "kg", costPerUnit: 320 },
    ].map((f) => prisma.feedType.create({ data: f }))
  );

  const spec: { tagId: string; name: string; species: Species; sex: "MALE" | "FEMALE"; breed: string; months: number; color: string; pregnant?: boolean; purchased?: number }[] = [
    { tagId: "COW-001", name: "Gauri", species: "COW", sex: "FEMALE", breed: "Sahiwal", months: 54, color: "Reddish brown", purchased: 180000 },
    { tagId: "COW-002", name: "Laali", species: "COW", sex: "FEMALE", breed: "Sahiwal", months: 41, color: "Deep red", pregnant: true },
    { tagId: "COW-003", name: "Noori", species: "COW", sex: "FEMALE", breed: "Holstein Friesian", months: 38, color: "Black & white", purchased: 265000 },
    { tagId: "CALF-01", name: "Chotu", species: "COW", sex: "MALE", breed: "Sahiwal", months: 7, color: "Light brown" },
    { tagId: "CALF-02", name: "Mithi", species: "COW", sex: "FEMALE", breed: "Sahiwal", months: 4, color: "Reddish brown" },
    { tagId: "BULL-01", name: "Sultan", species: "COW", sex: "MALE", breed: "Sahiwal", months: 62, color: "Dark red", purchased: 310000 },
    { tagId: "GOAT-01", name: "Chandni", species: "GOAT", sex: "FEMALE", breed: "Beetal", months: 30, color: "Black with white patch", pregnant: true },
    { tagId: "GOAT-02", name: "Heera", species: "GOAT", sex: "FEMALE", breed: "Beetal", months: 26, color: "Brown", pregnant: true },
    { tagId: "GOAT-03", name: "Roshni", species: "GOAT", sex: "FEMALE", breed: "Teddy", months: 19, color: "White" },
    { tagId: "GOAT-04", name: "Kaali", species: "GOAT", sex: "FEMALE", breed: "Beetal", months: 33, color: "Black" },
    { tagId: "KID-01", name: "Nanha", species: "GOAT", sex: "MALE", breed: "Beetal", months: 5, color: "Brown & white" },
    { tagId: "KID-02", name: "Guriya", species: "GOAT", sex: "FEMALE", breed: "Teddy", months: 3, color: "White with brown ears" },
    { tagId: "BUCK-01", name: "Raja", species: "GOAT", sex: "MALE", breed: "Beetal", months: 40, color: "Black & tan", purchased: 65000 },
  ];

  const created = new Map<string, string>();
  for (const a of spec) {
    const dob = monthsAgo(a.months);
    const animal = await prisma.animal.create({
      data: {
        tagId: a.tagId, name: a.name, species: a.species, sex: a.sex, breed: a.breed, color: a.color,
        dateOfBirth: dob,
        dateJoined: a.purchased ? monthsAgo(Math.max(1, a.months - 12)) : dob,
        acquisition: a.purchased ? "PURCHASED" : "BORN_ON_FARM",
        sourceName: a.purchased ? "Kasur cattle market" : null,
        purchasePrice: a.purchased ?? null,
        penOrLocation: a.species === "COW" ? "Shed A" : "Goat pen B",
        reproStatus: a.pregnant ? "PREGNANT" : a.sex === "FEMALE" && a.months > 20 ? "LACTATING" : "NOT_APPLICABLE",
        expectedDueDate: a.pregnant ? new Date(Date.now() + (a.species === "GOAT" ? 45 : 90) * 86400000) : null,
        markings: a.color.includes("patch") ? "White patch on forehead" : null,
        hornStatus: a.species === "GOAT" ? "Horned" : "Dehorned",
      },
    });
    created.set(a.tagId, animal.id);

    if (a.purchased) {
      await prisma.transaction.create({
        data: {
          date: monthsAgo(Math.max(1, a.months - 12)), type: "EXPENSE", category: "Animal Purchase",
          amount: a.purchased, description: `Purchase of ${a.name} (${a.tagId})`,
          vendor: "Kasur cattle market", animalId: animal.id, createdById: owner.id,
        },
      });
    }
  }

  // Parentage
  await prisma.animal.update({ where: { id: created.get("CALF-01")! }, data: { motherId: created.get("COW-001"), fatherId: created.get("BULL-01") } });
  await prisma.animal.update({ where: { id: created.get("CALF-02")! }, data: { motherId: created.get("COW-003"), fatherId: created.get("BULL-01") } });
  await prisma.animal.update({ where: { id: created.get("KID-01")! }, data: { motherId: created.get("GOAT-04"), fatherId: created.get("BUCK-01") } });
  await prisma.animal.update({ where: { id: created.get("KID-02")! }, data: { motherId: created.get("GOAT-03"), fatherId: created.get("BUCK-01") } });

  // Health records — a realistic mix of vaccines, dewormers and a treatment.
  const health = [
    { tag: "COW-001", type: "VACCINATION" as const, title: "FMD (Foot & Mouth) — booster", medicine: "FMD Trivalent Vaccine", dosage: "2 ml", route: "IM (intramuscular)", days: 95, next: 90, medCost: 850, fee: 1500 },
    { tag: "COW-002", type: "VACCINATION" as const, title: "FMD (Foot & Mouth) — booster", medicine: "FMD Trivalent Vaccine", dosage: "2 ml", route: "IM (intramuscular)", days: 95, next: 90, medCost: 850, fee: 0 },
    { tag: "COW-003", type: "DEWORMING" as const, title: "Routine deworming", medicine: "Ivermectin 1%", dosage: "10 ml", route: "SC (subcutaneous)", days: 40, next: 140, medCost: 620, fee: 800 },
    { tag: "COW-002", type: "PREGNANCY_CHECK" as const, title: "Pregnancy confirmed by ultrasound", days: 30, fee: 2500 },
    { tag: "CALF-01", type: "TREATMENT" as const, title: "Diarrhoea — treated", medicine: "Sulphadimidine", dosage: "5 ml", route: "Oral", days: 22, symptoms: "Loose stool, dull, off feed", diagnosis: "Calf scours", treatment: "Oral sulpha + electrolytes for 3 days", medCost: 450, fee: 1200 },
    { tag: "GOAT-01", type: "VACCINATION" as const, title: "PPR vaccine — annual", medicine: "PPR Vaccine", dosage: "1 ml", route: "SC (subcutaneous)", days: 120, next: 245, medCost: 180, fee: 600 },
    { tag: "GOAT-02", type: "VACCINATION" as const, title: "Enterotoxaemia (ET) vaccine", medicine: "ET Vaccine", dosage: "2 ml", route: "SC (subcutaneous)", days: 60, next: 120, medCost: 200, fee: 600 },
    { tag: "GOAT-03", type: "DEWORMING" as const, title: "Deworming — round 2", medicine: "Albendazole", dosage: "3 ml", route: "Oral", days: 35, next: 55, medCost: 150, fee: 0 },
    { tag: "KID-01", type: "CHECKUP" as const, title: "Routine growth check-up", days: 18, weight: 14.5, fee: 500 },
    { tag: "BUCK-01", type: "HOOF_CARE" as const, title: "Hoof trimming", days: 50, fee: 900 },
  ];

  for (const h of health) {
    const animalId = created.get(h.tag)!;
    const record = await prisma.healthRecord.create({
      data: {
        animalId, type: h.type, date: daysAgo(h.days), title: h.title,
        medicine: h.medicine ?? null, dosage: h.dosage ?? null, route: h.route ?? null,
        symptoms: h.symptoms ?? null, diagnosis: h.diagnosis ?? null, treatment: h.treatment ?? null,
        weightKg: h.weight ?? null,
        nextDueDate: h.next ? daysAgo(h.days - h.next) : null,
        medicineCost: h.medCost ?? null, vetFee: h.fee ?? null,
        vetId: vet.id, vetName: vet.name, createdById: vet.id,
      },
    });
    const total = (h.medCost ?? 0) + (h.fee ?? 0);
    if (total > 0) {
      await prisma.transaction.create({
        data: {
          date: daysAgo(h.days), type: "EXPENSE",
          category: h.type === "VACCINATION" || h.type === "DEWORMING" ? "Medicine" : "Veterinary",
          amount: total, description: h.title, vendor: vet.name,
          animalId, healthRecordId: record.id, createdById: vet.id,
        },
      });
    }
  }

  // Feed logs — the last 45 days, split across the herd.
  const cowIds = spec.filter((s) => s.species === "COW").map((s) => created.get(s.tagId)!);
  const goatIds = spec.filter((s) => s.species === "GOAT").map((s) => created.get(s.tagId)!);

  for (let day = 45; day >= 0; day -= 3) {
    for (const [ids, label, feed, qtyPerHead] of [
      [cowIds, "All cows", feeds[0], 6],
      [cowIds, "All cows", feeds[3], 2],
      [goatIds, "Goat pen B", feeds[1], 3],
    ] as const) {
      for (const animalId of ids) {
        const cost = qtyPerHead * Number(feed.costPerUnit);
        const log = await prisma.feedLog.create({
          data: {
            date: daysAgo(day), feedTypeId: feed.id, animalId, groupLabel: label, headCount: ids.length,
            quantity: qtyPerHead, unitCost: feed.costPerUnit, totalCost: cost, recordedById: owner.id,
          },
        });
        await prisma.transaction.create({
          data: {
            date: daysAgo(day), type: "EXPENSE", category: "Feed", amount: cost,
            description: `${feed.name} — group "${label}"`, animalId, feedLogId: log.id, createdById: owner.id,
          },
        });
      }
    }
  }

  // Milk + weights + income
  for (const tag of ["COW-001", "COW-003"]) {
    const animalId = created.get(tag)!;
    for (let day = 30; day >= 0; day--) {
      for (const session of ["AM", "PM"]) {
        await prisma.milkRecord.create({
          data: { animalId, date: daysAgo(day), session, litres: 5 + Math.round(((day * 7) % 30) / 10) },
        });
      }
    }
  }
  for (const tag of ["CALF-01", "CALF-02", "KID-01"]) {
    const animalId = created.get(tag)!;
    let w = tag.startsWith("KID") ? 9 : 45;
    for (let m = 4; m >= 0; m--) {
      await prisma.weightRecord.create({ data: { animalId, date: monthsAgo(m), weightKg: w } });
      w += tag.startsWith("KID") ? 2.5 : 18;
    }
  }

  for (let m = 5; m >= 0; m--) {
    await prisma.transaction.create({
      data: {
        date: monthsAgo(m), type: "INCOME", category: "Milk Sales",
        amount: 42000 + m * 1800, description: "Monthly milk sales to local dairy",
        vendor: "Al-Noor Dairy", paymentMethod: "Bank transfer", createdById: owner.id,
      },
    });
    await prisma.transaction.create({
      data: {
        date: monthsAgo(m), type: "EXPENSE", category: "Labour / Wages",
        amount: 25000, description: "Farm hand monthly wage", paymentMethod: "Cash", createdById: owner.id,
      },
    });
  }

  // Breeding records for the pregnant animals
  for (const [tag, sireTag, days] of [["COW-002", "BULL-01", 193], ["GOAT-01", "BUCK-01", 105], ["GOAT-02", "BUCK-01", 98]] as const) {
    const damId = created.get(tag)!;
    const dam = await prisma.animal.findUnique({ where: { id: damId } });
    await prisma.breedingRecord.create({
      data: {
        damId, sireId: created.get(sireTag), method: "NATURAL",
        breedingDate: daysAgo(days),
        expectedDueDate: dam?.expectedDueDate,
        confirmedAt: daysAgo(days - 40),
        status: "CONFIRMED_PREGNANT",
      },
    });
  }

  console.log("✔ Demo data loaded: 13 animals, health, feed, milk, breeding and finance records.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
