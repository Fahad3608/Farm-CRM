-- Recategorize monthly expenses to match the farm mastersheet's actual categories.
-- Also updates descriptions where the sheet is more detailed, and inserts one
-- new row (Sep 20 vet cost) that was missing from the original seed migration.

-- Feed (uncle monthly) → Feeding Cost
UPDATE "Transaction" SET category = 'Feeding Cost', "updatedAt" = CURRENT_TIMESTAMP
WHERE category = 'Feed' AND description LIKE '%uncle%' AND "notAnimalSpecific" = true;

UPDATE "Transaction" SET category = 'Feeding Cost', description = 'Farm monthly - uncle', "updatedAt" = CURRENT_TIMESTAMP
WHERE category = 'Feed' AND description LIKE 'Haris -> uncle%' AND "notAnimalSpecific" = true;

-- Feed (direct purchases: ghass, chokar, wanda) → Direct Purchase - Feed
UPDATE "Transaction" SET category = 'Direct Purchase - Feed', "updatedAt" = CURRENT_TIMESTAMP
WHERE category = 'Feed'
  AND "notAnimalSpecific" = true
  AND (description ILIKE '%ghass%' OR description ILIKE '%chokar%' OR description ILIKE '%wanda%');

-- Sep 16 & Sep 18 Javed small amounts were feed purchases, not wages
UPDATE "Transaction" SET category = 'Direct Purchase - Feed', "updatedAt" = CURRENT_TIMESTAMP
WHERE description = 'Javed' AND amount = 600 AND date = '2026-09-16 12:00:00'::timestamp AND "notAnimalSpecific" = true;

UPDATE "Transaction" SET category = 'Direct Purchase - Feed', "updatedAt" = CURRENT_TIMESTAMP
WHERE description = 'Javed' AND amount = 500 AND date = '2026-09-18 12:00:00'::timestamp AND "notAnimalSpecific" = true;

-- Veterinary → Vet Cost
UPDATE "Transaction" SET category = 'Vet Cost', "updatedAt" = CURRENT_TIMESTAMP
WHERE category = 'Veterinary' AND "notAnimalSpecific" = true;

-- Update vet descriptions to match sheet
UPDATE "Transaction" SET description = 'Hamid - Deworming 4 animals', "updatedAt" = CURRENT_TIMESTAMP
WHERE description = 'Deworming Vet' AND amount = 1500 AND "notAnimalSpecific" = true;

UPDATE "Transaction" SET description = 'M Ramzan vet - 1st failed insemination', "updatedAt" = CURRENT_TIMESTAMP
WHERE description = 'M Ramzan vet' AND amount = 4000 AND "notAnimalSpecific" = true;

UPDATE "Transaction" SET description = 'Hamid vet - Treatment of BEF in 7 animals', "updatedAt" = CURRENT_TIMESTAMP
WHERE description = 'Hamid vet' AND amount = 9200 AND "notAnimalSpecific" = true;

-- Breeding / AI → Vet Cost
UPDATE "Transaction" SET category = 'Vet Cost', "updatedAt" = CURRENT_TIMESTAMP
WHERE category = 'Breeding / AI' AND "notAnimalSpecific" = true;

-- Labour / Wages (Javed salary entries) → Worker Salary
UPDATE "Transaction" SET category = 'Worker Salary', "updatedAt" = CURRENT_TIMESTAMP
WHERE category = 'Labour / Wages' AND "notAnimalSpecific" = true
  AND (description ILIKE '%javed%salary%' OR (description = 'Javed' AND amount IN (1000)));

-- Equipment entries that are actually labour → Labour Cost
UPDATE "Transaction" SET category = 'Labour Cost', "updatedAt" = CURRENT_TIMESTAMP
WHERE description = 'Camera labour' AND amount = 2000 AND "notAnimalSpecific" = true;

UPDATE "Transaction" SET category = 'Labour Cost', "updatedAt" = CURRENT_TIMESTAMP
WHERE description = 'Mustaqeem autos' AND amount = 2500 AND "notAnimalSpecific" = true;

UPDATE "Transaction" SET category = 'Labour Cost', "updatedAt" = CURRENT_TIMESTAMP
WHERE description = 'Loader kraya' AND amount = 700 AND "notAnimalSpecific" = true;

UPDATE "Transaction" SET category = 'Labour Cost', "updatedAt" = CURRENT_TIMESTAMP
WHERE description = 'Frames karaya' AND amount = 1300 AND "notAnimalSpecific" = true;

-- Utilities → Operational Cost
UPDATE "Transaction" SET category = 'Operational Cost', "updatedAt" = CURRENT_TIMESTAMP
WHERE category = 'Utilities' AND "notAnimalSpecific" = true;

-- Shed / Maintenance → Construction
UPDATE "Transaction" SET category = 'Construction', "updatedAt" = CURRENT_TIMESTAMP
WHERE category = 'Shed / Maintenance' AND "notAnimalSpecific" = true;

-- Animal Purchase → Farm animal
UPDATE "Transaction" SET category = 'Farm animal', "updatedAt" = CURRENT_TIMESTAMP
WHERE category = 'Animal Purchase' AND description = 'Ducks 4x' AND "notAnimalSpecific" = true;

-- Other Expense → specific categories
UPDATE "Transaction" SET category = 'mics', "updatedAt" = CURRENT_TIMESTAMP
WHERE description = 'M Hussain' AND amount = 25000 AND "notAnimalSpecific" = true;

UPDATE "Transaction" SET category = 'Loan - Javed', "updatedAt" = CURRENT_TIMESTAMP
WHERE description = 'Javed loan' AND amount = 10000 AND "notAnimalSpecific" = true;

UPDATE "Transaction" SET category = 'Tenent Advance', "updatedAt" = CURRENT_TIMESTAMP
WHERE description LIKE 'Remaining advance to Arham%' AND amount = 22500 AND "notAnimalSpecific" = true;

-- Insert the new Sep 20 vet entry that was missing from the original migration
WITH owner AS (
  SELECT id FROM "User" WHERE role = 'OWNER' LIMIT 1
)
INSERT INTO "Transaction" (id, date, type, category, amount, description, vendor, reference, "notAnimalSpecific", "createdById", "updatedAt")
SELECT gen_random_uuid()::text, '2026-09-20 12:00:00'::timestamp, 'EXPENSE'::"TxnType",
       'Vet Cost', 4500, 'Hamid - Protocol Injections - 2 animals', 'Hamid', 'Paid by Fahad',
       true, owner.id, CURRENT_TIMESTAMP
FROM owner
WHERE NOT EXISTS (
  SELECT 1 FROM "Transaction" t
  WHERE t.date = '2026-09-20 12:00:00'::timestamp
    AND t.description = 'Hamid - Protocol Injections - 2 animals'
    AND t.amount = 4500
);
