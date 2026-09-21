-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "batchCostId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_batchCostId_key" ON "Transaction"("batchCostId");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_batchCostId_fkey" FOREIGN KEY ("batchCostId") REFERENCES "BatchCost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
