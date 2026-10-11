-- Import expense data from the master spreadsheet CSV.
-- First, remove all manually-entered transactions (those not linked to health,
-- feed, batch, sale, or equipment records) so the CSV becomes the source of truth.
-- Also remove all INCOME transactions since income is moving to the Customers tab.

DELETE FROM "Transaction"
WHERE "healthRecordId" IS NULL
  AND "feedLogId" IS NULL
  AND "batchCostId" IS NULL
  AND "saleId" IS NULL;

-- June 2026
INSERT INTO "Transaction" ("id","type","date","amount","category","description","paidBy","createdAt","updatedAt")
VALUES
(gen_random_uuid()::text,'EXPENSE','2026-06-10T12:00:00.000Z',17000,'Farm Rent','June - Farm rent','Fahad',NOW(),NOW()),
(gen_random_uuid()::text,'EXPENSE','2026-06-15T12:00:00.000Z',20000,'Feeding Cost','Farm monthly - uncle','Fahad',NOW(),NOW()),
(gen_random_uuid()::text,'EXPENSE','2026-06-15T12:00:00.000Z',700,'Direct Purchase - Feed','Ghass day 1','Fahad',NOW(),NOW()),
(gen_random_uuid()::text,'EXPENSE','2026-06-16T12:00:00.000Z',1000,'Direct Purchase - Feed','Ghass day 2','Fahad',NOW(),NOW()),
(gen_random_uuid()::text,'EXPENSE','2026-06-17T12:00:00.000Z',1500,'Vet Cost','Hamid - Deworming 4 animals','Fahad',NOW(),NOW()),
(gen_random_uuid()::text,'EXPENSE','2026-06-20T12:00:00.000Z',800,'Direct Purchase - Feed','Ghass Javed - 1.5 mann','Fahad',NOW(),NOW()),
(gen_random_uuid()::text,'EXPENSE','2026-06-21T12:00:00.000Z',700,'Direct Purchase - Feed','Javed ghass','Haris',NOW(),NOW()),
(gen_random_uuid()::text,'EXPENSE','2026-06-23T12:00:00.000Z',5500,'Worker Salary','Javed salary','Fahad',NOW(),NOW()),
(gen_random_uuid()::text,'EXPENSE','2026-06-24T12:00:00.000Z',10000,'Feeding Cost','Farm monthly - uncle','Haris',NOW(),NOW()),
(gen_random_uuid()::text,'EXPENSE','2026-06-27T12:00:00.000Z',5000,'Feeding Cost','Farm monthly - uncle','Haris',NOW(),NOW()),
(gen_random_uuid()::text,'EXPENSE','2026-06-27T12:00:00.000Z',3800,'Equipment','Chairs','Haris',NOW(),NOW()),
(gen_random_uuid()::text,'EXPENSE','2026-06-28T12:00:00.000Z',2450,'Vet Cost','Ashgar vet','Haris',NOW(),NOW()),
(gen_random_uuid()::text,'EXPENSE','2026-06-29T12:00:00.000Z',1300,'Direct Purchase - Feed','Javed ghass','Haris',NOW(),NOW()),
(gen_random_uuid()::text,'EXPENSE','2026-06-29T12:00:00.000Z',4000,'Vet Cost','M Ramzan vet - 1st failed insemination','Haris',NOW(),NOW()),

