-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'MANAGER', 'VET', 'WORKER');

-- CreateEnum
CREATE TYPE "Species" AS ENUM ('COW', 'BUFFALO', 'GOAT', 'SHEEP', 'HORSE', 'POULTRY', 'OTHER');

-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "AnimalStatus" AS ENUM ('ACTIVE', 'SOLD', 'DECEASED', 'CULLED', 'LOANED_OUT');

-- CreateEnum
CREATE TYPE "AcquisitionType" AS ENUM ('BORN_ON_FARM', 'PURCHASED', 'GIFTED', 'INHERITED', 'OTHER');

-- CreateEnum
CREATE TYPE "ReproStatus" AS ENUM ('NOT_APPLICABLE', 'OPEN', 'BRED', 'PREGNANT', 'LACTATING', 'DRY', 'CASTRATED');

-- CreateEnum
CREATE TYPE "HealthRecordType" AS ENUM ('VACCINATION', 'INJECTION', 'DEWORMING', 'TREATMENT', 'CHECKUP', 'SURGERY', 'LAB_TEST', 'HOOF_CARE', 'PREGNANCY_CHECK', 'DEATH_REPORT', 'OTHER');

-- CreateEnum
CREATE TYPE "BreedingMethod" AS ENUM ('NATURAL', 'ARTIFICIAL_INSEMINATION', 'EMBRYO_TRANSFER');

-- CreateEnum
CREATE TYPE "BreedingStatus" AS ENUM ('BRED', 'CONFIRMED_PREGNANT', 'NOT_PREGNANT', 'ABORTED', 'DELIVERED');

