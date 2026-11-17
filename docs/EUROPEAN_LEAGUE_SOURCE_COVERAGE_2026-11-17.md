# European league source coverage audit — 2026-11-17

## Scope and method

The product scope is national senior men's domestic leagues at tiers 1 and 2 only. Cups, international competitions, women's leagues, youth, reserve/B teams and tiers 3+ are excluded. The reference universe is UEFA's 55 national associations: https://www.uefa.com/nationalassociations/

This audit measures what the currently reachable public source catalogues actually list. A country appearing in a source does not prove that every fixture is available, and a country with a tier-1 source does not imply tier-2 coverage.

## Catalogue snapshot

| Source | Observed catalogue | Coverage evidence | Limitations |
|---|---|---|---|
| OpenMatchday 2026/27 | 38 European domestic tier-1/tier-2 competition rows across 29 UEFA associations; 28 tier-1 rows and 10 tier-2 rows | Public LEAGUE_INDEX; 38 eligible folders checked by production aggregator | Free/no key, daily refresh; informational non-commercial use with attribution; not live; no xG, lineups, injuries or odds |
| FootyNomad /browse | 13 European country sections, 26 accepted tier-1/tier-2 labels | 13 countries all overlap OpenMatchday's 29-country set | /browse is inconsistent with day fixture page: Northern Ireland fixtures appear on 17 Nov but Northern Ireland is not listed in /browse |
| FootyNomad /fixtures/2026-11-17 | 173 fixtures across 20 countries; includes two Northern Ireland Championship fixtures | Two NI fixtures also pass production shared SQL scope | Day-page total includes cups, international, youth, lower tiers and non-European matches; not a domestic eligible count |
| ESPN public scoreboard | Domestic competition codes across 16 countries | All 16 countries overlap OpenMatchday's 29-country set | Adds no new country coverage; international fixtures also appear |
| OpenLigaDB | Germany | Existing OpenMatchday country overlap | No net-new country coverage |
| TheSportsDB | Public v1 fixture/history endpoints | Three events in the 17 Nov source test | No new eligible domestic tier-1/tier-2 fixture in that sample |
| OpenFootball Europe | Current 2026/27 text files for Czechia, France, Greece, Netherlands, Portugal, Scotland, Switzerland and Turkey | All eight countries already appear in OpenMatchday | No net-new country coverage in this snapshot; upstream Football.TXT files are not daily refreshed |
| openfootball/football.json | Daily JSON mirror | Latest repository commit observed 2026-09-22 | Too stale to rely on as a current-day fixture source without per-file freshness checks |

### Combined catalogue evidence

- At least one tier-1 or tier-2 source is visible for 30 of UEFA's 55 associations.
- Tier 1 is represented for 28 associations.
- Tier 2 is represented for 19 associations.
- Both tiers are represented for 17 associations.
- These are catalogue counts, not proof of full match-day coverage.

The 25 associations with no verified tier-1/tier-2 national domestic fixture source in the current catalogues are:

Albania, Andorra, Armenia, Azerbaijan, Belarus, Bosnia and Herzegovina, Bulgaria, Estonia, Faroe Islands, Georgia, Gibraltar, Hungary, Iceland, Israel, Kosovo, Latvia, Liechtenstein, Lithuania, Luxembourg, Malta, Moldova, Montenegro, North Macedonia, San Marino and Serbia.

## 17 November 2026 source-vs-database sample

- FootyNomad day page: 173 total fixtures across 20 countries.
- Production database: 110 match rows across sources; 2 pass the shared European domestic senior-men tier-1/tier-2 predicate.
- FootyNomad subset: 99 rows, 2 eligible and 97 out-of-scope rows retained for history/audit.
- The two eligible fixtures are Northern Ireland Championship matches. The other rows include international, cups, youth/reserve and lower-tier competitions.
- moneyball-public-sources: 11 raw fixtures, 8 European, 8 unique. All eight European fixtures were UEFA Nations League/international, not domestic league fixtures. OpenMatchday checked 38 European competitions and returned zero fixtures that day; ESPN returned eight international fixtures; OpenLigaDB zero; TheSportsDB three non-qualifying events.
- Therefore european_fixtures from the public aggregator must not be read as the number of eligible domestic fixtures.

## Production SQL filter regression

The 634 competition labels exposed by FootyNomad /browse were evaluated against production SQL. Before the fix, 29 labels passed, including three false positives:

1. Italy — 'Serie D - Championship Round': 4th tier passed because the generic 'championship' alias matched.
2. Sweden — 'Damallsvenskan': women's league passed because 'allsvenskan' matched as a substring and the name was missing from importer gender detection.
3. England — 'Premier League - Summer Series': exhibition series passed because 'premier league' matched.

After the fix, exactly 26 expected tier-1/tier-2 labels remain accepted across 13 country sections. Production SQL regression cases passed 12/12, including valid tier-1/tier-2 controls and all three exclusions. Damallsvenskan is rejected even when the stored gender is NULL.

## Repair deployed

- Code commit: b02709f63e4b141ada5fb025b8b30a1b3f1ed9e9.
- Production SQL migration: 20261117124000_exclude_serie_d_womens_and_summer_series.sql, applied successfully.
- Migration file correction commit: f15a2a985e30b6e2c85f0ae60562a73ebe2b7971.
- Supabase Edge Functions: moneyball-public-sources v63, footynomad-sync v87, moneyball-free-feed v43; existing JWT settings preserved.
- Public source v63 post-deploy smoke: three HTTP 200 responses, 2.375–3.965 seconds.
- GitHub CI 44051320905: SUCCESS.
- Cloudflare Worker MAIN deploy 44051320954: SUCCESS.
- Worker root and login routes load; protected /panel returns login_required when unauthenticated.

## Next work

1. Compare official domestic tier-1/tier-2 competition lists for the 25 missing associations against source catalogues and identify lawful no-key public fixture feeds.
2. Verify the next 15:00 Europe/Brussels scheduled scan on Edge Function versions 87/43/63, including importer errors, eligible matches, predictions and duplicates.
3. Verify the authenticated MAIN UI in a real existing user session.
4. Do not claim full coverage or close issue #77 until the country-by-country source → database → RPC → authenticated UI chain is proven.
5. Do not invent odds; current sources provide no fresh Belgian bookmaker prices. MAIN/MEGA/EXTRA remain blocked until fresh odds are available.
