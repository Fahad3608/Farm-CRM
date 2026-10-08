CREATE TYPE "EquipmentStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED');
CREATE TYPE "EquipmentKind" AS ENUM ('EQUIPMENT', 'CONSTRUCTION');
CREATE TABLE "Equipment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "EquipmentKind" NOT NULL DEFAULT 'EQUIPMENT',
    "status" "EquipmentStatus" NOT NULL DEFAULT 'PLANNED',
    "location" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Equipment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Equipment_status_idx" ON "Equipment"("status");
ALTER TABLE "Transaction" ADD COLUMN "equipmentId" TEXT;
CREATE INDEX "Transaction_equipmentId_idx" ON "Transaction"("equipmentId");
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_equipmentId_fkey"
  FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed Equipment items from existing equipment/construction expense transactions,
-- then link each transaction to its Equipment item via equipmentId.

UPDATE "Transaction" SET category = 'Equipment', "updatedAt" = CURRENT_TIMESTAMP
WHERE category = 'Material Cost (Equipment)';

UPDATE "Transaction" SET category = 'Construction', "updatedAt" = CURRENT_TIMESTAMP
WHERE category = 'Construction Costs';

INSERT INTO "Equipment" (id, name, kind, status, notes, "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, v.name, 'EQUIPMENT'::"EquipmentKind", 'COMPLETED'::"EquipmentStatus", v.notes, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (VALUES
  ('Chairs', NULL),
  ('CCTV Cameras', NULL),
  ('Cooler wire', NULL),
  ('Battery', NULL),
  ('Solar Plate', NULL),
  ('Water drum', 'Water Drum 1x'),
  ('Tokaraay', 'Tokaraay 2x'),
  ('Drum frames', 'Drum frames 2x')
) AS v(name, notes)
WHERE NOT EXISTS (SELECT 1 FROM "Equipment" e WHERE e.name = v.name);

INSERT INTO "Equipment" (id, name, kind, status, notes, "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, v.name, 'CONSTRUCTION'::"EquipmentKind", 'COMPLETED'::"EquipmentStatus", NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (VALUES
  ('Shed Partition'),
  ('Chicken Coop')
) AS v(name)
WHERE NOT EXISTS (SELECT 1 FROM "Equipment" e WHERE e.name = v.name);

UPDATE "Transaction" SET "equipmentId" = (SELECT id FROM "Equipment" WHERE name = 'Chairs' LIMIT 1), "updatedAt" = CURRENT_TIMESTAMP
WHERE description = 'Chairs' AND category = 'Equipment' AND "equipmentId" IS NULL;

UPDATE "Transaction" SET "equipmentId" = (SELECT id FROM "Equipment" WHERE name = 'CCTV Cameras' LIMIT 1), "updatedAt" = CURRENT_TIMESTAMP
WHERE description = 'CCTV Cameras' AND category = 'Equipment' AND "equipmentId" IS NULL;

UPDATE "Transaction" SET "equipmentId" = (SELECT id FROM "Equipment" WHERE name = 'Cooler wire' LIMIT 1), "updatedAt" = CURRENT_TIMESTAMP
WHERE description = 'Cooler wire' AND category = 'Equipment' AND "equipmentId" IS NULL;

UPDATE "Transaction" SET "equipmentId" = (SELECT id FROM "Equipment" WHERE name = 'Battery' LIMIT 1), "updatedAt" = CURRENT_TIMESTAMP
WHERE description = 'Battery' AND category = 'Equipment' AND "equipmentId" IS NULL;

UPDATE "Transaction" SET "equipmentId" = (SELECT id FROM "Equipment" WHERE name = 'Solar Plate' LIMIT 1), "updatedAt" = CURRENT_TIMESTAMP
WHERE description = 'Solar Plate' AND category = 'Equipment' AND "equipmentId" IS NULL;

UPDATE "Transaction" SET "equipmentId" = (SELECT id FROM "Equipment" WHERE name = 'Water drum' LIMIT 1), "updatedAt" = CURRENT_TIMESTAMP
WHERE description = 'Water drum' AND category = 'Equipment' AND "equipmentId" IS NULL;

UPDATE "Transaction" SET "equipmentId" = (SELECT id FROM "Equipment" WHERE name = 'Tokaraay' LIMIT 1), "updatedAt" = CURRENT_TIMESTAMP
WHERE description = 'Tokaraay' AND category = 'Equipment' AND "equipmentId" IS NULL;

UPDATE "Transaction" SET "equipmentId" = (SELECT id FROM "Equipment" WHERE name = 'Drum frames' LIMIT 1), "updatedAt" = CURRENT_TIMESTAMP
WHERE description = 'Drum frames' AND category = 'Equipment' AND "equipmentId" IS NULL;

UPDATE "Transaction" SET "equipmentId" = (SELECT id FROM "Equipment" WHERE name = 'Shed Partition' LIMIT 1), "updatedAt" = CURRENT_TIMESTAMP
WHERE description = 'Shed Partition cost' AND category = 'Construction' AND "equipmentId" IS NULL;

UPDATE "Transaction" SET "equipmentId" = (SELECT id FROM "Equipment" WHERE name = 'Chicken Coop' LIMIT 1), "updatedAt" = CURRENT_TIMESTAMP
WHERE description = 'Chicken Coop cost' AND category = 'Construction' AND "equipmentId" IS NULL;
