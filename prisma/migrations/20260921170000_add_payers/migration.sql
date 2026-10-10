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

-- Backfill: the June–September expense seed recorded who paid in the reference
-- field ("Paid by Fahad"). Lift that into the new column so each person's
-- investment totals from day one instead of starting empty.
UPDATE "Transaction"
SET "paidBy" = btrim(substring("reference" from 9))
WHERE "paidBy" IS NULL
  AND "reference" ILIKE 'Paid by %'
  AND btrim(substring("reference" from 9)) <> '';

-- Everyone found that way becomes a suggestion, so they can be picked on new
-- entries without being typed out again.
INSERT INTO "Payer" (id, name, "createdAt")
SELECT gen_random_uuid()::text, t."paidBy", CURRENT_TIMESTAMP
FROM (SELECT DISTINCT "paidBy" FROM "Transaction" WHERE "paidBy" IS NOT NULL) t
ON CONFLICT (name) DO NOTHING;
