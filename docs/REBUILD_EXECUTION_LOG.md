# MONEYBALL fresh rebuild — execution log

## 2026-11-17 — Start
- User explicitly requested a complete restart from zero.
- Created isolated branch: `moneyball-rebuild`.
- Replaced the branch working tree with a clean baseline; production `main` was not modified.
- Added fresh product specification and initial React/Vite PWA foundation.
- Added Polish mobile-first six-module application shell.
- No production database was reset or deleted. The new build has no connected database yet.
- No paid API, database, hosting tier, or subscription is required by this rebuild.

## Completed and verified foundations
- GitHub Actions run `44098471244` completed successfully on the clean rebuild branch.
- Core domain tests cover 1X2 probability normalization, derived Double Chance, duplicate fixture suppression, three-leg coupon constraints and return calculation.
- Removed unused Supabase/Postgres migrations; no new database or paid resource was created.
- Tracker runs locally in browser storage with versioned JSON export/import; imports merge missing IDs and preserve existing records.
- Daily Europe/Brussels fixture retrieval uses the public open-matchday CSV dataset, restricted to European domestic league folders. Its non-commercial terms and coverage limitations must be respected.
- Separate Cloudflare Worker deployment is isolated from the existing production Worker and D1 database.

## Deployment checkpoint — 2026-11-17
- Application URL: https://moneyball-global-rebuild.damianwalus3.workers.dev
- Worker: `moneyball-global-rebuild`.
- First successful deployment run: `44103378010`; latest documentation-only CI run `44103526507` and deployment run `44103526551` both completed successfully.
- Automated browser-level visual verification remains outstanding; deployment success is not represented as a full end-to-end acceptance test.
- No paid resources were provisioned.

## Stage 02 — prediction engine foundation
- Implemented a transparent independent-Poisson 1X2 engine that accepts explicit expected-goals inputs. It does not fabricate xG: predictions cannot be produced until real expected-goals inputs are supplied by a verified source or entered by an operator.
- Double Chance remains a separately derived output from the 1X2 distribution.
- Added validation of expected-goals range, goal-matrix truncation and normalized probabilities.
- Added settled-prediction evaluation metrics: multiclass Brier score, log loss and accuracy. Empty samples return no metric rather than a misleading zero.
- Added unit tests for model directionality, probability normalization, input rejection and evaluation.
- Status at commit time: implementation committed; CI and Cloudflare deployment must pass before this stage is marked deployed.

### Stage 02 — passed and deployed
- Commit: `f352cfa298f0ddbce9221018981637160e04e176`.
- CI run `44106668871`: success; install, TypeScript typecheck, Vitest suite and production build all passed.
- Cloudflare deploy run `44106669013`: success; same validation steps and static asset deployment passed.
- Stage 02 is marked COMPLETE/DEPLOYED. The prediction engine is a tested calculation module, not yet fed by verified expected-goals data.

## Stage 03 — free historical results and recent form
- Added retrieval of public season results CSV by European domestic league.
- Team recent form uses completed score rows strictly earlier than the fixture date; the current fixture and future rows are excluded.
- Computes last five overall results plus separate home/away subsets, score, opponent, W/D/L and points.
- UI exposes an on-demand "Forma 5" action on each listed fixture; result data is cached locally for six hours.
- Source coverage and non-commercial limitations remain visible; missing result files are reported instead of synthesizing form.
- Status: implementation committed; CI and Cloudflare deployment pending.

### Stage 03 — passed and deployed
- Final Stage 03 implementation commit: `fe2231b961730e38cc90242ad055aff42333f56f`.
- CI run `44107577459`: success; TypeScript, tests and production build passed.
- Cloudflare deploy run `44107577440`: success; all deploy steps completed.
- Stage 03 is COMPLETE/DEPLOYED. Recent-form history remains sourced from the corresponding open-matchday league CSV.

## 2026-11-17 — European fixture coverage expansion (Stage 04 implementation)
- User clarified that the scan must include **all European football matches without competition exclusions**: senior/youth, men's/women's, domestic leagues at every tier, regional/amateur leagues, domestic cups and UEFA competitions.
- Removed the previous filters that excluded cup folders, U21 folders and UEFA folders from open-matchday. All recognised European country/UEFA folders with fixtures are now scanned.
- Added OpenLigaDB as a second fixture source. It discovers season leagues dynamically and retrieves match lists for recognised European competitions, including its German lower-tier/regional catalogue where available.
- Added Europe/Brussels date conversion for OpenLigaDB UTC kick-off timestamps.
- Added normalized fixture-key deduplication across providers; source provenance is retained when two feeds identify the same match.
- Added tests for European source classification, non-football rejection and cross-provider fixture deduplication.
- OpenLigaDB requests now pass through the separate rebuild Cloudflare Worker. Successful upstream responses are cached at the edge for 8 hours to reduce duplicate requests and respect the provider's fair-use expectations. Local Vite development uses a matching proxy.
- Updated match UI: recent-form lookup is shown only where a compatible historical league folder exists; no fabricated form is displayed for OpenLigaDB-only matches.
- Updated product scope to include every competition category, not just senior domestic leagues.
- Sources reviewed: open-matchday (75 competitions, daily public CSV; non-commercial terms and uneven coverage), OpenLigaDB (keyless API, ODbL 1.0, 60 requests/minute maximum and fair-use caching guidance), football-data.org (12 competitions on free tier), Sportmonks (2 leagues on free tier; broader coverage is paid), and openfootball Europe (public-domain datasets for selected European leagues).
- Important limitation: the combined public feeds materially broaden coverage but do **not** prove every European amateur/youth/women's match is present. A complete guarantee is impossible without a comprehensive provider or direct federation feeds. The app must show provider failures and actual coverage counts instead of claiming 100% coverage.
- Commits: source expansion `d60fe542ccb4557605b923dc9cfd84fee16a4a6c`; UI `e94f0aa06b4867aca12dca554218dcfce91941a6`; source tests `15e5cd037945baa5dfd2f18367c1fdb54e5701cd`; shared Worker cache and proxy final fix `78040fedfd9133b72fbe7e666db036036e88ac2a`.
- Final code validation: CI run `44108958296` SUCCESS (typecheck, tests, build).
- Cloudflare rebuild deployment: run `44108958539` SUCCESS.
- Stage 04 implementation is DEPLOYED. Live endpoint/browser smoke test and a country-by-country coverage audit remain outstanding; do not mark coverage acceptance as complete until these checks pass.
- Existing production `main` and Worker remain untouched. No paid API, hosting, database or subscription was added.
