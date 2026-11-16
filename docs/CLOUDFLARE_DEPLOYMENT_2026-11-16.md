# Cloudflare deployment — manual full-day prediction scan

Date: 2026-11-16 (Europe/Brussels)

- Production target: existing Cloudflare Worker `moneyball-global`.
- Worker URL: https://moneyball-global.damianwalus3.workers.dev/
- Feature source commit: `e1d15c59aba1496239a8b13f4d5e8df25cbca3ee` (manual full-day scan button).
- Brussels date-helper correction: `eab093eaa538c2a80ae0657f53ca4ecc71357a28`.
- Latest push commit: `3a3875bd370c03ea1ec8de4bf2508feaacacece1`.
- Cloudflare deployment workflow: `Deploy Moneyball Global to Cloudflare Workers`, run #312, GitHub Actions run ID `43884092715`, status Success, duration 1m 2s.
- Live Worker homepage was fetched after deployment and returned the MONEYBALL GLOBAL 2.0 app shell (HTTP fetch successful; 330 ms observed fetch latency).
- The authenticated panel route requires login. Its new button is confirmed in the deployed source, but a signed-in click-through test has not been performed in this verification.
- Button processes today's Europe/Brussels fixtures already synchronized into Supabase in sequential batches of 10; calls the existing JWT-protected `moneyball-predict`; reports counts and refreshes dashboard data. Fixture import remains separate on its existing 15-minute schedule. The scan does not place real bets or auto-create coupons.
- Vercel was not used for this deployment and is not the production target.
- Remaining test: sign into the app and click `Skanuj dzisiejsze mecze`; verify returned match/prediction counts and resulting dashboard records. Do not describe authenticated end-to-end click testing as complete until performed.
