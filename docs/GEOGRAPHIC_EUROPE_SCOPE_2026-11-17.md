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

A source-level correction now centralizes the geographic country boundary in `supabase/functions/_shared/geographic-europe.ts` and applies it to the five ingestion/prediction/result functions: `footynomad-sync`, `moneyball-free-feed`, `moneyball-results-sync`, `moneyball-public-sources`, and `moneyball-predict`. OpenMatchday's league index now uses the same country helper. A SQL migration wraps the existing top-two-tier predicate with the geographic check, without deleting historical rows.

Regression tests were added and wired into GitHub CI and the Cloudflare workflow. However, these workflows do not deploy Supabase functions or SQL migrations. The backend source changes are committed but **not live in Supabase**. Full end-to-end exclusion remains unverified until an authorized Supabase deployment path is available and live importer/database checks pass.


Cloudflare deployment run #816 completed SUCCESS for commit `63a5edaa6cf99a2894aa90e67ff1f04e8c153e0d`. This confirms the Cloudflare Worker deployment pipeline only; it does not activate the committed Supabase Edge Function or SQL migration changes.
