# MONEYBALL REBUILD — search audit and corrections (2026-11-18)

Scope: repository `damianwalus3-jpg/moneyball-global`, branch `moneyball-rebuild`, Worker `moneyball-global-rebuild` only. Production MAIN, Vercel and Lovable are out of scope.

## Live baseline
- The REBUILD Worker was reachable and returned the FootyNomad date endpoint for 2026-11-18.
- The endpoint returned 102 Europe-filtered fixtures from two UTC date pages, with zero missing-timestamp skips and zero parser errors in that snapshot.
- This 102 count is a provider snapshot, not a census of every European competition. Existing source diagnostics correctly warn that coverage is not complete.
- The client scan combines FootyNomad, open-matchday, OpenLigaDB, openfootball and ESPN.

## Defects found and corrections
1. FootyNomad's country map omitted Israel. Israeli domestic fixtures could therefore be silently filtered even though Israel is part of the app's configured European scope. Added the same country and alias handling to ESPN, including Kazakhstan, Republic of Ireland and Türkiye.
   - Added `israel: ISR` to the server-side country map.
   - Added a regression test for an Israeli Premier League fixture, including Brussels timezone conversion.
2. OpenLigaDB fixtures were assigned the generic `EU` country code even when their league name or shortcut identified a specific country.
   - Added country attribution from recognized European country names and league shortcuts, including German regional/cup feeds and Austrian Bundesliga shortcut variants.
   - Added regression tests for Germany, Austria, England, France, Israel, Faroe Islands, Kosovo and UEFA competitions.
   - Unknown/unresolvable OpenLigaDB country attribution remains `EU`; the code does not guess.
3. The Tracker's saved scan audit omitted FootyNomad counts, and its scan key did not include the full per-source coverage object.
   - Persisted FootyNomad page counts, raw European entries, unique fixtures, missing-time skips and errors.
   - Persisted the full source coverage JSON and included it in the scan key so changed source coverage is not hidden by an otherwise identical match count. FootyNomad pages are now included in the overall checked-source total.
4. Bumped the browser scan cache from v9 to v10 so cached results with generic country labels cannot mask the correction. Increased the Cloudflare OpenLigaDB match-feed cache from 15 minutes to 1 hour to avoid repeating the slow season-feed requests on every app refresh.

## Files changed
- `src/worker.ts`
- `src/worker.test.ts`
- `src/free-fixtures.ts`
- `src/free-fixtures.test.ts`
- `src/openfootball.ts`
- `src/openfootball.test.ts`
- `src/App.tsx`


## Live source coverage snapshot (2026-11-18)
- FootyNomad Worker: 102 unique fixtures, 2 UTC pages checked, 197 European page entries across the two pages, 0 missing-timestamp skips, 0 errors. These 102 fixtures were spread across 15 country codes plus UEFA.
- OpenLigaDB 2026 catalogue: 88 raw entries; the app's European football classifier selected 35 competitions after excluding known synthetic/test feeds.
- open-matchday: 75 total catalogues, 62 non-empty European catalogues across 28 country codes.
- OpenFootball Europe: 212 historical text files in the repository tree, but only 8 files for the current 2026-27 season at the time of the check, across 8 countries.
- ESPN scoreboard: 28 raw events for 2026-11-18, with 19 Europe candidates in the source snapshot. The prior UTC day is also queried to catch Brussels after-midnight fixtures.
- These are per-source catalogue/response counts, not the final merged unique-fixture total. No full UI scan was run because the separate browser-automation wallet was empty; live Worker endpoints and GitHub CI/deploy were verified instead.

## Additional independent source — timezone.football (2026-11-18)
- Added the public `/api/v1/watch.json` feed as a sixth, supplementary source. The provider documents a 14-day fixture window, refreshes the fixture data three times daily, and explicitly permits personal/commercial use with attribution and match/country links. The integration caches the JSON locally for 15 minutes (provider asks for at least a few minutes).
- Strict competition allowlist currently covers the feed's nine observed competition IDs: Premier League, La Liga, Bundesliga, Serie A, Ligue 1, Champions League, Europa League, DFB-Pokal and Coppa Italia. Unknown competition IDs are ignored rather than guessed.
- Each imported fixture preserves its official timezone.football match URL; the app exposes a per-match attribution link, including when the fixture is merged with another source.
- Live feed generated at 2026-11-18 02:43 UTC and contained 138 upcoming fixtures across 9 competitions, from 2026-11-20 through 2026-12-01. It contained **0 fixtures on 2026-11-18**, so it adds independent coverage/validation but no same-day match to today's scan.
- Rechecked all 62 non-empty European open-matchday catalogues using the correct `fixtures_2627.csv` season filename. None contained a row dated 2026-11-18. This is a source-level zero, not proof that no European domestic fixtures exist; other sources still returned today's events.
- The feed does not claim complete coverage of lower divisions and is not treated as a replacement for FootyNomad, OpenLigaDB, open-matchday, OpenFootball or ESPN.

## Additional code changes
- `src/free-fixtures.ts`: timezone.football parser, strict competition mapping, 15-minute feed cache, source URL preservation and coverage metrics.
- `src/free-fixtures.test.ts`: date/timezone, allowlist, attribution URL and malformed payload regression tests.
- `src/App.tsx`: per-match attribution links, feed diagnostics and corrected wording for the mixed source-unit counter.
- Fixture scan cache bumped to v11.

- Attribution is now mandatory for imported timezone.football rows: entries without a valid `https://timezone.football/` match URL are rejected. The regression test covers this rule and the Brussels UTC rollover (Nov 17 23:30 UTC → Nov 18 00:30 Brussels).
- The first CI run exposed the test's incorrect expectation (it overlooked that a prior-UTC-day kickoff correctly belongs to the Brussels target date). The parser behavior was correct; the test was corrected and the missing-link row is now explicitly excluded.

- Cloudflare deployment workflow was hardened after one transient Bun binary download returned HTTP 403. `.github/workflows/deploy-rebuild-cloudflare.yml` now uses Node.js 22, npm and `npx wrangler@4 deploy`, matching the successful Node-based rebuild checks. The previous Bun-based retry also completed successfully and deployed the same application code; the Node-based workflow change is queued for a fresh push validation.

## Validation gate
- The branch has automatic `rebuild-ci.yml`, `rebuild-check.yml` and `deploy-rebuild-cloudflare.yml` workflows on pushes to `moneyball-rebuild`.
- A change is not considered deployed until TypeScript checks, unit tests, production build and the isolated Cloudflare REBUILD deployment succeed, followed by a live Worker smoke test.
- The app must not be described as covering every European match until independent country/competition reconciliation proves that for the date being checked.

## Next work
- Inspect CI and REBUILD deploy results for the latest branch commit.
- Run the deployed Worker and a fresh app scan; compare the merged unique fixture set and source overlap by country/competition.
- Continue researching and integrating legally usable, public sources for countries and lower divisions not covered by the five existing sources. Do not use unofficial Flashscore/Sofascore scraping or data feeds whose terms prohibit automated collection.
