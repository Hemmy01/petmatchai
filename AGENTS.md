# Agent Instructions

This is a Next.js 16 / React 19 / TypeScript project using Supabase (PostgreSQL + Auth + Storage), Tailwind CSS v4, and the App Router.

## Key conventions
- All business logic lives in `lib/` — do not inline complex logic in route handlers or components.
- API routes live in `app/api/` and follow REST conventions (GET/POST/PATCH/DELETE per file).
- Components live in `components/` organised by domain subdirectory.
- Shared TypeScript types live in `types/`.
- SQL migrations live in `supabase/migrations/`.

## Commands
- `npm run dev` — start dev server (Turbopack)
- `npm run build` — production build
- `npm test` — run Jest unit tests
- `npm run lint` — ESLint

## References
- Next.js App Router: https://nextjs.org/docs/app
- Supabase JS: https://supabase.com/docs/reference/javascript
