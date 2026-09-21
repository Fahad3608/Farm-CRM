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

  // ── Monthly running expenses (from farm mastersheet) ─────
  const expenses: { date: string; amount: number; desc: string; category: string; vendor?: string; ref?: string }[] = [
    // June 2026
    { date: "2026-06-10", amount: 17000,  desc: "June - Farm rent",                       category: "Farm Rent",          ref: "Paid by Fahad" },
    { date: "2026-06-15", amount: 20000,  desc: "Farm monthly - uncle",                   category: "Feed",               vendor: "Uncle", ref: "Paid by Fahad" },
    { date: "2026-06-15", amount: 700,    desc: "Ghass day 1",                            category: "Feed",               ref: "Paid by Fahad" },
    { date: "2026-06-16", amount: 1000,   desc: "Ghass day 2",                            category: "Feed",               ref: "Paid by Fahad" },
    { date: "2026-06-17", amount: 1500,   desc: "Deworming Vet",                          category: "Veterinary",         ref: "Paid by Fahad" },
    { date: "2026-06-20", amount: 800,    desc: "Ghass Javed - 1.5 mann",                 category: "Feed",               ref: "Paid by Fahad" },
    { date: "2026-06-21", amount: 700,    desc: "Javed ghass",                            category: "Feed",               ref: "Paid by Harris" },
    { date: "2026-06-23", amount: 5500,   desc: "Javed salary",                           category: "Labour / Wages",     vendor: "Javed", ref: "Paid by Fahad" },
    { date: "2026-06-24", amount: 10000,  desc: "Haris -> uncle",                         category: "Feed",               vendor: "Uncle", ref: "Paid by Harris" },
    { date: "2026-06-27", amount: 5000,   desc: "Haris -> uncle",                         category: "Feed",               vendor: "Uncle", ref: "Paid by Harris" },
    { date: "2026-06-27", amount: 3800,   desc: "Chairs",                                 category: "Equipment",          ref: "Paid by Harris" },
    { date: "2026-06-28", amount: 2450,   desc: "Ashgar vet",                             category: "Veterinary",         vendor: "Ashgar", ref: "Paid by Harris" },
    { date: "2026-06-29", amount: 1300,   desc: "Javed ghass",                            category: "Feed",               ref: "Paid by Harris" },
    { date: "2026-06-29", amount: 4000,   desc: "M Ramzan vet",                           category: "Veterinary",         vendor: "M Ramzan", ref: "Paid by Harris" },
    // July 2026
    { date: "2026-07-01", amount: 2000,   desc: "Javed salary",                           category: "Labour / Wages",     vendor: "Javed", ref: "Paid by Harris" },
    { date: "2026-07-02", amount: 40000,  desc: "CCTV Cameras",                           category: "Equipment",          ref: "Paid by Harris" },
    { date: "2026-07-02", amount: 2000,   desc: "Camera labour",                          category: "Equipment",          ref: "Paid by Harris" },
    { date: "2026-07-05", amount: 25000,  desc: "Uncle - Farm feed",                      category: "Feed",               vendor: "Uncle", ref: "Paid by Harris" },
    { date: "2026-07-08", amount: 12000,  desc: "Javed salary",                           category: "Labour / Wages",     vendor: "Javed", ref: "Paid by Fahad" },
    { date: "2026-07-10", amount: 4000,   desc: "Wanda - milk",                           category: "Feed",               ref: "Paid by Fahad" },
    { date: "2026-07-10", amount: 1500,   desc: "Chokar",                                 category: "Feed",               ref: "Paid by Fahad" },
    { date: "2026-07-10", amount: 4000,   desc: "Wanda - milk",                           category: "Feed",               ref: "Paid by Fahad" },
    { date: "2026-07-10", amount: 2500,   desc: "Mustaqeem autos",                        category: "Equipment",          vendor: "Mustaqeem autos", ref: "Paid by Fahad" },
    { date: "2026-07-10", amount: 4000,   desc: "Cooler wire",                            category: "Equipment",          ref: "Paid by Fahad" },
    { date: "2026-07-10", amount: 11000,  desc: "Battery",                                category: "Equipment",          ref: "Paid by Fahad" },
    { date: "2026-07-11", amount: 3000,   desc: "Camera sim pkg",                         category: "Utilities",          ref: "Paid by Fahad" },
    { date: "2026-07-24", amount: 20000,  desc: "Uncle - Farm feed",                      category: "Feed",               vendor: "Uncle", ref: "Paid by Harris" },
    { date: "2026-07-25", amount: 25000,  desc: "M Hussain",                              category: "Other Expense",      vendor: "M Hussain", ref: "Paid by Harris" },
    { date: "2026-07-26", amount: 25000,  desc: "Uncle - Farm feed",                      category: "Feed",               vendor: "Uncle", ref: "Paid by Harris" },
    { date: "2026-07-31", amount: 9200,   desc: "Hamid vet",                              category: "Veterinary",         vendor: "Hamid", ref: "Paid by Fahad" },
    // August 2026
    { date: "2026-08-05", amount: 15000,  desc: "Javed salary",                           category: "Labour / Wages",     vendor: "Javed", ref: "Paid by Fahad" },
    { date: "2026-08-10", amount: 3000,   desc: "Camera sim pkg",                         category: "Utilities",          ref: "Paid by Fahad" },
    { date: "2026-08-12", amount: 4000,   desc: "Javed salary",                           category: "Labour / Wages",     vendor: "Javed", ref: "Paid by Fahad" },
    { date: "2026-08-12", amount: 1200,   desc: "Hamid Vet",                              category: "Veterinary",         vendor: "Hamid", ref: "Paid by Fahad" },
    { date: "2026-08-17", amount: 2000,   desc: "Javed salary",                           category: "Labour / Wages",     vendor: "Javed", ref: "Paid by Harris" },
    { date: "2026-08-17", amount: 23600,  desc: "Solar Plate",                            category: "Equipment",          ref: "Paid by Fahad" },
    { date: "2026-08-17", amount: 700,    desc: "Loader kraya",                           category: "Equipment",          ref: "Paid by Fahad" },
    { date: "2026-08-17", amount: 2500,   desc: "Hamid Vet",                              category: "Veterinary",         vendor: "Hamid", ref: "Paid by Fahad" },
    { date: "2026-08-18", amount: 10000,  desc: "Javed loan",                             category: "Other Expense",      vendor: "Javed", ref: "Paid by Fahad" },
    { date: "2026-08-18", amount: 50000,  desc: "Uncle - Farm feed",                      category: "Feed",               vendor: "Uncle", ref: "Paid by Harris" },
    { date: "2026-08-29", amount: 30000,  desc: "Uncle - Farm feed",                      category: "Feed",               vendor: "Uncle", ref: "Paid by Harris" },
    { date: "2026-08-29", amount: 20000,  desc: "Javed salary",                           category: "Labour / Wages",     vendor: "Javed", ref: "Paid by Fahad" },
    // September 2026
    { date: "2026-09-12", amount: 34500,  desc: "Shed Partition cost",                    category: "Shed / Maintenance", ref: "Paid by Fahad" },
    { date: "2026-09-12", amount: 24200,  desc: "Chicken Coop cost",                      category: "Shed / Maintenance", ref: "Paid by Fahad" },
    { date: "2026-09-12", amount: 6000,   desc: "Water drum",                             category: "Equipment",          ref: "Paid by Fahad" },
    { date: "2026-09-12", amount: 1000,   desc: "Tokaraay",                               category: "Equipment",          ref: "Paid by Fahad" },
    { date: "2026-09-12", amount: 12000,  desc: "Drum frames",                            category: "Equipment",          ref: "Paid by Fahad" },
    { date: "2026-09-12", amount: 1300,   desc: "Frames karaya",                          category: "Equipment",          ref: "Paid by Fahad" },
    { date: "2026-09-12", amount: 9000,   desc: "Ducks 4x",                               category: "Animal Purchase",    ref: "Paid by Fahad" },
    { date: "2026-09-12", amount: 1000,   desc: "Javed",                                  category: "Labour / Wages",     vendor: "Javed", ref: "Paid by Harris" },
    { date: "2026-09-15", amount: 22500,  desc: "Remaining advance to Arham - 100k completed", category: "Other Expense", vendor: "Arham", ref: "Paid by Harris" },
    { date: "2026-09-16", amount: 600,    desc: "Javed",                                  category: "Labour / Wages",     vendor: "Javed", ref: "Paid by Harris" },
    { date: "2026-09-16", amount: 7800,   desc: "Camera sim pkg 90 days - both cameras",  category: "Utilities",          ref: "Paid by Fahad" },
    { date: "2026-09-16", amount: 3000,   desc: "Dr Abdul haq - Black bachri insemination", category: "Breeding / AI",   vendor: "Dr Abdul Haq", ref: "Paid by Harris" },
    { date: "2026-09-17", amount: 20000,  desc: "Uncle - Farm feed",                      category: "Feed",               vendor: "Uncle", ref: "Paid by Harris" },
    { date: "2026-09-18", amount: 500,    desc: "Javed",                                  category: "Other Expense",      vendor: "Javed", ref: "Paid by Harris" },
  ];

  for (const e of expenses) {
    await prisma.transaction.create({
      data: {
        date: new Date(e.date), type: "EXPENSE", category: e.category,
        amount: e.amount, description: e.desc,
        vendor: e.vendor ?? null, reference: e.ref ?? null,
        notAnimalSpecific: true, createdById: owner.id,
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

  // ── Purchase batches ───────────────────────────────────────
  // Real data from the farm's mandi trips, plus standalone purchases.

  const batchAnimals: { tagId: string; name: string; species: Species; sex: "MALE" | "FEMALE"; breed?: string; color?: string; price: number; dateJoined: Date; batch?: string }[] = [
    // Batch 1 — June 13th
    { tagId: "C-005", name: "Jodi 1",       species: "CALF", sex: "FEMALE", price: 110000, dateJoined: new Date("2026-06-13"), batch: "batch1" },
    { tagId: "C-006", name: "Jodi 2",       species: "CALF", sex: "FEMALE", price: 110000, dateJoined: new Date("2026-06-13"), batch: "batch1" },
    { tagId: "C-007", name: "Blacky",       species: "CALF", sex: "FEMALE", color: "Black", price: 111000, dateJoined: new Date("2026-06-13"), batch: "batch1" },
    { tagId: "C-008", name: "White Bachri", species: "CALF", sex: "FEMALE", color: "White", price: 115000, dateJoined: new Date("2026-06-13"), batch: "batch1" },
    // Batch 2 — June 20th (bachris)
    { tagId: "C-009", name: "Black Bachri",  species: "CALF", sex: "FEMALE", color: "Black", price: 127000, dateJoined: new Date("2026-06-20"), batch: "batch2" },
    { tagId: "C-010", name: "White Bachri 2", species: "CALF", sex: "FEMALE", color: "White", price: 110000, dateJoined: new Date("2026-06-20"), batch: "batch2" },
    { tagId: "C-011", name: "Jersey Bachri", species: "CALF", sex: "FEMALE", breed: "Jersey", price: 105000, dateJoined: new Date("2026-06-20"), batch: "batch2" },
    // Batch 3 — June 20th (goats)
    { tagId: "G-005", name: "Goat 1",       species: "GOAT", sex: "FEMALE", price: 40000, dateJoined: new Date("2026-06-20"), batch: "batch3" },
    { tagId: "G-006", name: "Goat 2",       species: "GOAT", sex: "FEMALE", price: 40000, dateJoined: new Date("2026-06-20"), batch: "batch3" },
    { tagId: "G-007", name: "Goat 3",       species: "GOAT", sex: "FEMALE", price: 40000, dateJoined: new Date("2026-06-20"), batch: "batch3" },
    // Standalone purchases
    { tagId: "COW-004", name: "Cow",         species: "COW", sex: "FEMALE", price: 355000, dateJoined: new Date("2026-06-30") },
    { tagId: "G-008",   name: "Prince Breeder", species: "GOAT", sex: "MALE", price: 62000, dateJoined: new Date("2026-09-19") },
  ];

  const batchAnimalIds: Record<string, string[]> = { batch1: [], batch2: [], batch3: [] };
  for (const a of batchAnimals) {
    const animal = await prisma.animal.create({
      data: {
        tagId: a.tagId, name: a.name, species: a.species, sex: a.sex,
        breed: a.breed ?? null, color: a.color ?? null,
        dateJoined: a.dateJoined, acquisition: "PURCHASED",
        sourceName: "Mandi", purchasePrice: a.price,
        penOrLocation: a.species === "GOAT" ? "Goat pen B" : "Shed A",
      },
    });
    await prisma.transaction.create({
      data: {
        date: a.dateJoined, type: "EXPENSE", category: "Animal Purchase",
        amount: a.price, description: `Purchase of ${a.name} (${a.tagId})`,
        vendor: "Mandi", animalId: animal.id, createdById: owner.id,
      },
    });
    if (a.batch) batchAnimalIds[a.batch].push(animal.id);
  }

  // Helper: create a batch with costs and matching finance entries.
  async function seedBatch(name: string, date: Date, animalIds: string[], costs: { description: string; amount: number }[]) {
    const batch = await prisma.purchaseBatch.create({
      data: {
        name, date,
        animals: { connect: animalIds.map((id) => ({ id })) },
        costs: { create: costs },
      },
      include: { costs: true },
    });
    for (const cost of batch.costs) {
      await prisma.transaction.create({
        data: {
          date, type: "EXPENSE", category: "Batch Cost", amount: cost.amount,
          description: `${cost.description} — ${name}`,
          notAnimalSpecific: true, batchCostId: cost.id, createdById: owner.id,
        },
      });
    }
  }

  await seedBatch("June 13th — Mandi Batch 1", new Date("2026-06-13"), batchAnimalIds.batch1, [
    { description: "Parchi mandi", amount: 7500 },
    { description: "Baba helper", amount: 1000 },
    { description: "Karaya loader janwar", amount: 2500 },
  ]);

  await seedBatch("June 20th — Mandi Batch 2 (Bachris)", new Date("2026-06-20"), batchAnimalIds.batch2, [
    { description: "Parchi mandi", amount: 6000 },
    { description: "Baba helper", amount: 2000 },
    { description: "Karaya loader", amount: 2500 },
  ]);

  await seedBatch("June 20th — Mandi Batch 2 (Goats)", new Date("2026-06-20"), batchAnimalIds.batch3, [
    { description: "Parchi mandi", amount: 900 },
    { description: "Karaya loader", amount: 1000 },
    { description: "Funds transfer", amount: 1500 },
  ]);

  console.log("✔ Purchase batches seeded: 3 batches with 10 animals + 2 standalone purchases.");
  console.log("✔ Monthly expenses seeded: 56 entries (June–September) from the farm mastersheet.");
  console.log("✔ Demo data loaded: 25 animals, health, feed, milk, breeding, finance, batches and monthly expenses.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
