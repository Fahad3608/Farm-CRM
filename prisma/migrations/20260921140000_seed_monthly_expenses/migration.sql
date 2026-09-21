-- Seed monthly running expenses from the farm mastersheet (June–September 2026).
-- These are real farm expenses that need to exist in the production database,
-- not just the demo seed. Uses a CTE to look up the first OWNER user for createdById.
-- Idempotent: skips rows whose (date, description, amount, category) already exist.

WITH owner AS (
  SELECT id FROM "User" WHERE role = 'OWNER' LIMIT 1
)
INSERT INTO "Transaction" (id, date, type, category, amount, description, vendor, reference, "notAnimalSpecific", "createdById")
SELECT * FROM (
  VALUES
    -- June 2026
    (gen_random_uuid()::text, '2026-06-10 12:00:00'::timestamp, 'EXPENSE', 'Farm Rent',          17000,  'June - Farm rent',                        NULL,              'Paid by Fahad',  true),
    (gen_random_uuid()::text, '2026-06-15 12:00:00'::timestamp, 'EXPENSE', 'Feed',               20000,  'Farm monthly - uncle',                    'Uncle',           'Paid by Fahad',  true),
    (gen_random_uuid()::text, '2026-06-15 12:00:00'::timestamp, 'EXPENSE', 'Feed',               700,    'Ghass day 1',                             NULL,              'Paid by Fahad',  true),
    (gen_random_uuid()::text, '2026-06-16 12:00:00'::timestamp, 'EXPENSE', 'Feed',               1000,   'Ghass day 2',                             NULL,              'Paid by Fahad',  true),
    (gen_random_uuid()::text, '2026-06-17 12:00:00'::timestamp, 'EXPENSE', 'Veterinary',         1500,   'Deworming Vet',                           NULL,              'Paid by Fahad',  true),
    (gen_random_uuid()::text, '2026-06-20 12:00:00'::timestamp, 'EXPENSE', 'Feed',               800,    'Ghass Javed - 1.5 mann',                  NULL,              'Paid by Fahad',  true),
    (gen_random_uuid()::text, '2026-06-21 12:00:00'::timestamp, 'EXPENSE', 'Feed',               700,    'Javed ghass',                             NULL,              'Paid by Harris', true),
    (gen_random_uuid()::text, '2026-06-23 12:00:00'::timestamp, 'EXPENSE', 'Labour / Wages',     5500,   'Javed salary',                            'Javed',           'Paid by Fahad',  true),
    (gen_random_uuid()::text, '2026-06-24 12:00:00'::timestamp, 'EXPENSE', 'Feed',               10000,  'Haris -> uncle',                          'Uncle',           'Paid by Harris', true),
    (gen_random_uuid()::text, '2026-06-27 12:00:00'::timestamp, 'EXPENSE', 'Feed',               5000,   'Haris -> uncle',                          'Uncle',           'Paid by Harris', true),
    (gen_random_uuid()::text, '2026-06-27 12:00:00'::timestamp, 'EXPENSE', 'Equipment',          3800,   'Chairs',                                  NULL,              'Paid by Harris', true),
    (gen_random_uuid()::text, '2026-06-28 12:00:00'::timestamp, 'EXPENSE', 'Veterinary',         2450,   'Ashgar vet',                              'Ashgar',          'Paid by Harris', true),
    (gen_random_uuid()::text, '2026-06-29 12:00:00'::timestamp, 'EXPENSE', 'Feed',               1300,   'Javed ghass',                             NULL,              'Paid by Harris', true),
    (gen_random_uuid()::text, '2026-06-29 12:00:00'::timestamp, 'EXPENSE', 'Veterinary',         4000,   'M Ramzan vet',                            'M Ramzan',        'Paid by Harris', true),
    -- July 2026
    (gen_random_uuid()::text, '2026-07-01 12:00:00'::timestamp, 'EXPENSE', 'Labour / Wages',     2000,   'Javed salary',                            'Javed',           'Paid by Harris', true),
    (gen_random_uuid()::text, '2026-07-02 12:00:00'::timestamp, 'EXPENSE', 'Equipment',          40000,  'CCTV Cameras',                            NULL,              'Paid by Harris', true),
    (gen_random_uuid()::text, '2026-07-02 12:00:00'::timestamp, 'EXPENSE', 'Equipment',          2000,   'Camera labour',                           NULL,              'Paid by Harris', true),
    (gen_random_uuid()::text, '2026-07-05 12:00:00'::timestamp, 'EXPENSE', 'Feed',               25000,  'Uncle - Farm feed',                       'Uncle',           'Paid by Harris', true),
    (gen_random_uuid()::text, '2026-07-08 12:00:00'::timestamp, 'EXPENSE', 'Labour / Wages',     12000,  'Javed salary',                            'Javed',           'Paid by Fahad',  true),
    (gen_random_uuid()::text, '2026-07-10 12:00:00'::timestamp, 'EXPENSE', 'Feed',               4000,   'Wanda - milk',                            NULL,              'Paid by Fahad',  true),
    (gen_random_uuid()::text, '2026-07-10 12:00:00'::timestamp, 'EXPENSE', 'Feed',               1500,   'Chokar',                                  NULL,              'Paid by Fahad',  true),
    (gen_random_uuid()::text, '2026-07-10 12:00:00'::timestamp, 'EXPENSE', 'Feed',               4000,   'Wanda - milk',                            NULL,              'Paid by Fahad',  true),
    (gen_random_uuid()::text, '2026-07-10 12:00:00'::timestamp, 'EXPENSE', 'Equipment',          2500,   'Mustaqeem autos',                         'Mustaqeem autos', 'Paid by Fahad',  true),
    (gen_random_uuid()::text, '2026-07-10 12:00:00'::timestamp, 'EXPENSE', 'Equipment',          4000,   'Cooler wire',                             NULL,              'Paid by Fahad',  true),
    (gen_random_uuid()::text, '2026-07-10 12:00:00'::timestamp, 'EXPENSE', 'Equipment',          11000,  'Battery',                                 NULL,              'Paid by Fahad',  true),
    (gen_random_uuid()::text, '2026-07-11 12:00:00'::timestamp, 'EXPENSE', 'Utilities',          3000,   'Camera sim pkg',                          NULL,              'Paid by Fahad',  true),
    (gen_random_uuid()::text, '2026-07-24 12:00:00'::timestamp, 'EXPENSE', 'Feed',               20000,  'Uncle - Farm feed',                       'Uncle',           'Paid by Harris', true),
    (gen_random_uuid()::text, '2026-07-25 12:00:00'::timestamp, 'EXPENSE', 'Other Expense',      25000,  'M Hussain',                               'M Hussain',       'Paid by Harris', true),
    (gen_random_uuid()::text, '2026-07-26 12:00:00'::timestamp, 'EXPENSE', 'Feed',               25000,  'Uncle - Farm feed',                       'Uncle',           'Paid by Harris', true),
    (gen_random_uuid()::text, '2026-07-31 12:00:00'::timestamp, 'EXPENSE', 'Veterinary',         9200,   'Hamid vet',                               'Hamid',           'Paid by Fahad',  true),
    -- August 2026
    (gen_random_uuid()::text, '2026-08-05 12:00:00'::timestamp, 'EXPENSE', 'Labour / Wages',     15000,  'Javed salary',                            'Javed',           'Paid by Fahad',  true),
    (gen_random_uuid()::text, '2026-08-10 12:00:00'::timestamp, 'EXPENSE', 'Utilities',          3000,   'Camera sim pkg',                          NULL,              'Paid by Fahad',  true),
    (gen_random_uuid()::text, '2026-08-12 12:00:00'::timestamp, 'EXPENSE', 'Labour / Wages',     4000,   'Javed salary',                            'Javed',           'Paid by Fahad',  true),
    (gen_random_uuid()::text, '2026-08-12 12:00:00'::timestamp, 'EXPENSE', 'Veterinary',         1200,   'Hamid Vet',                               'Hamid',           'Paid by Fahad',  true),
    (gen_random_uuid()::text, '2026-08-17 12:00:00'::timestamp, 'EXPENSE', 'Labour / Wages',     2000,   'Javed salary',                            'Javed',           'Paid by Harris', true),
    (gen_random_uuid()::text, '2026-08-17 12:00:00'::timestamp, 'EXPENSE', 'Equipment',          23600,  'Solar Plate',                             NULL,              'Paid by Fahad',  true),
    (gen_random_uuid()::text, '2026-08-17 12:00:00'::timestamp, 'EXPENSE', 'Equipment',          700,    'Loader kraya',                            NULL,              'Paid by Fahad',  true),
    (gen_random_uuid()::text, '2026-08-17 12:00:00'::timestamp, 'EXPENSE', 'Veterinary',         2500,   'Hamid Vet',                               'Hamid',           'Paid by Fahad',  true),
    (gen_random_uuid()::text, '2026-08-18 12:00:00'::timestamp, 'EXPENSE', 'Other Expense',      10000,  'Javed loan',                              'Javed',           'Paid by Fahad',  true),
    (gen_random_uuid()::text, '2026-08-18 12:00:00'::timestamp, 'EXPENSE', 'Feed',               50000,  'Uncle - Farm feed',                       'Uncle',           'Paid by Harris', true),
    (gen_random_uuid()::text, '2026-08-29 12:00:00'::timestamp, 'EXPENSE', 'Feed',               30000,  'Uncle - Farm feed',                       'Uncle',           'Paid by Harris', true),
    (gen_random_uuid()::text, '2026-08-29 12:00:00'::timestamp, 'EXPENSE', 'Labour / Wages',     20000,  'Javed salary',                            'Javed',           'Paid by Fahad',  true),
    -- September 2026
    (gen_random_uuid()::text, '2026-09-12 12:00:00'::timestamp, 'EXPENSE', 'Shed / Maintenance', 34500,  'Shed Partition cost',                     NULL,              'Paid by Fahad',  true),
    (gen_random_uuid()::text, '2026-09-12 12:00:00'::timestamp, 'EXPENSE', 'Shed / Maintenance', 24200,  'Chicken Coop cost',                       NULL,              'Paid by Fahad',  true),
    (gen_random_uuid()::text, '2026-09-12 12:00:00'::timestamp, 'EXPENSE', 'Equipment',          6000,   'Water drum',                              NULL,              'Paid by Fahad',  true),
    (gen_random_uuid()::text, '2026-09-12 12:00:00'::timestamp, 'EXPENSE', 'Equipment',          1000,   'Tokaraay',                                NULL,              'Paid by Fahad',  true),
    (gen_random_uuid()::text, '2026-09-12 12:00:00'::timestamp, 'EXPENSE', 'Equipment',          12000,  'Drum frames',                             NULL,              'Paid by Fahad',  true),
    (gen_random_uuid()::text, '2026-09-12 12:00:00'::timestamp, 'EXPENSE', 'Equipment',          1300,   'Frames karaya',                           NULL,              'Paid by Fahad',  true),
    (gen_random_uuid()::text, '2026-09-12 12:00:00'::timestamp, 'EXPENSE', 'Animal Purchase',    9000,   'Ducks 4x',                                NULL,              'Paid by Fahad',  true),
    (gen_random_uuid()::text, '2026-09-12 12:00:00'::timestamp, 'EXPENSE', 'Labour / Wages',     1000,   'Javed',                                   'Javed',           'Paid by Harris', true),
    (gen_random_uuid()::text, '2026-09-15 12:00:00'::timestamp, 'EXPENSE', 'Other Expense',      22500,  'Remaining advance to Arham - 100k completed', 'Arham',       'Paid by Harris', true),
    (gen_random_uuid()::text, '2026-09-16 12:00:00'::timestamp, 'EXPENSE', 'Labour / Wages',     600,    'Javed',                                   'Javed',           'Paid by Harris', true),
    (gen_random_uuid()::text, '2026-09-16 12:00:00'::timestamp, 'EXPENSE', 'Utilities',          7800,   'Camera sim pkg 90 days - both cameras',   NULL,              'Paid by Fahad',  true),
    (gen_random_uuid()::text, '2026-09-16 12:00:00'::timestamp, 'EXPENSE', 'Breeding / AI',      3000,   'Dr Abdul haq - Black bachri insemination', 'Dr Abdul Haq',   'Paid by Harris', true),
    (gen_random_uuid()::text, '2026-09-17 12:00:00'::timestamp, 'EXPENSE', 'Feed',               20000,  'Uncle - Farm feed',                       'Uncle',           'Paid by Harris', true),
    (gen_random_uuid()::text, '2026-09-18 12:00:00'::timestamp, 'EXPENSE', 'Other Expense',      500,    'Javed',                                   'Javed',           'Paid by Harris', true)
) AS v(id, date, type, category, amount, description, vendor, reference, "notAnimalSpecific")
CROSS JOIN owner
WHERE NOT EXISTS (
  SELECT 1 FROM "Transaction" t
  WHERE t.date = v.date AND t.description = v.description AND t.amount = v.amount AND t.category = v.category
);
