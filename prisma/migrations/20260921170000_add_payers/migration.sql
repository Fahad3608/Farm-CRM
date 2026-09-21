-- CreateTable
CREATE TABLE "Payer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payer_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "paidBy" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Payer_name_key" ON "Payer"("name");

-- CreateIndex
CREATE INDEX "Transaction_paidBy_idx" ON "Transaction"("paidBy");
