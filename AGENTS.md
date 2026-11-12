# Project instructions

- Work from GitHub branches and pull requests; do not depend on Lovable services or editor integrations.
- Preserve the existing Supabase project, schema, RLS policies, and all user data. Never reset or drop tables.
- The browser may use only the Supabase publishable/anon key. Never add service_role keys or provider secrets to client code.
- Football data providers must be usable without paid API keys. Clearly label unofficial feeds and coverage gaps.
- Do not fabricate fixtures, results, xG, lineups, odds, or model confidence. Mark weak/insufficient predictions as ODRZUCONY.
- Keep 1X2 and Double Chance as separate prediction types.
- Keep generated coupons at exactly three different matches; do not reuse a match within one batch; require probability strictly above 75%.
- Use Europe/Brussels for user-facing dates and preserve UTC timestamps in storage.
- Before merging changes, run lint, unit tests, TypeScript checks, and a production build.
