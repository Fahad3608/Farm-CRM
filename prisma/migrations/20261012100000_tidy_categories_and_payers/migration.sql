-- Tidy up the two suggestion lists Finance offers.
--
-- 1. An earlier migration merged the "Harris" spelling into "Haris" on every
--    transaction but left the duplicate payer behind, so both still showed in
--    the "Paid by" filter. Drop it only if nothing references it.
DELETE FROM "Payer" p
WHERE p.name = 'Harris'
  AND NOT EXISTS (SELECT 1 FROM "Transaction" t WHERE t."paidBy" = p.name);

-- 2. Sub-categories are now the master spreadsheet's own list. Remove stored
--    expense categories outside it, but keep any that entries are actually
--    filed under — deleting those would leave the ledger referring to a
--    category the picker no longer offers.
DELETE FROM "Category" c
WHERE c.type = 'EXPENSE'
  AND c.name NOT IN (
    'Farm Rent', 'Worker Salary', 'Farm Camera SIM data',
    'Feeding Cost', 'Direct Purchase - Feed', 'Vet Cost',
    'Equipment', 'Construction', 'Labour Cost',
    'Animal Purchase', 'Loan - Javed', 'mics',
    'Tenent Advance'
  )
  AND NOT EXISTS (SELECT 1 FROM "Transaction" t WHERE t.category = c.name);
