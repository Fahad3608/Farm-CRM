-- Convert species column to text so we can freely update values
ALTER TABLE "Animal" ALTER COLUMN "species" TYPE text;
DROP TYPE "Species";

-- Migrate existing data (all text now, no enum constraint)
UPDATE "Animal" SET species = 'BULL', "updatedAt" = CURRENT_TIMESTAMP WHERE species = 'BUFFALO';
UPDATE "Animal" SET species = 'BULL_CALF', "updatedAt" = CURRENT_TIMESTAMP WHERE species = 'CALF' AND sex = 'MALE'::"Sex";
UPDATE "Animal" SET species = 'HEIFER_CALF', "updatedAt" = CURRENT_TIMESTAMP WHERE species = 'CALF' AND sex = 'FEMALE'::"Sex";
-- Any remaining CALF (no sex set) defaults to BULL_CALF
UPDATE "Animal" SET species = 'BULL_CALF', "updatedAt" = CURRENT_TIMESTAMP WHERE species = 'CALF';
UPDATE "Animal" SET species = 'COW', "updatedAt" = CURRENT_TIMESTAMP WHERE species = 'POULTRY';
UPDATE "Animal" SET species = 'COW', "updatedAt" = CURRENT_TIMESTAMP WHERE species = 'OTHER';

-- Recreate the enum with only the final values and cast column back
CREATE TYPE "Species" AS ENUM ('COW', 'BULL', 'BULL_CALF', 'HEIFER', 'HEIFER_CALF', 'GOAT', 'GOAT_KID', 'SHEEP', 'HORSE');
ALTER TABLE "Animal" ALTER COLUMN "species" TYPE "Species" USING "species"::"Species";