-- July 2026
(gen_random_uuid()::text,'EXPENSE','2026-07-01T12:00:00.000Z',2000,'Worker Salary','Javed salary','Haris',NOW(),NOW()),
(gen_random_uuid()::text,'EXPENSE','2026-07-02T12:00:00.000Z',40000,'Equipment','CCTV Cameras','Haris',NOW(),NOW()),
(gen_random_uuid()::text,'EXPENSE','2026-07-02T12:00:00.000Z',2000,'Labour Cost','Camera labour','Haris',NOW(),NOW()),
(gen_random_uuid()::text,'EXPENSE','2026-07-05T12:00:00.000Z',25000,'Feeding Cost','Uncle - Farm feed','Haris',NOW(),NOW()),
(gen_random_uuid()::text,'EXPENSE','2026-07-08T12:00:00.000Z',12000,'Worker Salary','Javed salary','Fahad',NOW(),NOW()),
(gen_random_uuid()::text,'EXPENSE','2026-07-10T12:00:00.000Z',4000,'Direct Purchase - Feed','Wanda - milk','Fahad',NOW(),NOW()),
(gen_random_uuid()::text,'EXPENSE','2026-07-10T12:00:00.000Z',1500,'Direct Purchase - Feed','Chokar 1x bori','Fahad',NOW(),NOW()),
(gen_random_uuid()::text,'EXPENSE','2026-07-10T12:00:00.000Z',4000,'Direct Purchase - Feed','Wanda - milk','Fahad',NOW(),NOW()),
(gen_random_uuid()::text,'EXPENSE','2026-07-10T12:00:00.000Z',2500,'Labour Cost','Mustaqeem autos','Fahad',NOW(),NOW()),
(gen_random_uuid()::text,'EXPENSE','2026-07-10T12:00:00.000Z',4000,'Equipment','Cooler wire','Fahad',NOW(),NOW()),
(gen_random_uuid()::text,'EXPENSE','2026-07-10T12:00:00.000Z',11000,'Equipment','Battery','Fahad',NOW(),NOW()),
(gen_random_uuid()::text,'EXPENSE','2026-07-11T12:00:00.000Z',3000,'Farm Camera SIM data','Camera SIM pkg - 30 days','Fahad',NOW(),NOW()),
(gen_random_uuid()::text,'EXPENSE','2026-07-24T12:00:00.000Z',20000,'Feeding Cost','Uncle - Farm feed','Haris',NOW(),NOW()),
(gen_random_uuid()::text,'EXPENSE','2026-07-25T12:00:00.000Z',25000,'mics','M Hussain','Haris',NOW(),NOW()),
(gen_random_uuid()::text,'EXPENSE','2026-07-26T12:00:00.000Z',25000,'Feeding Cost','Uncle - Farm feed','Haris',NOW(),NOW()),
(gen_random_uuid()::text,'EXPENSE','2026-07-31T12:00:00.000Z',9200,'Vet Cost','Hamid vet - Treatment of BEF in 7 animals','Fahad',NOW(),NOW()),

-- August 2026
(gen_random_uuid()::text,'EXPENSE','2026-08-05T12:00:00.000Z',15000,'Worker Salary','Javed salary','Fahad',NOW(),NOW()),
(gen_random_uuid()::text,'EXPENSE','2026-08-10T12:00:00.000Z',3000,'Farm Camera SIM data','Camera SIM pkg - 30 days','Fahad',NOW(),NOW()),
(gen_random_uuid()::text,'EXPENSE','2026-08-12T12:00:00.000Z',4000,'Worker Salary','Javed salary','Fahad',NOW(),NOW()),
(gen_random_uuid()::text,'EXPENSE','2026-08-18T12:00:00.000Z',10000,'Loan - Javed','Javed','Fahad',NOW(),NOW()),
(gen_random_uuid()::text,'EXPENSE','2026-08-12T12:00:00.000Z',1200,'Vet Cost','Hamid Vet','Fahad',NOW(),NOW()),
(gen_random_uuid()::text,'EXPENSE','2026-08-17T12:00:00.000Z',2000,'Worker Salary','Javed salary','Haris',NOW(),NOW()),
(gen_random_uuid()::text,'EXPENSE','2026-08-17T12:00:00.000Z',23600,'Equipment','Solar Plate','Fahad',NOW(),NOW()),
(gen_random_uuid()::text,'EXPENSE','2026-08-17T12:00:00.000Z',700,'Labour Cost','loader kraya','Fahad',NOW(),NOW()),
(gen_random_uuid()::text,'EXPENSE','2026-08-17T12:00:00.000Z',2500,'Vet Cost','Hamid Vet','Fahad',NOW(),NOW()),
(gen_random_uuid()::text,'EXPENSE','2026-08-18T12:00:00.000Z',50000,'Feeding Cost','Uncle - Farm feed','Haris',NOW(),NOW()),
(gen_random_uuid()::text,'EXPENSE','2026-08-29T12:00:00.000Z',30000,'Feeding Cost','Uncle - Farm feed','Haris',NOW(),NOW()),
(gen_random_uuid()::text,'EXPENSE','2026-08-29T12:00:00.000Z',20000,'Worker Salary','Javed salary','Fahad',NOW(),NOW()),

