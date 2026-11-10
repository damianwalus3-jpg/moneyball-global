# Moneyball Global

Build a production-ready responsive Polish-language web app named MONEYBALL GLOBAL 2.0 for the owner's football prediction tracking workflow. This is a real usable app, not a mockup. Mobile-first PWA-style layout, dark professional sports analytics dashboard, clean navigation with tabs: Panel, Terminarz/Mecze, Prognozy 1X2, Double Chance, Kupony, Historia/Rozliczenia, Statystyki, Bankroll, Ustawienia. Use Europe/Brussels timezone and Polish labels. The owner already has an EXISTING external Supabase project and wants this app connected to it, not a new separate database: project ref gzgeklcukrclgwbsmbsp, URL https://gzgeklcukrclgwbsmbsp.supabase.co. Inspect and use the existing database tables if accessible: scan_runs, matches, predictions, coupons, coupon_legs, match_results, odds_snapshots, bankroll_transactions. RLS is enabled and owner policies exist. Do not drop, reset, or overwrite existing tables/migrations. If direct connection cannot be completed from the project environment, build the integration using Supabase JS client and environment variables VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (publishable key), and clearly expose a safe setup screen asking the owner to enter only the publishable/anon key; NEVER ask for or expose service_role/secret keys. Implement Supabase email/password authentication, session persistence, protected app routes, and owner-only data access through RLS. Do not store business data only in localStorage; Supabase is source of truth. Build CRUD flows for matches, predictions, coupons and legs, results/settlement, odds snapshots, bankroll transactions, scan runs. Keep 1X2 and Double Chance as separate prediction types. Status labels WYBRANY and ODRZUCONY; never omit a match from the stored scan just because a prediction is weak. Coupon builder must select exactly 3 distinct matches per coupon, avoid duplicate matches across generated coupons in a batch, and only recommend candidates with probability >75%; never claim guaranteed wins. Store confidence/probability separately from bookmaker odds. Include pending/won/lost/void settlement and calculate hit rates separately for 1X2 and DC, by league and market. Show current bankroll but don't invent its value; if no transactions exist, show 'brak danych'. Include import/export CSV/JSON and a data backup option. Seed no fake match records or results. Add helpful empty states and validation. Add app branding and make it easy to add to Android home screen. Before declaring complete, verify database schema and all queries against the existing tables; if schema mismatch, create a non-destructive migration only after explaining it in the project. Provide a working preview.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://moneyball-global.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/fe2e7e73-9cf3-4f7b-aef2-d65b92fb4d1b).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
