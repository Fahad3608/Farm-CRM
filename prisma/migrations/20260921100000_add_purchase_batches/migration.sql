-- CreateTable
CREATE TABLE "PurchaseBatch" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BatchCost" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BatchCost_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Animal" ADD COLUMN "purchaseBatchId" TEXT;

-- CreateIndex
CREATE INDEX "BatchCost_batchId_idx" ON "BatchCost"("batchId");

-- CreateIndex
CREATE INDEX "Animal_purchaseBatchId_idx" ON "Animal"("purchaseBatchId");

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_purchaseBatchId_fkey" FOREIGN KEY ("purchaseBatchId") REFERENCES "PurchaseBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchCost" ADD CONSTRAINT "BatchCost_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "PurchaseBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
