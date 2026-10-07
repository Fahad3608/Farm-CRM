-- Add new species values to the existing enum
ALTER TYPE "Species" ADD VALUE IF NOT EXISTS 'BULL';
ALTER TYPE "Species" ADD VALUE IF NOT EXISTS 'BULL_CALF';
ALTER TYPE "Species" ADD VALUE IF NOT EXISTS 'HEIFER_CALF';
ALTER TYPE "Species" ADD VALUE IF NOT EXISTS 'GOAT_KID';

-- Migrate existing data
UPDATE "Animal" SET species = 'BULL'::"Species", "updatedAt" = CURRENT_TIMESTAMP WHERE species = 'BUFFALO'::"Species";
UPDATE "Animal" SET species = 'BULL_CALF'::"Species", "updatedAt" = CURRENT_TIMESTAMP WHERE species = 'CALF'::"Species" AND sex = 'MALE'::"Sex";
UPDATE "Animal" SET species = 'HEIFER_CALF'::"Species", "updatedAt" = CURRENT_TIMESTAMP WHERE species = 'CALF'::"Species" AND sex = 'FEMALE'::"Sex";
-- Any remaining CALF (no sex set) defaults to BULL_CALF
UPDATE "Animal" SET species = 'BULL_CALF'::"Species", "updatedAt" = CURRENT_TIMESTAMP WHERE species = 'CALF'::"Species";
UPDATE "Animal" SET species = 'COW'::"Species", "updatedAt" = CURRENT_TIMESTAMP WHERE species = 'POULTRY'::"Species";
UPDATE "Animal" SET species = 'COW'::"Species", "updatedAt" = CURRENT_TIMESTAMP WHERE species = 'OTHER'::"Species";

-- Recreate the enum without old values
ALTER TABLE "Animal" ALTER COLUMN "species" TYPE text;
DROP TYPE "Species";
CREATE TYPE "Species" AS ENUM ('COW', 'BULL', 'BULL_CALF', 'HEIFER', 'HEIFER_CALF', 'GOAT', 'GOAT_KID', 'SHEEP', 'HORSE');
ALTER TABLE "Animal" ALTER COLUMN "species" TYPE "Species" USING "species"::"Species";
