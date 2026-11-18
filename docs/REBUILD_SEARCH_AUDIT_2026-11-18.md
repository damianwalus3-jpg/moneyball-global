# MONEYBALL REBUILD — search audit and corrections (2026-11-18)

Scope: repository `damianwalus3-jpg/moneyball-global`, branch `moneyball-rebuild`, Worker `moneyball-global-rebuild` only. Production MAIN, Vercel and Lovable are out of scope.

## Live baseline
- The REBUILD Worker was reachable and returned the FootyNomad date endpoint for 2026-11-18.
- The endpoint returned 102 Europe-filtered fixtures from two UTC date pages, with zero missing-timestamp skips and zero parser errors in that snapshot.
- This 102 count is a provider snapshot, not a census of every European competition. Existing source diagnostics correctly warn that coverage is not complete.
- The client scan combines FootyNomad, open-matchday, OpenLigaDB, openfootball and ESPN.

## Defects found and corrections
1. FootyNomad's country map omitted Israel. Israeli domestic fixtures could therefore be silently filtered even though Israel is part of the app's configured European scope.
   - Added `israel: ISR` to the server-side country map.
   - Added a regression test for an Israeli Premier League fixture, including Brussels timezone conversion.
2. OpenLigaDB fixtures were assigned the generic `EU` country code even when their league name or shortcut identified a specific country.
   - Added country attribution from recognized European country names and league shortcuts.
   - Added regression tests for Germany, Austria, England, France, Israel, Faroe Islands, Kosovo and UEFA competitions.
   - Unknown/unresolvable OpenLigaDB country attribution remains `EU`; the code does not guess.
3. The Tracker's saved scan audit omitted FootyNomad counts, and its scan key did not include the full per-source coverage object.
   - Persisted FootyNomad page counts, raw European entries, unique fixtures, missing-time skips and errors.
   - Persisted the full source coverage JSON and included it in the scan key so changed source coverage is not hidden by an otherwise identical match count.
4. Bumped the browser scan cache from v9 to v10 so cached results with generic country labels cannot mask the correction.

## Files changed
- `src/worker.ts`
- `src/worker.test.ts`
- `src/free-fixtures.ts`
- `src/free-fixtures.test.ts`
- `src/App.tsx`

## Validation gate
- The branch has automatic `rebuild-ci.yml`, `rebuild-check.yml` and `deploy-rebuild-cloudflare.yml` workflows on pushes to `moneyball-rebuild`.
- A change is not considered deployed until TypeScript checks, unit tests, production build and the isolated Cloudflare REBUILD deployment succeed, followed by a live Worker smoke test.
- The app must not be described as covering every European match until independent country/competition reconciliation proves that for the date being checked.

## Next work
- Inspect CI and REBUILD deploy results for the latest branch commit.
- Run the deployed Worker and a fresh app scan; compare the merged unique fixture set and source overlap by country/competition.
- Continue researching and integrating legally usable, public sources for countries and lower divisions not covered by the five existing sources. Do not use unofficial Flashscore/Sofascore scraping or data feeds whose terms prohibit automated collection.
