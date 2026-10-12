-- Animal Purchase becomes a main category of its own.
--
-- An earlier migration folded the old "Animal Purchases" group into "Misc".
-- Where that left a stored assignment behind it would override the new
-- default, so point livestock categories at the new group explicitly.

UPDATE "Category"
SET "group" = 'Animal Purchase'
WHERE type = 'EXPENSE'
  AND name IN ('Animal Purchase', 'Batch Cost');
