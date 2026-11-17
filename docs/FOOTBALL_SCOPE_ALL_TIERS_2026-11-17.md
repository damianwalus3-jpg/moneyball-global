# MONEYBALL GLOBAL — all-tier European domestic league scope

Effective scope requested 2026-11-17: all divisions of senior men's domestic leagues in geographic Europe (UN M49). This replaces the earlier first/second-tier-only restriction.

## Included
- Every senior men's domestic league division/level, from top flight through regional and non-league tiers, when the source identifies it as a domestic league and supplies a geographic-European country.

## Excluded
- Domestic/international cups, trophies, super cups and knockout/playoff competitions.
- National-team and international competitions, including UEFA Nations League and continental club competitions.
- Youth/U teams, development leagues, women's competitions and reserve/B/II/III teams.
- Non-European countries, regardless of UEFA affiliation.

## Regression examples
| Fixture/competition | Expected |
|---|---|
| France — National 2 | Include |
| Czech Republic — 3. liga | Include |
| England — National League North/South | Include |
| England — Non-League Premier | Include |
| Scotland — Lowland League | Include |
| Northern Ireland — Championship | Include |
| Ukraine — Persha Liga, UCSA vs Polissya II | Exclude (reserve team) |
| England — EFL Trophy | Exclude (cup) |
| UEFA Nations League | Exclude (international) |
| U17/U19/U21/U23 fixtures | Exclude (youth) |
| Israel / Georgia / Türkiye | Exclude (M49 geography) |

## Implementation
- Shared server helper: supabase/functions/_shared/domestic-league-scope.ts.
- Server callers: footynomad-sync, moneyball-free-feed, moneyball-predict and OpenMatchday discovery.
- Frontend eligibility: isEuropeanDomesticLeague / isEligibleEuropeanMatch in src/lib/domain.ts.
- Database boundary: migration 20261117150000_expand_european_leagues_to_all_senior_tiers.sql; historical rows are preserved.
- CI includes Deno regressions for all-tier inclusion and cup/international/youth/women/non-European exclusions.

Do not close the scope issue until the migration and Edge Functions are active and a real authenticated manual scan verifies both lower-tier inclusions and all exclusions.
