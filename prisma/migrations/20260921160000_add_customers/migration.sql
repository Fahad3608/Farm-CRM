-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerRate" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'litre',
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "dailyQty" DECIMAL(12,3),
    "category" TEXT NOT NULL DEFAULT 'Milk Sales',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "rateId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "product" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "category" TEXT NOT NULL,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "saleId" TEXT;

-- CreateIndex
CREATE INDEX "Customer_name_idx" ON "Customer"("name");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerRate_customerId_product_key" ON "CustomerRate"("customerId", "product");

-- CreateIndex
CREATE INDEX "Sale_customerId_date_idx" ON "Sale"("customerId", "date");

-- CreateIndex
CREATE INDEX "Sale_date_idx" ON "Sale"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_saleId_key" ON "Transaction"("saleId");

-- AddForeignKey
ALTER TABLE "CustomerRate" ADD CONSTRAINT "CustomerRate_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_rateId_fkey" FOREIGN KEY ("rateId") REFERENCES "CustomerRate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