-- CreateEnum
CREATE TYPE "TxnType" AS ENUM ('INCOME', 'EXPENSE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'WORKER',
    "clinic" TEXT,
    "licenseNo" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Animal" (
    "id" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "species" "Species" NOT NULL,
    "breed" TEXT,
    "sex" "Sex" NOT NULL,
    "color" TEXT,
    "markings" TEXT,
    "hornStatus" TEXT,
    "microchip" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "ageIsEstimated" BOOLEAN NOT NULL DEFAULT false,
    "dateJoined" TIMESTAMP(3) NOT NULL,
    "acquisition" "AcquisitionType" NOT NULL DEFAULT 'BORN_ON_FARM',
    "sourceName" TEXT,
    "purchasePrice" DECIMAL(12,2),
    "status" "AnimalStatus" NOT NULL DEFAULT 'ACTIVE',
    "exitDate" TIMESTAMP(3),
    "exitReason" TEXT,
    "salePrice" DECIMAL(12,2),
    "buyerName" TEXT,
    "reproStatus" "ReproStatus" NOT NULL DEFAULT 'NOT_APPLICABLE',
    "expectedDueDate" TIMESTAMP(3),
    "penOrLocation" TEXT,
    "insuranceNo" TEXT,
    "notes" TEXT,
    "motherId" TEXT,
    "fatherId" TEXT,
    "profilePhotoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Animal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Photo" (
    "id" TEXT NOT NULL,
    "animalId" TEXT,
    "mimeType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "thumb" BYTEA NOT NULL,
    "caption" TEXT,
    "bytes" INTEGER NOT NULL DEFAULT 0,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Photo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthRecord" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "type" "HealthRecordType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "medicine" TEXT,
    "brand" TEXT,
    "batchNo" TEXT,
    "dosage" TEXT,
    "route" TEXT,
    "diagnosis" TEXT,
    "treatment" TEXT,
    "symptoms" TEXT,
    "temperatureC" DECIMAL(4,1),
    "weightKg" DECIMAL(7,2),
    "withdrawalUntil" TIMESTAMP(3),
    "nextDueDate" TIMESTAMP(3),
    "followUpDone" BOOLEAN NOT NULL DEFAULT false,
    "medicineCost" DECIMAL(12,2),
    "vetFee" DECIMAL(12,2),
    "vetId" TEXT,
    "vetName" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HealthRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'kg',
    "costPerUnit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "supplier" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeedType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedLog" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "feedTypeId" TEXT NOT NULL,
    "animalId" TEXT,
    "groupLabel" TEXT,
    "headCount" INTEGER NOT NULL DEFAULT 1,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unitCost" DECIMAL(12,2) NOT NULL,
    "totalCost" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeightRecord" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "weightKg" DECIMAL(7,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeightRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MilkRecord" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "session" TEXT NOT NULL DEFAULT 'AM',
    "litres" DECIMAL(7,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MilkRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BreedingRecord" (
    "id" TEXT NOT NULL,
    "damId" TEXT NOT NULL,
    "sireId" TEXT,
    "sireName" TEXT,
    "method" "BreedingMethod" NOT NULL DEFAULT 'NATURAL',
    "breedingDate" TIMESTAMP(3) NOT NULL,
    "expectedDueDate" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "actualBirthDate" TIMESTAMP(3),
    "offspringCount" INTEGER,
    "offspringNotes" TEXT,
    "status" "BreedingStatus" NOT NULL DEFAULT 'BRED',
    "cost" DECIMAL(12,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BreedingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" "TxnType" NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "description" TEXT,
    "vendor" TEXT,
    "paymentMethod" TEXT,
    "reference" TEXT,
    "animalId" TEXT,
    "healthRecordId" TEXT,
    "feedLogId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Animal_tagId_key" ON "Animal"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "Animal_profilePhotoId_key" ON "Animal"("profilePhotoId");

-- CreateIndex
CREATE INDEX "Animal_species_status_idx" ON "Animal"("species", "status");

-- CreateIndex
CREATE INDEX "Animal_name_idx" ON "Animal"("name");

-- CreateIndex
CREATE INDEX "Photo_animalId_idx" ON "Photo"("animalId");

-- CreateIndex
CREATE INDEX "HealthRecord_animalId_date_idx" ON "HealthRecord"("animalId", "date");

-- CreateIndex
CREATE INDEX "HealthRecord_type_idx" ON "HealthRecord"("type");

-- CreateIndex
CREATE INDEX "HealthRecord_nextDueDate_idx" ON "HealthRecord"("nextDueDate");

-- CreateIndex
CREATE UNIQUE INDEX "FeedType_name_key" ON "FeedType"("name");

-- CreateIndex
CREATE INDEX "FeedLog_date_idx" ON "FeedLog"("date");

-- CreateIndex
CREATE INDEX "FeedLog_animalId_date_idx" ON "FeedLog"("animalId", "date");

-- CreateIndex
CREATE INDEX "WeightRecord_animalId_date_idx" ON "WeightRecord"("animalId", "date");

-- CreateIndex
CREATE INDEX "MilkRecord_animalId_date_idx" ON "MilkRecord"("animalId", "date");

-- CreateIndex
CREATE INDEX "BreedingRecord_damId_idx" ON "BreedingRecord"("damId");

-- CreateIndex
CREATE INDEX "BreedingRecord_status_idx" ON "BreedingRecord"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_healthRecordId_key" ON "Transaction"("healthRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_feedLogId_key" ON "Transaction"("feedLogId");

-- CreateIndex
CREATE INDEX "Transaction_date_idx" ON "Transaction"("date");

-- CreateIndex
CREATE INDEX "Transaction_type_category_idx" ON "Transaction"("type", "category");

-- CreateIndex
CREATE INDEX "Transaction_animalId_idx" ON "Transaction"("animalId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_motherId_fkey" FOREIGN KEY ("motherId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_fatherId_fkey" FOREIGN KEY ("fatherId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_profilePhotoId_fkey" FOREIGN KEY ("profilePhotoId") REFERENCES "Photo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthRecord" ADD CONSTRAINT "HealthRecord_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthRecord" ADD CONSTRAINT "HealthRecord_vetId_fkey" FOREIGN KEY ("vetId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthRecord" ADD CONSTRAINT "HealthRecord_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedLog" ADD CONSTRAINT "FeedLog_feedTypeId_fkey" FOREIGN KEY ("feedTypeId") REFERENCES "FeedType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedLog" ADD CONSTRAINT "FeedLog_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedLog" ADD CONSTRAINT "FeedLog_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeightRecord" ADD CONSTRAINT "WeightRecord_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilkRecord" ADD CONSTRAINT "MilkRecord_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingRecord" ADD CONSTRAINT "BreedingRecord_damId_fkey" FOREIGN KEY ("damId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingRecord" ADD CONSTRAINT "BreedingRecord_sireId_fkey" FOREIGN KEY ("sireId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_healthRecordId_fkey" FOREIGN KEY ("healthRecordId") REFERENCES "HealthRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_feedLogId_fkey" FOREIGN KEY ("feedLogId") REFERENCES "FeedLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

