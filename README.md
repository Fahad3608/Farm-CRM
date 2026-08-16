# Farm CRM

A livestock record-keeping and finance app for a working farm — cows, buffalo,
goats, sheep and their young. Runs in any web browser and installs on a phone
like an app. Everything lives on **your** GitHub account, **your** database and
**your** hosting — no third-party farm service holds your data.

![Roles](https://img.shields.io/badge/roles-Owner%20%C2%B7%20Manager%20%C2%B7%20Vet%20%C2%B7%20Worker-2e7d50)

---

## What it does

**Animals** — a profile per animal with a photo, a gallery, tag/farm ID, name,
species, breed, sex, colour, markings, horn status, microchip, pen, date of
birth, **current age (calculated)**, date it joined the farm, how it joined
(born / purchased / gifted), seller, purchase price, parentage (mother & father,
with links to their profiles), and its offspring.

Calves and kids are recognised automatically: an animal younger than its
species' maturity age is shown as *Calf* / *Kid*, and older ones as
*Cow* / *Bull* / *Doe* / *Buck*.

**Health & veterinary** — a full dated history per animal of vaccinations,
injections, dewormings, treatments, check-ups, surgeries, lab tests, hoof care
and pregnancy checks. Each entry records the medicine or vaccine name, brand,
batch/lot number, dosage, route (IM/SC/IV/oral…), symptoms, diagnosis,
treatment, temperature, weight, milk/meat withdrawal date, the vet, the
**next-due date**, and the **medicine cost and vet fee**.

Anything with a next-due date turns into a reminder on the dashboard and in the
vet's queue.

**Feed** — define your feed types (wheat straw, silage, concentrate, minerals…)
with a price per unit, then log feeding either to a single animal or to a whole
pen. Group feeding is split evenly across the animals you tick, so **cost per
animal stays accurate**.

**Breeding** — service date, method (natural / AI / embryo transfer), sire,
pregnancy confirmation, and the **expected delivery date calculated from the
species' gestation period**. Deliveries record how many young were born.

**Growth & milk** — weight history per animal and daily milk records (AM/PM).

**Finances** — one ledger of income and expenses by category, with date-range
filtering, income-vs-expense charts, spending by category, and **cost per
animal**. Feed logs, health records and animal purchases/sales post to the
ledger automatically, so nothing is counted twice and nothing is missed.

---

## Two levels of access

The whole point of the role system: **your vet can add records without ever
seeing your money.**

| Role | Can see & do |
|---|---|
| **Owner** | Everything, including finances and managing user accounts |
| **Farm Manager** | Everything except managing user accounts |
| **Veterinarian** | Animals, health records and breeding records only. No finance pages, no purchase or sale prices, no feed costs, no ledger — the navigation doesn't even show them, and typing the URL redirects back. |
| **Farm Worker** | Daily logs (feed, milk, weights). No finances. |

A vet signs in and lands on their own **Veterinary queue**: what's due, what's
overdue, their recent entries, and one-tap forms for a new health or breeding
record. They can enter their own fee on a visit — it flows into your ledger,
but they never see the ledger.

---

## Web and phone

It's one responsive app, not two. On a phone you get a bottom tab bar, and the
photo uploader opens the camera directly. Add it to your home screen (Safari →
Share → *Add to Home Screen*; Chrome → menu → *Install app*) and it opens
full-screen like a native app.

Photos are resized in the browser before upload, so a camera photo uploads fast
even on a weak signal.

---

## Running it on your own machine

You need [Node.js 20+](https://nodejs.org) and a PostgreSQL database.

```bash
git clone https://github.com/Fahad3608/Farm-CRM.git
cd Farm-CRM
npm install

cp .env.example .env
# open .env and set AUTH_SECRET  (generate one with: openssl rand -base64 48)

docker compose up -d          # starts PostgreSQL locally
npm run db:push               # creates the tables
npm run db:seed               # creates your owner login (+ demo data)

npm run dev                   # open http://localhost:3000
```

The seed prints the login it created. By default:

```
owner@farm.local  /  ChangeMe123!
```

Change `SEED_OWNER_EMAIL` / `SEED_OWNER_PASSWORD` in `.env` before seeding, or
change the password later under **Settings → People with access**.

Set `SEED_DEMO_DATA="false"` in `.env` to start with an empty farm instead of
the 13 demo animals.

---

## Deploying your own copy

Everything below runs on accounts you own.

### Option A — Vercel + Neon (free, ~10 minutes, no server to manage)

1. **Database.** Create a free Postgres database at
   [neon.tech](https://neon.tech) (or [supabase.com](https://supabase.com)).
   Copy the connection string.
2. **Deploy.** Go to [vercel.com/new](https://vercel.com/new), sign in with
   GitHub, and import `Fahad3608/Farm-CRM`.
3. **Environment variables** — add these in Vercel before deploying:

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | your Neon connection string |
   | `AUTH_SECRET` | output of `openssl rand -base64 48` |

4. **Create the tables** — once, from your own machine:

   ```bash
   DATABASE_URL="<your neon url>" npx prisma db push
   DATABASE_URL="<your neon url>" AUTH_SECRET="anything" npm run db:seed
   ```

5. Open your Vercel URL and sign in.

### Option B — your own server (Docker)

```bash
docker compose up -d          # Postgres
npm install && npm run build
npm run db:push && npm run db:seed
npm start                     # serves on port 3000, put nginx/Caddy in front
```

Point a domain at it and enable HTTPS — the session cookie is marked `secure`
in production.

---

## Day-to-day

1. **Settings** → set your farm name and currency.
2. **Settings → People with access** → add your vet with the *Veterinarian*
   role and give them the password. Add farm hands as *Farm Worker*.
3. **Feed** → add your feed types with their prices.
4. **Animals → Add animal** → add each animal; open its profile and upload a
   face photo (this becomes the profile picture) plus any feature photos.
5. From then on: log feed, let the vet record visits, record breeding, and the
   dashboard and finance pages keep themselves up to date.

---

## Backups

Your whole farm — records and photos — is in the Postgres database.

```bash
pg_dump "$DATABASE_URL" > farm-backup-$(date +%F).sql
```

Neon and Supabase also take automatic backups. Keep a copy somewhere off the
server.

---

## Built with

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS · Prisma ·
PostgreSQL. Sessions are signed JWTs in an httpOnly cookie; passwords are
hashed with bcrypt. Photos are stored in the database, so there is no
third-party storage account to set up or pay for.

## Project layout

```
prisma/schema.prisma      the data model — animals, health, feed, breeding, finance
prisma/seed.ts            creates the owner account (+ optional demo farm)
src/lib/permissions.ts    single source of truth for what each role may do
src/lib/domain.ts         species, gestation periods, life stages, vaccine lists
src/app/(app)/            the signed-in app — one folder per section
src/app/actions/          server actions (all writes go through these)
src/components/           forms, charts and shared UI
```
