# Project Instructions

- Keep the `main` branch buildable; never force-push or rewrite published history.
- Use the existing Supabase project only. Never reset, drop, or overwrite production tables.
- Browser code may use only the public/publishable Supabase key. Never commit service-role keys or other secrets.
- Preserve owner isolation and Row Level Security on all user data.
- Keep 1X2 and Double Chance as separate models and markets.
- Store every discovered fixture, including matches with missing data; mark missing data explicitly instead of inventing values.
- Keep the active prediction model version separate from historical model versions.
- Prefer free public sources that require no API key. Do not introduce paid APIs or mandatory keys without explicit approval.
- Keep schema compatibility mappings in `src/lib/db.ts` synchronized when adding or changing write flows.
- Run tests, TypeScript checks, and a production build before declaring the app ready.
