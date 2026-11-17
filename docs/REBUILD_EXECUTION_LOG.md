# MONEYBALL fresh rebuild — execution log

## 2026-11-17 — Start
- User explicitly requested a complete restart from zero.
- Created isolated branch: `moneyball-rebuild`.
- Replaced the branch working tree with a clean baseline; production `main` was not modified.
- Added fresh product specification and initial React/Vite PWA foundation.
- Added Polish mobile-first six-module application shell.
- No production database was reset or deleted. The new build has no connected database yet.
- Next: implement domain schema, tracker, migrations, source adapters, model engine, coupon ledger, tests, authentication/security, deployment and end-to-end verification.

## Validation update
- GitHub Actions run `44098471244` completed successfully on the clean rebuild branch.
- Confirmed steps: dependency install, TypeScript typecheck, Vitest suite, production Vite build.
- Core domain tests cover 1X2 probability normalization, derived Double Chance, duplicate fixture suppression, three-leg coupon constraints and return calculation.
- Initial SQL migrations are authored but deliberately not applied: a separate clean Supabase project must first be provisioned and its cost/organization confirmed.
