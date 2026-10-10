-- Merge "Farm animal" category into "Animal Purchase" to unify animal cost tracking.
UPDATE "Transaction" SET category = 'Animal Purchase', "updatedAt" = CURRENT_TIMESTAMP
WHERE category = 'Farm animal';
