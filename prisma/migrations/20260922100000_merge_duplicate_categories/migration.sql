-- Merge "Feed" into "Feeding Cost"
UPDATE "Transaction" SET category = 'Feeding Cost', "updatedAt" = CURRENT_TIMESTAMP
WHERE category = 'Feed';

-- Merge "Animal Purchase" into "Farm animal"
UPDATE "Transaction" SET category = 'Farm animal', "updatedAt" = CURRENT_TIMESTAMP
WHERE category = 'Animal Purchase';

-- Clean up any Category records for the merged names
DELETE FROM "Category" WHERE name IN ('Feed', 'Animal Purchase') AND type = 'EXPENSE';
