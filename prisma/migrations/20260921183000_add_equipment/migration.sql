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
