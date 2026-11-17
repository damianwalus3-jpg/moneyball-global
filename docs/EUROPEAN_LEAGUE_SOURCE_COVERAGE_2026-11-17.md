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

## Additional source discovered: Football Charts (2026-11-17 10:20 Europe/Brussels)

Football Charts' official API catalogue lists 98 leagues in 44 countries, including 31 UEFA associations. It adds Azerbaijan, Bulgaria, Estonia, Hungary, Latvia, Lithuania and Serbia to the previous combined catalogue. Coverage evidence rises from 30/55 to at least 37/55; 18 associations remain without a verified current tier-1/tier-2 domestic source: Albania, Andorra, Armenia, Belarus, Bosnia and Herzegovina, Faroe Islands, Georgia, Gibraltar, Iceland, Israel, Kosovo, Liechtenstein, Luxembourg, Malta, Moldova, Montenegro, North Macedonia and San Marino.

Docs: https://www.football-charts.com/developers ; terms: https://www.football-charts.com/terms

No-key limit is 25 requests/day per IP. The free API updates daily around 06:00 UTC and fixture endpoints expose only the next few days. Free use is personal/private with attribution; if other people use the app, Commercial plan is required. Raw data cannot be redistributed. No free-tier odds or per-match xG/shots/passes.

MONEYBALL allowlists only eight league IDs: Azerbaijan Premier League, Bulgaria efbet League, Estonia Meistriliiga, Hungary NB I and NB II, Latvia Virsliga, Lithuania TOPLYGA, Serbia Mozzart Bet Super Liga. The authenticated importer filters to the exact Europe/Brussels day, parses UTC timestamps, stores minimal fixture data and attribution, discards the provider's model predictions and does not import stats or odds. Owner UUID gate keeps the personal-use source away from other accounts. It is not exposed via the public fixture aggregator.

All eight endpoints returned valid JSON. On 17 Nov there were no same-day matches among these leagues; upcoming fixtures were present for 20–23 Nov in several countries, next-known fixtures for Estonia and Lithuania, and none within three days for Latvia. Endpoint validation only; authenticated database import still pending.

FotMob and SofaScore were rejected for automated extraction/re-use restrictions: https://github.com/probberechts/soccerdata/issues/918 and https://www.sofascore.com/terms-and-conditions (2.8–2.9). TheSportsDB adds no missing UEFA coverage in the checked sample. OpenFootball Europe files for many missing associations are 2024–25/2025; only France, Netherlands and Portugal show 2026–27 in the current index.

Implementation commits: 2d1ae325a7d8ad4bbaf4d2697434c5e6a2b62acb (integration and aliases), f382cab9cb8228ef64ad154a602966e9037edf42 (owner gate). Migration 20261117102000_add_footballcharts_bulgaria_lithuania_aliases.sql applied. SQL 15/15; CI 44053372684 and Cloudflare MAIN deploy 44053372690 SUCCESS; Supabase footynomad-sync v88. Authenticated import remains pending.
## FootyNomad day-page vs DB reconciliation — 2026-11-17 10:24 Europe/Brussels

- Full FootyNomad page for 17 Nov reports 173 matches across 20 countries: https://footynomad.com/fixtures/2026-11-17
- Owner DB contains 99 FootyNomad rows for the Brussels-local day. Grouped DB counts: 41 European domestic-category rows, 57 UEFA/World competition rows (senior Nations League and U17/U19/U21/U20 competitions), plus one Ukraine Persha Liga row involving Polissya II.
- The page's European domestic categories are exactly France National 2 (1), Czech 3. liga (1), England domestic lower tiers/cups (28), Northern Ireland Championship (2), Portugal U23 (1), Scotland Lowland League (8) = 41; all 41 are present in the DB. No European domestic day-page fixture omission was found in this comparison.
- Exactly 2/41 European domestic rows qualify: Northern Ireland Championship matches Rathfriland–Moyola Park and Warrenpoint–Glenavon. The remaining 39 are correctly out of scope: France National 2 (tier 4), Czech 3. liga (tier 3), England EFL Trophy/cups and National League North/South + Non-League Premier (lower tiers), Portugal Liga Revelação U23, Scotland Lowland League (below tier 2).
- Ukraine Persha Liga is not a reserve-tier alias issue: one side is Polissya II, so the B-team exclusion correctly rejects it.
- The 173 page total is global, not Europe-only: it includes AFC U17, AFCON qualifiers, friendlies and non-European domestic fixtures. Do not compare 173 directly with the 99 Europe-filtered stored rows or treat the difference as an importer failure.
- This reconciliation confirms the day-specific European filter and importer coverage for the visible European domestic categories. It does not prove every country has a source on every date; the separate 18-country source gap remains.
## Correction: FootyNomad upcoming day pages expand verified coverage — 2026-11-17 10:35 Europe/Brussels