-- September 2026
(gen_random_uuid()::text,'EXPENSE','2026-09-12T12:00:00.000Z',34500,'Construction','Shed Partition cost','Fahad',NOW(),NOW()),
(gen_random_uuid()::text,'EXPENSE','2026-09-12T12:00:00.000Z',24200,'Construction','Chicken Coop cost','Fahad',NOW(),NOW()),
(gen_random_uuid()::text,'EXPENSE','2026-09-12T12:00:00.000Z',6000,'Equipment','Water Drum 1x','Fahad',NOW(),NOW()),
(gen_random_uuid()::text,'EXPENSE','2026-09-12T12:00:00.000Z',1000,'Equipment','Tokaraay 2x','Fahad',NOW(),NOW()),
(gen_random_uuid()::text,'EXPENSE','2026-09-12T12:00:00.000Z',12000,'Equipment','Drum frames 2x','Fahad',NOW(),NOW()),
(gen_random_uuid()::text,'EXPENSE','2026-09-12T12:00:00.000Z',1300,'Labour Cost','Frames karaya loader','Fahad',NOW(),NOW()),
(gen_random_uuid()::text,'EXPENSE','2026-09-12T12:00:00.000Z',9000,'Animal Purchase','Ducks 4x','Fahad',NOW(),NOW()),
(gen_random_uuid()::text,'EXPENSE','2026-09-12T12:00:00.000Z',1000,'Worker Salary','Javed salary','Haris',NOW(),NOW()),
(gen_random_uuid()::text,'EXPENSE','2026-09-15T12:00:00.000Z',22500,'Tenent Advance','Remaining advance to Arham - 100k completed','Haris',NOW(),NOW()),
(gen_random_uuid()::text,'EXPENSE','2026-09-16T12:00:00.000Z',600,'Vet Cost','Javed - Injection','Haris',NOW(),NOW()),
(gen_random_uuid()::text,'EXPENSE','2026-09-16T12:00:00.000Z',7800,'Farm Camera SIM data','Camera SIM pkg - 90 days','Fahad',NOW(),NOW()),
(gen_random_uuid()::text,'EXPENSE','2026-09-16T12:00:00.000Z',3000,'Vet Cost','Dr Abdul haq - Black bachri Insemination','Haris',NOW(),NOW()),
(gen_random_uuid()::text,'EXPENSE','2026-09-17T12:00:00.000Z',20000,'Feeding Cost','Uncle - Farm feed','Haris',NOW(),NOW()),
(gen_random_uuid()::text,'EXPENSE','2026-09-18T12:00:00.000Z',5000,'Direct Purchase - Feed','Javed','Fahad',NOW(),NOW()),
(gen_random_uuid()::text,'EXPENSE','2026-09-20T12:00:00.000Z',500,'Direct Purchase - Feed','Javed','Haris',NOW(),NOW()),
(gen_random_uuid()::text,'EXPENSE','2026-09-21T12:00:00.000Z',4500,'Vet Cost','Hamid - Protocol Injections - 2 animals','Fahad',NOW(),NOW()),
(gen_random_uuid()::text,'EXPENSE','2026-09-24T12:00:00.000Z',1800,'Equipment','Javed','Haris',NOW(),NOW()),
(gen_random_uuid()::text,'EXPENSE','2026-09-26T12:00:00.000Z',2000,'Worker Salary','Javed salary','Fahad',NOW(),NOW()),
(gen_random_uuid()::text,'EXPENSE','2026-09-27T12:00:00.000Z',15500,'Direct Purchase - Feed','Wanda 2x 1x Chokar 1x - CP wanda','Fahad',NOW(),NOW()),
(gen_random_uuid()::text,'EXPENSE','2026-09-29T12:00:00.000Z',50000,'Feeding Cost','Uncle - Farm feed','Haris',NOW(),NOW()),
(gen_random_uuid()::text,'EXPENSE','2026-09-29T12:00:00.000Z',2000,'Equipment','Javed','Fahad',NOW(),NOW()),
(gen_random_uuid()::text,'EXPENSE','2026-09-30T12:00:00.000Z',24500,'Worker Salary','Javed salary','Fahad',NOW(),NOW()),
(gen_random_uuid()::text,'EXPENSE','2026-09-30T12:00:00.000Z',500,'Worker Salary','Javed','Haris',NOW(),NOW()),

