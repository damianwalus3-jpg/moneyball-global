# MONEYBALL fresh rebuild — execution log

## 2026-11-17 — Start
- User explicitly requested a complete restart from zero.
- Created isolated branch: `moneyball-rebuild`.
- Replaced the branch working tree with a clean baseline; production `main` was not modified.
- Added fresh product specification and initial React/Vite PWA foundation.
- Added Polish mobile-first six-module application shell.
- No production database was reset or deleted. The new build has no connected database yet.
- Next: implement domain schema, tracker, migrations, source adapters, model engine, coupon ledger, tests, authentication/security, deployment and end-to-end verification.
