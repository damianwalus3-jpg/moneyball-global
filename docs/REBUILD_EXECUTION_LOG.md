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

## Zero-cost decision
- User confirmed that no paid services may be used.
- Removed unused Supabase/Postgres migrations from the clean branch. No new database or paid resource was created.
- Tracker now runs locally in browser storage with versioned JSON export/import; backups merge only missing IDs.
- Added daily Europe/Brussels fixture retrieval from open-matchday's free public CSV dataset, restricted to European domestic league folders. Source is non-commercial and coverage limitations must be shown.
- Added a separate Cloudflare Worker static-assets deployment workflow. It uses the existing repository Cloudflare secrets and a distinct Worker name; it does not bind the production D1 database or alter the existing production Worker.

## First free deployment — 2026-11-17
- Clean rebuild deployed successfully to the separate Cloudflare Worker: https://moneyball-global-rebuild.damianwalus3.workers.dev
- Worker: `moneyball-global-rebuild`; version ID: `9a0162d4-f82e-4ff4-86bd-ee049f707291`.
- GitHub Actions deployment run: `44103378010`, conclusion: success.
- Verified pipeline steps: dependency install, TypeScript typecheck, 9 unit tests (2 files), Vite production build, static asset upload and Cloudflare Worker deployment.
- The deployed build is isolated from the existing production `moneyball-global` Worker and its D1 database.
- Public URL was issued by Cloudflare deployment output. Automated browser-level visual verification is still outstanding.
- No paid resources were provisioned.