-- October 2026
(gen_random_uuid()::text,'EXPENSE','2026-10-01T12:00:00.000Z',1200,'Direct Purchase - Feed','Wanda 5kg Indus','Haris',NOW(),NOW()),
(gen_random_uuid()::text,'EXPENSE','2026-10-02T12:00:00.000Z',2000,'Equipment','Javed','Haris',NOW(),NOW()),
(gen_random_uuid()::text,'EXPENSE','2026-10-03T12:00:00.000Z',2000,'Worker Salary','Javed','Haris',NOW(),NOW()),
(gen_random_uuid()::text,'EXPENSE','2026-10-03T12:00:00.000Z',9200,'Equipment','Charpaaii 2x','Haris',NOW(),NOW()),
(gen_random_uuid()::text,'EXPENSE','2026-10-07T12:00:00.000Z',820,'mics','Irfan Ghous','Haris',NOW(),NOW()),
(gen_random_uuid()::text,'EXPENSE','2026-10-07T12:00:00.000Z',600,'mics','Javed','Haris',NOW(),NOW()),
(gen_random_uuid()::text,'EXPENSE','2026-10-08T12:00:00.000Z',1000,'Worker Salary','Javed salary','Haris',NOW(),NOW()),
(gen_random_uuid()::text,'EXPENSE','2026-10-09T12:00:00.000Z',5000,'Worker Salary','Javed salary','Fahad',NOW(),NOW()),
(gen_random_uuid()::text,'EXPENSE','2026-10-10T12:00:00.000Z',25300,'Direct Purchase - Feed','Wanda 4x 2x Calf starter - CP wanda','Fahad',NOW(),NOW()),
(gen_random_uuid()::text,'EXPENSE','2026-10-12T12:00:00.000Z',4260,'Vet Cost','Dr Hamid - Deworming, Bacharay injected','Fahad',NOW(),NOW());

-- Normalize payer name: Harris -> Haris (same person)
UPDATE "Transaction" SET "paidBy" = 'Haris' WHERE "paidBy" = 'Harris';

-- Ensure the payers exist in the Payer table
INSERT INTO "Payer" ("id","name","createdAt")
VALUES (gen_random_uuid()::text,'Fahad',NOW())
ON CONFLICT DO NOTHING;

INSERT INTO "Payer" ("id","name","createdAt")
VALUES (gen_random_uuid()::text,'Haris',NOW())
ON CONFLICT DO NOTHING;

-- Add Farm Camera SIM data category
INSERT INTO "Category" ("id","name","type","createdAt")
VALUES (gen_random_uuid()::text,'Farm Camera SIM data','EXPENSE',NOW())
ON CONFLICT DO NOTHING;
