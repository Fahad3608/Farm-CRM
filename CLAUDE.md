# Farm CRM

Livestock farm management system. Tracks animals, health records, breeding, feed, milk production, purchase batches, the finance ledger, who buys the farm's produce, and who funds the farm.

## Stack

- **Next.js 16** (App Router) with **React 19**, TypeScript strict
- **Prisma v6** with PostgreSQL
- **Tailwind CSS v3** with custom design tokens (see `tailwind.config.ts`)
- **Auth**: JWT sessions via `jose`, passwords via `bcryptjs` — no external auth provider
- **ESLint 9** flat config (`eslint.config.mjs`) on `eslint-config-next/core-web-vitals`
- No external UI library — all components are hand-rolled in `src/components/`
- Deployed on Vercel, which runs `npm run build` — that build is the only thing that touches the production database

## Commands

```bash
npm run dev          # Start dev server
npm run build        # prisma generate + scripts/migrate-deploy.mjs + next build
npm test             # Finance rollup and drill-down regression tests
npm run lint         # eslint . (next lint was removed in Next 16)
npx tsc --noEmit     # Typecheck — CI runs this before the build
npm run db:seed      # Seed demo data (set SEED_DEMO_DATA=true)
npm run db:migrate   # scripts/migrate-deploy.mjs (see Migrations below)
npm run db:push      # Push the schema without a migration — local scratch only
npm run db:studio    # Prisma Studio GUI
```

`npm run lint` runs `eslint .` with the flat config in `eslint.config.mjs`. CI runs the typecheck, lint and the build.

`npm run build` and `npm run db:seed` both need a reachable `DATABASE_URL`; the build applies migrations to it.

## Project structure

```
src/
  app/
    (app)/           # Authenticated routes (layout has sidebar + nav)
      animals/       # Animal list, detail (/[id]), edit, new
      batches/       # Purchase batch list and detail
      breeding/      # Breeding records
      customers/     # Buyers, their rate cards, deliveries and income
      dashboard/     # Owner/manager dashboard
      feed/          # Feed logs
      finance/       # Transaction ledger
      health/        # Health records
      settings/      # Farm settings, users, backfill actions
      vet/           # Vet-specific queue
    actions/         # Server actions (one file per domain)
    api/photos/[id]/ # Photo serving endpoint
    login/           # Sign-in (outside the authenticated layout)
    setup/           # First-run owner account creation
  components/        # Shared UI components
  lib/               # auth, db, permissions, domain, format, form, settings,
                     # tags (next Tag/ID per species), fx (currency rates),
                     # firstRun, formSuggestions
prisma/
  schema.prisma      # Single schema file
  migrations/        # SQL migrations (created manually, not via prisma migrate dev)
  seed.ts            # Demo data seeder
scripts/
  migrate-deploy.mjs # Migration deploy with failed-migration recovery
```

## Key patterns

### Server actions

All mutations live in `src/app/actions/*.ts` as `"use server"` functions. Two signatures:

- **Form actions** (used with `useActionState`): `(prev: State, fd: FormData) => Promise<State>` where `State = { error?: string; ok?: string } | undefined`
- **Direct actions** (delete/toggle): `(fd: FormData) => void` — throw on error

Form field parsing uses helpers from `src/lib/form.ts`: `str`, `reqStr`, `dec`, `int`, `bool`, `date`, `reqDate`, `enumOf`.

### Permissions

Role-based access via `src/lib/permissions.ts`. Four roles: `OWNER`, `MANAGER`, `VET`, `WORKER`. Check with `can.viewFinance(user.role)`, `can.manageAnimals(user.role)`, etc.

VET is the narrowest role and is meant to stay that way: the animal list and health records, nothing else. No money, no weights or milk yields, no feed, no breeding, no acquisition history. On an animal, `can.viewAnimalHistory` forces a vet to the Health tab whatever `?tab=` says, and the cost fields on `HealthRecordForm` are hidden from them — `saveHealthRecordAction` ignores those fields for a vet rather than trusting the form, so their save cannot wipe a cost the owner entered.

### Finance auto-linking

Health records, feed logs, batch costs and customer deliveries auto-create linked `Transaction` entries via unique FKs (`healthRecordId`, `feedLogId`, `batchCostId`, `saleId`). These are protected from manual edit/delete in finance actions. The `notAnimalSpecific` flag distinguishes farm-wide costs from unlinked animal expenses.

### Customers & deliveries

A `Customer` holds one `CustomerRate` per product they take (unit, unit price, and an optional usual `dailyQty`). Recording a delivery copies the product, unit and price onto the `Sale` row, so changing a rate later never rewrites what was already sold. Deliveries can be logged for one day or for every day in a range — that's how a month of milk is normally settled. Monthly rollups only render months that have deliveries; empty months are noise.

### Monthly finance outcomes

Finance filters apply consistently to the summary, charts, monthly expense groups and ledger. `monthlyExpenses` in `src/lib/monthlyExpenses.ts` groups expense entries by UTC ledger month, using existing category assignments. Only months containing expenses render; category links preserve the payer and selected date boundaries. `MonthlyExpenses` shows running costs, equipment/construction, animal purchases and other costs separately. Lifetime funding and animal costs are in a separate expandable section and remain unfiltered. Finance includes an inline expense-category manager (create categories and assign groups), plus a category-only editor on each manual expense in the ledger. Auto-linked expenses remain protected. Category assignments in Finance or Settings affect all historical months; the monthly view never rewrites transaction categories.

### Paid by / investment

