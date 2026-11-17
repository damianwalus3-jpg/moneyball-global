# Production scope audit — 2026-11-17

## Environment and deployment
- Production application: Cloudflare Worker `https://moneyball-global.damianwalus3.workers.dev/`.
- Repository: `damianwalus3-jpg/moneyball-global`, branch `main`.
- Latest audited commit before this note: `8478ef6d9543e0fa3842e48a94f5c8e384b30c46` (`fix(scope): separate RPC definitions with SQL terminators`).
- GitHub Actions CI run `44042851781`: SUCCESS (Deno check, tests, TypeScript, build).
- Cloudflare deploy run `44042851688`: SUCCESS (Cloudflare build and deploy).
- Live Worker fetch succeeded; page title `MONEYBALL GLOBAL 2.0`, locale Polish, visible copy includes 1X2, Double Chance, Goli, coupon settlement and 4 EUR stake. Fetch latency reported 280 ms.
- No Vercel or TEST environment was used.

## Scope rules retained
- European domestic senior men's leagues, levels 1 and 2 only.
- Exclude cups, international competitions, women, youth, reserve/B teams and lower tiers.
- Current-day scope uses `Europe/Brussels`.
- Keep historical match, prediction, coupon and bankroll records; do not delete old rows as a shortcut.
- Issue #77 remains open until the source catalogue, DB/RPC and production UI have been compared with evidence.

## Source and database snapshot for 2026-11-17
- Public FootyNomad day page: `https://footynomad.com/fixtures/2026-11-17`.
- FootyNomad page metadata reports 173 fixtures across 20 countries.
- Public page sections and fixture links show international competitions, youth, cups and lower divisions as well as domestic leagues. Examples excluded by the project scope include UEFA Nations League, UEFA U17/U19/U21 qualifiers, Scottish Lowland League, English National League North/South, English Non-League Premier, French National 2, Czech 3. liga, Portuguese U23 and Ukraine Persha Liga fixture UCSA–Polissya II (reserve side).
- Production database snapshot for today's Brussels date: 99 FootyNomad match rows; all 99 had gender=men; 2 passed `public.moneyball_is_eligible_european_match(country, coalesce(competition,league), gender, home_team, away_team)`; 97 were excluded by the current scope function.
- The two rows currently passing the production SQL scope are:
  - Warrenpoint Town — Glenavon FC (Northern Ireland, Championship)
  - Rathfriland — Moyola Park (Northern Ireland, Championship)
- The source page and DB counts are not directly equivalent: the DB contains previously imported/out-of-scope records for the same date. Preserve them; ensure all production list/dashboard/scan RPCs filter them out. This snapshot alone does not prove complete league catalogue coverage.

## Current code / migration findings
- Latest main includes the scope migration chain through `20261117075848_align_dashboard_and_scan_to_full_fixture_scope`.
- Production migration history confirms migrations through version `20261117075848` are applied.
- Latest SQL changes align dashboard and scan RPCs with the same full fixture eligibility helper and terminate each SQL function definition correctly.
- The latest CI and Cloudflare deploy are successful.
- The Worker itself is reachable, but this fetch did not authenticate into the private panel; therefore the logged-in UI list, scan button, and end-to-end flow are not yet verified by this audit.

## Remaining work — do not mark #77 complete
1. Compare the complete FootyNomad browse catalogue by country against a maintained authoritative list of each country's domestic senior tiers 1 and 2; map exact provider competition IDs/labels and identify source gaps separately from app filter gaps.
2. For each league with fixtures on a selected day, compare source fixture IDs, DB rows, eligibility RPC output, scan results and the authenticated MAIN UI.
3. Confirm dashboard and scan RPC outputs contain only eligible fixtures and no duplicates, without deleting historical rows.
4. Add regression tests for each newly found missing or misclassified competition.
5. Verify the authenticated production panel and current-day scan before closing issue #77.

## Important operational note
- The public FootyNomad day page is a source snapshot, not proof that every European league has a scheduled fixture on that date.
- No odds availability or prediction quality claim is made here.
- No Supabase Edge Function deployment, schema change, secret change, Vercel action or TEST deployment was performed as part of this audit.