The previous 18-country gap was overstated because it relied too heavily on the FootyNomad /browse directory, which lists only 13 countries and is not a complete catalogue. Current day fixture pages expose more country/league sections.

### Day-page observations
- 20 Nov 2026: 342 fixtures / 72 countries. Additional senior domestic top-two labels included Bulgaria First/Second League, Cyprus 2. Division, Armenia Premier League, Azerbaijan Premyer Liqa/Birinci Dasta, Georgia Erovnuli Liga, Gibraltar Premier Division, Kosovo Superliga, Macedonia First League and Malta Premier League.
- 21 Nov 2026: 1,269 fixtures / 103 countries. Additional labels included Andorra 1a Divisió, Armenia First League/Premier League, Belarus Premier League/1. Division, Bosnia Premijer Liga and 1st League FBiH/RS, Georgia Erovnuli Liga 2, Gibraltar Premier Division, Kosovo Superliga, Macedonia First/Second League, Montenegro First/Second League and San Marino Campionato.
- 22 Nov 2026: 908 fixtures / 95 countries. New senior domestic top-two labels include Albania Superliga/1st Division and Luxembourg National Division; the page also confirms Andorra, Armenia, Azerbaijan, Bosnia, Gibraltar, Kosovo, Macedonia, Malta and San Marino.
- 23 Nov 2026: 113 fixtures / 42 countries; no new previously-unobserved UEFA domestic league source was identified in the page's section headings.
- This adds 13 previously unobserved UEFA associations to the prior 37/55 catalogue evidence: Andorra, Armenia, Belarus, Bosnia and Herzegovina, Georgia, Gibraltar, Kosovo, Malta, Montenegro, North Macedonia, San Marino, Albania and Luxembourg. Current observed source coverage is therefore at least 50/55, not 37/55.
- Five associations remain unverified in this sample: Faroe Islands, Iceland, Israel, Liechtenstein and Moldova. Liechtenstein has no independent national league; its clubs play in the Swiss league system. Faroe Islands and Iceland use calendar-year seasons and may be between seasons in November. Israel has no fixture section in the 20–23 Nov sample. Moldova appears as a country heading with a match count but no competition heading or fixture-card details; do not infer a competition.

### Filter and parser validation
- Production SQL regression across 43 labels from the 20–21 Nov FootyNomad day pages passed 43/43. Controls include Andorra, Armenia, Azerbaijan, Belarus, Bosnia, Bulgaria, Cyprus, Georgia, Gibraltar, Kosovo, Macedonia, Malta, Moldova named leagues, Montenegro, San Marino, Northern Ireland, Romania and Croatia; lower-tier controls (Bulgaria Third League, Georgia Liga 3, Poland II Liga, England National League/League One, France Ligue 3, Italy Serie C, Spain Primera RFEF, Portugal Liga 3, Belgium First Amateur, Scotland Highland League, Switzerland 1. Liga Promotion) all reject.
- Additional 22 Nov SQL regression passed 12/12 for Albania, Luxembourg, Faroe Islands, Iceland, Israel, named Moldova leagues and empty Moldova competition. Empty competition correctly rejects; do not infer a league from country alone.
- The importer parser previously found the nearest league-group before checking the country heading. If a country section had no league heading, this could inherit a league from the previous country. Commit 243de2f00c8c86875c6a7335996e3a9abd41ce12 reverses the order and requires the league group to be after the current country heading (gs > cs). A regression test confirms blank competition remains rejected.
- Supabase footynomad-sync v89 deployed with verify_jwt=true. GitHub CI 44055361844 SUCCESS. Cloudflare MAIN deploy run 44055361947 was initiated for commit 243de2f; verify final status. The parser correction is not yet proven by a live authenticated import; verify at the next 15:00 scan.

### Current coverage statement
- At least 50/55 UEFA associations have a verified current tier-1/tier-2 fixture source in the combined catalogue/day-page evidence. This is source/season evidence, not a guarantee that every country has fixtures every day.
- The remaining five are not all true gaps: Liechtenstein has no domestic league; Faroe Islands and Iceland are out of season in November; Israel and Moldova need further official source/fixture verification.
- The FootyNomad /browse page is not an authoritative complete league directory. Use actual dated /fixtures/YYYY-MM-DD pages for source discovery and compare their competition sections against importer output. Do not count every global match as an eligible European match.
- The 17 Nov reconciliation remains unchanged: 41 European domestic-category rows in the page/DB; only two Northern Ireland Championship fixtures meet tier-1/2 senior-men scope.