Every `Transaction` can name whose money it was (`paidBy`, free text). `Payer` is the managed suggestion list in Settings — renaming one updates every entry saved under the old name, deleting one leaves entries alone, exactly like `Category`. Finance filters by payer (`NO_PAYER` from `src/lib/domain.ts` selects entries with none) and totals each person's investment across all expenses ever recorded.

### UI components

All in `src/components/ui.tsx` and individual files:
- **Layout**: `Card`, `Section`, `PageHeader`, `Empty`, `Badge`, `StatTile`, `Field`
- **Interactive**: `Tabs` (query param driven via `?tab=`), `Disclosure` (inline add forms), `ConfirmSubmit`, `ActionForm`
- **Domain**: `AnimalForm`, `HealthRecordForm`, `BatchForm`, `BatchCostForm`, `LedgerTable`, `CustomerForm`, `CustomerRateForm`, `SaleForm`, etc.
- **Charts**: `BarList` and `IncomeExpenseChart` in `src/components/charts.tsx` — one palette, defined there and validated for both themes

### Design tokens

Colors are CSS custom properties (`--bg`, `--surface`, `--ink`, `--muted`, `--brand`, `--good`, `--warn`, `--bad`) mapped through Tailwind. Dark mode supported. The `.card` class is defined in globals.

### Settings

Key-value store via `Setting` model. Retrieved with `getSettings()` from `src/lib/settings.ts`. Keys: `farmName`, `currency`, `weightUnit`, `dateFormat`.

### Expense categories

Built-in categories in `src/lib/domain.ts` (`EXPENSE_CATEGORIES`, `INCOME_CATEGORIES`). Each rolls up into a group (`Operational`, `Capital & Construction`, `Animal Purchases`, `Other`) via `CATEGORY_GROUPS`. Users can add custom categories in Settings.

`SALE_PRODUCTS` in the same file maps what buyers take (Milk, Ghee, Manure...) to its usual unit and the income category its sales land under, so a rate card pre-fills itself. It is a suggestion list, not a constraint.

## Database

### Migrations

Migrations are created manually as SQL files (no `prisma migrate dev` — use `prisma migrate deploy` to apply). Follow existing naming convention: `YYYYMMDDHHMMSS_description/migration.sql`.

Deploys go through `scripts/migrate-deploy.mjs` instead of calling `prisma migrate deploy` directly. A migration that errors stays in the history unfinished and Prisma then rejects every later deploy with P3009; since the build is the only thing that reaches the production database, a broken migration would otherwise lock the app out of deploying forever. The script marks such a migration rolled back and retries once. A migration that fails on its first attempt still fails the build.

Two things to get right in raw SQL that Prisma normally handles:

- `updatedAt` columns are `@updatedAt`, which Prisma fills from the client. There is no database default, so every insert must set it (`CURRENT_TIMESTAMP`).
- Enum columns need an explicit cast (`'EXPENSE'::"TxnType"`); Postgres will not coerce text to an enum on insert.

CI runs migrations against an empty database, so a data migration that reads existing rows (looking up the OWNER user, for instance) inserts nothing there and passes regardless. Green CI is not evidence that a data migration works.

### Key models

- `Animal` — core entity, linked to health, feed, milk, weight, breeding, photos, transactions, and optionally a `PurchaseBatch`
- `Transaction` — single ledger for all income/expenses; auto-linked from health/feed/batch cost/sale records via unique FKs, and optionally stamped with `paidBy`
- `PurchaseBatch` + `BatchCost` — groups animals bought on the same trip with shared costs
- `Customer` + `CustomerRate` + `Sale` — buyers, what they pay per unit, and each delivery (auto-linked to income)
- `Payer` — who funds the farm; suggestion list behind `Transaction.paidBy`
- `HealthRecord`, `FeedLog`, `MilkRecord`, `WeightRecord` — daily tracking
- `BreedingRecord` — dam/sire tracking with status workflow
- `Photo` — binary storage with thumbnail, linked to animal
- `User` — the four roles; `FeedType` — feed catalogue behind feed logs
- `Category` — user-added expense/income categories on top of the built-ins
- `Setting` — the key-value store behind `getSettings()`
- `AuditLog` — declared in the schema but nothing reads or writes it yet

## Environment

Required env vars (see `.env.example`):
- `DATABASE_URL` — PostgreSQL connection string
- `AUTH_SECRET` — JWT signing secret

## CI

GitHub Actions workflow (`.github/workflows/ci.yml`), on every branch, against a fresh `postgres:16-alpine` service container:

1. `npx tsc --noEmit`
2. `npm run build` — which applies every migration from empty, so a broken migration fails here
3. `npx prisma migrate diff --from-schema-datasource ... --to-schema-datamodel ... --exit-code` — fails if `schema.prisma` and the migrations have drifted apart

Any schema change therefore needs a matching migration in the same commit, or step 3 fails even though the build passed.

## Conventions

- Currency is configurable (default PKR) — use `money(amount, currency)` from `src/lib/format.ts`
- Dates formatted with `fmtDate()` from the same file
- Redirect calls in server actions must be outside try/catch blocks (Next.js throws on redirect)
- Animal deletion detaches transactions (preserves ledger) before cascading the delete
- Prisma `Decimal` values are class instances, so they cannot be handed to a client component. Convert at the page boundary (`Number(...)` for maths, `.toString()` where precision matters) — see `SaleForm`'s rates and `LedgerTable`'s amounts
- A 12-month strip of mostly empty months is clutter. Roll up only the months that have data (see the customer detail page)

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
