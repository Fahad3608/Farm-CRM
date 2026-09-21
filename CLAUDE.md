# Farm CRM

Livestock farm management system. Tracks animals, health records, breeding, feed, milk production, finances, and purchase batches.

## Stack

- **Next.js 16** (App Router) with **React 19**, TypeScript strict
- **Prisma v6** with PostgreSQL
- **Tailwind CSS v3** with custom design tokens (see `tailwind.config.ts`)
- **Auth**: JWT sessions via `jose`, passwords via `bcryptjs` — no external auth provider
- No external UI library — all components are hand-rolled in `src/components/`

## Commands

```bash
npm run dev          # Start dev server
npm run build        # prisma generate + migrate deploy + next build
npm run lint         # eslint . (next lint was removed in Next 16)
npm run db:seed      # Seed demo data (set SEED_DEMO_DATA=true)
npm run db:migrate   # prisma migrate deploy (see Migrations below)
npm run db:studio    # Prisma Studio GUI
```

## Project structure

```
src/
  app/
    (app)/           # Authenticated routes (layout has sidebar + nav)
      animals/       # Animal list, detail (/[id]), edit, new
      batches/       # Purchase batch list and detail
      breeding/      # Breeding records
      dashboard/     # Owner/manager dashboard
      feed/          # Feed logs
      finance/       # Transaction ledger
      health/        # Health records
      settings/      # Farm settings, users, backfill actions
      vet/           # Vet-specific queue
    actions/         # Server actions (one file per domain)
    api/photos/[id]/ # Photo serving endpoint
  components/        # Shared UI components
  lib/               # Utilities (auth, db, permissions, format, form helpers)
prisma/
  schema.prisma      # Single schema file
  migrations/        # SQL migrations (created manually, not via prisma migrate dev)
  seed.ts            # Demo data seeder
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

Health records, feed logs, and batch costs auto-create linked `Transaction` entries via unique FKs (`healthRecordId`, `feedLogId`, `batchCostId`). These are protected from manual edit/delete in finance actions. The `notAnimalSpecific` flag distinguishes farm-wide costs from unlinked animal expenses.

### UI components

All in `src/components/ui.tsx` and individual files:
- **Layout**: `Card`, `Section`, `PageHeader`, `Empty`, `Badge`, `StatTile`, `Field`
- **Interactive**: `Tabs` (query param driven via `?tab=`), `Disclosure` (inline add forms), `ConfirmSubmit`, `ActionForm`
- **Domain**: `AnimalForm`, `HealthRecordForm`, `BatchForm`, `BatchCostForm`, `LedgerTable`, etc.

### Design tokens

Colors are CSS custom properties (`--bg`, `--surface`, `--ink`, `--muted`, `--brand`, `--good`, `--warn`, `--bad`) mapped through Tailwind. Dark mode supported. The `.card` class is defined in globals.

### Settings

Key-value store via `Setting` model. Retrieved with `getSettings()` from `src/lib/settings.ts`. Keys: `farmName`, `currency`, `weightUnit`, `dateFormat`.

### Expense categories

Built-in categories in `src/lib/domain.ts` (`EXPENSE_CATEGORIES`, `INCOME_CATEGORIES`). Each rolls up into a group (`Operational`, `Capital & Construction`, `Animal Purchases`, `Other`) via `CATEGORY_GROUPS`. Users can add custom categories in Settings.

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
- `Transaction` — single ledger for all income/expenses; auto-linked from health/feed/batch cost records via unique FKs
- `PurchaseBatch` + `BatchCost` — groups animals bought on the same trip with shared costs
- `HealthRecord`, `FeedLog`, `MilkRecord`, `WeightRecord` — daily tracking
- `BreedingRecord` — dam/sire tracking with status workflow
- `Photo` — binary storage with thumbnail, linked to animal

## Environment

Required env vars (see `.env.example`):
- `DATABASE_URL` — PostgreSQL connection string
- `AUTH_SECRET` — JWT signing secret

## CI

GitHub Actions workflow (`.github/workflows/ci.yml`) runs typecheck, lint and `npm run build` against a fresh PostgreSQL service container. This validates TypeScript, migrations, and the full build.

## Conventions

- Currency is configurable (default PKR) — use `money(amount, currency)` from `src/lib/format.ts`
- Dates formatted with `fmtDate()` from the same file
- Redirect calls in server actions must be outside try/catch blocks (Next.js throws on redirect)
- Animal deletion detaches transactions (preserves ledger) before cascading the delete

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
