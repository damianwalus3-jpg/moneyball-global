# MONEYBALL GLOBAL — geographic Europe boundary

**Policy effective in frontend source:** use the United Nations Statistics Division M49 regional classification for the meaning of “Europe”. UEFA membership is not a geographic definition and must not be used as a substitute.

## Included / excluded examples

| Country | M49 region | MONEYBALL geographic-Europe gate |
|---|---|---|
| Albania | Southern Europe | Include |
| Israel | Western Asia | Exclude |
| Armenia | Western Asia | Exclude |
| Azerbaijan | Western Asia | Exclude |
| Cyprus | Western Asia | Exclude |
| Georgia | Western Asia | Exclude |
| Kazakhstan | Central Asia | Exclude |
| Türkiye | Western Asia | Exclude |

This is a whole-country classification. Türkiye is transcontinental geographically, but M49 assigns it to Western Asia; its national league is therefore excluded under this strict country-based rule. Albania is unambiguously in Southern Europe and remains included.

## Implementation

- Canonical frontend gate: `src/lib/domain.ts:isEuropeanTopTwoLeague` and `isOpenMatchdayTopTwoMatch`.
- The same helper gates the authenticated Matches view, Statistics view and coupon candidate generation.
- Regression coverage in `src/lib/domain.test.ts` covers names and ISO-3 codes where relevant.
- Existing records are retained; this is an eligibility/display correction, not destructive cleanup.
- Important deployment boundary: this GitHub/Cloudflare change does not itself deploy Supabase SQL functions or Supabase Edge Functions. Do not state that source ingestion or DB-level scope is fixed until that runtime is separately deployed and verified.

## Authoritative source

UN Statistics Division, Standard Country or Area Codes for Statistical Use (M49): https://unstats.un.org/unsd/methodology/m49/overview


## Backend remediation status — 2026-11-17

A source-level correction now centralizes the geographic country boundary in `supabase/functions/_shared/geographic-europe.ts` and applies it to six backend functions: `footynomad-sync`, `moneyball-free-feed`, `moneyball-results-sync`, `moneyball-public-sources`, `moneyball-predict`, and `moneyball-movi-odds-sync`. OpenMatchday's league index now uses the same country helper. A SQL migration wraps the existing top-two-tier predicate with the geographic check, without deleting historical rows.

Regression tests were added and wired into GitHub CI and the Cloudflare workflow. However, these workflows do not deploy Supabase functions or SQL migrations. The backend source changes are committed but **not live in Supabase**. Full end-to-end exclusion remains unverified until an authorized Supabase deployment path is available and live importer/database checks pass.


Cloudflare deployment run #816 completed SUCCESS for commit `63a5edaa6cf99a2894aa90e67ff1f04e8c153e0d`. This confirms the Cloudflare Worker deployment pipeline only; it does not activate the committed Supabase Edge Function or SQL migration changes.


CI #1231/#1232 and Cloudflare deploy #818 completed SUCCESS. The deployed Cloudflare Worker is confirmed; Supabase Edge Functions and the SQL migration remain un-deployed, so live database/importer isolation is still not verified.


## Supabase production activation — footynomad-sync v99 — 2026-11-17

- User explicitly authorized a one-time production deployment of the corrected `footynomad-sync` to Supabase project `gzgeklcukrclgwbsmbsp`.
- Before deployment, verified the live function was version 97, ACTIVE, with `verify_jwt=true`. Its active source still had the malformed Bearer regex and only the old `footynomad-section` dependency. Read-only logs showed two POST 400 responses on 2026-11-17 10:31:33Z and 10:31:37Z, both against deployment v97; public-source requests returned 200. Prior log query did not retain the inner function exception body, so the bad token normalization is the strongest source-level cause, not a directly observed PostgREST error body.
- A first deployment attempt failed bundle resolution due to relative helper path layout; no successful runtime activation was assumed from that attempt. A second deploy attempt produced v98 with a duplicated entrypoint path, which was immediately superseded. The final successful deployment is v99, using a self-contained one-file bundle generated from the committed MAIN source plus its exact shared helper contents. This avoids runtime relative-import resolution failures.
- Verified live metadata after deployment: function `footynomad-sync` status ACTIVE, version 99, `verify_jwt=true`, entrypoint `source/index.ts`, single deployed file `index.ts`. The bundle includes the corrected Bearer extraction and M49 country filter. No auth setting was weakened and no database rows were deleted/rewritten.
- Cloudflare MAIN remains deployed at commit `5ff5fc72050dc3265d5203c6226d86061ffa960a`; CI #1233 and Cloudflare deploy #819 succeeded. Documentation was updated on MAIN after the live activation.
- **Still required for end-to-end proof:** a real authenticated POST scan from the app after v99 and inspection of its function logs plus `scan_runs`/matches results. The most recent database scan rows inspected pre-deployment were not a post-v99 test. Do not claim the user's button is fully verified until a post-deploy scan returns 2xx and stores the expected eligible European fixtures.


## League-level scope update — 2026-11-17
The geographic country boundary above remains unchanged. The latest user instruction expands domestic league coverage from tiers 1-2 to all senior men's domestic league levels. Cups, national-team/international competitions, youth, women's and reserve sides remain excluded. See FOOTBALL_SCOPE_ALL_TIERS_2026-11-17.md and migration 20261117150000_expand_european_leagues_to_all_senior_tiers.sql.
