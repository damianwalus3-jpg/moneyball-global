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
