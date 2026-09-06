# PetMatchAI

A pet marketplace for Nigeria that matches buyers to listings with a deterministic
scoring algorithm, and protects payments with an escrow flow: funds are held after
payment and only released once the buyer confirms handover (or an admin resolves a
dispute).

## Features

- **Matchmaking** — pets are scored against a buyer's preferences, past behaviour
  (saves, feedback), and live market prices. Every score comes with human-readable
  reasons (`lib/matching.ts`).
- **Escrow payments** — Paystack-backed offers/payments flow: pay into escrow →
  seller ships → buyer confirms → funds release. Falls back to a demo mode with
  simulated payments if no Paystack key is configured (`lib/escrow.ts`,
  `lib/paystack.ts`).
- **Verification** — sellers verify listings with a photo + code; users verify
  identity with an ID + selfie, reviewed by an admin.
- **Messaging & notifications** — threaded per-listing chat, with email (Brevo),
  SMS (Termii), and web push notifications, each independently optional.
- **Reviews & disputes** — multi-aspect seller reviews, and an admin-mediated
  dispute flow that can refund or release escrowed funds.
- **Analytics** — demand forecasting and price-fairness hints computed from live
  listing data (`lib/forecast.ts`), plus PDF/Excel reports for admins.

## Tech stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Supabase
(Postgres, Auth, Storage, Realtime) · Paystack · Jest

## Getting started

**Prerequisites:** Node.js 20+, a [Supabase](https://supabase.com) project.

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase credentials
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Database setup

Run the SQL files in `supabase/migrations/` in order (01 → 24) via the Supabase
SQL Editor. `01_schema.sql` is the core schema; the rest layer on features in
the order they were built.

### Environment variables

Only the three Supabase variables are required to boot the app — see
`.env.example` for the full list. Everything else (Paystack, email, SMS, push,
Groq) degrades gracefully: the related feature runs in a no-op/demo mode until
its keys are set.

To create your first admin account, register normally, then in the Supabase
SQL Editor:

```sql
update profiles set role = 'administrator' where email = 'you@example.com';
```

## Project structure

```
app/                 Next.js App Router
  api/                24 REST route handlers, one domain per folder
  (pages)/            buyer/seller/admin dashboards, listings, messages, etc.
components/          React components, grouped by domain
  auth/ layout/ listings/ payments/ compare/ modals/ ui/
lib/                  Business logic and integrations
  matching.ts          match scoring algorithm
  escrow.ts            escrow settlement (race-safe)
  forecast.ts          demand forecasting / price hints
  paystack.ts email.ts sms.ts push.ts groq.ts   external integrations
  supabase.ts          Supabase client setup (browser + server)
types/                Shared TypeScript types
supabase/migrations/   SQL schema, in application order
__tests__/            Jest unit tests
```

## Testing

```bash
npm test          # run once
npm run test:watch
npm run lint
```

## Deployment

Built for [Vercel](vercel.json): connect the repo, set the environment
variables from `.env.example`, and deploy. If using Paystack in live mode,
point its webhook at `/api/payments/webhook`.
