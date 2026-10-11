-- Delete all "Milk Sales" transactions from the ledger
DELETE FROM "Transaction" WHERE category = 'Milk Sales';

-- Remove "Milk Sales" from custom categories if present
DELETE FROM "Category" WHERE name = 'Milk Sales';
