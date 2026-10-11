-- Rename the expense "main categories" to match the farm's master spreadsheet.
-- Old: Operational / Capital & Construction / Animal Purchases / Other
-- New: Monthly Operational Cost / Running Expense / Fix Cost / Misc / To be Received
--
-- Explicit assignments made in Settings are remapped onto the closest new
-- group. "Operational" split into fixed monthly commitments and variable
-- running costs, so it is resolved per category rather than wholesale.

UPDATE "Category" SET "group" = 'Monthly Operational Cost'
WHERE "group" = 'Operational'
  AND "name" IN ('Farm Rent','Worker Salary','Caretaker Salary','Farm Camera SIM data',
                 'Operational Cost','Bijli / Utilities','Utilities','Insurance');

UPDATE "Category" SET "group" = 'Running Expense' WHERE "group" = 'Operational';
UPDATE "Category" SET "group" = 'Fix Cost' WHERE "group" = 'Capital & Construction';
UPDATE "Category" SET "group" = 'Misc' WHERE "group" IN ('Animal Purchases', 'Other');
