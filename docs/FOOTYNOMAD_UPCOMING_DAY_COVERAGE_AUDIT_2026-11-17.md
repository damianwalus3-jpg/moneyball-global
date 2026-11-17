# FootyNomad upcoming-day coverage audit — 2026-11-17

## Correction to earlier catalogue count

The earlier 18-country gap was overstated because it relied on the FootyNomad /browse directory. That directory exposes only 13 European country sections and is not a complete catalogue. Actual dated /fixtures/YYYY-MM-DD pages show current domestic fixtures in more countries.

## Observed pages

| Brussels-local fixture date | Page total | UEFA domestic tier-1/2 associations newly observed |
|---|---:|---|
| 20 Nov 2026 | 342 fixtures / 72 countries | Armenia, Azerbaijan, Bulgaria, Cyprus, Georgia, Gibraltar, Kosovo, North Macedonia, Malta |
| 21 Nov 2026 | 1,269 fixtures / 103 countries | Andorra, Armenia, Azerbaijan, Belarus, Bosnia and Herzegovina, Georgia, Gibraltar, Kosovo, North Macedonia, Montenegro, San Marino |
| 22 Nov 2026 | 908 fixtures / 95 countries | Albania, Andorra, Armenia, Azerbaijan, Bosnia and Herzegovina, Gibraltar, Kosovo, North Macedonia, Malta, San Marino, Luxembourg |
| 23 Nov 2026 | 113 fixtures / 42 countries | No additional previously-unobserved UEFA domestic tier-1/2 source in the headings |

Thirteen previously unobserved associations are added to the prior 37/55 source evidence: Andorra, Armenia, Belarus, Bosnia and Herzegovina, Georgia, Gibraltar, Kosovo, Malta, Montenegro, North Macedonia, San Marino, Albania and Luxembourg. Combined observed source coverage is now at least 50/55.

Five associations remain unverified in this sample: Faroe Islands, Iceland, Israel, Liechtenstein and Moldova. Liechtenstein has no independent domestic league; its clubs play in the Swiss system. Faroe Islands and Iceland use calendar-year seasons and may be between seasons in November. Israel had no fixture section in the 20–23 Nov sample. Moldova appeared as a country heading with match counts but no competition heading or fixture-card details, so no competition can safely be inferred.

## Exact league labels observed and validated

- Andorra: 1a Divisió (tier 1).
- Albania: Superliga (tier 1), 1st Division (tier 2).
- Armenia: Premier League (tier 1), First League (tier 2).
- Azerbaijan: Premyer Liqa (tier 1), Birinci Dasta (tier 2).
- Belarus: Premier League (tier 1), 1. Division (tier 2).
- Bosnia and Herzegovina: Premijer Liga (tier 1), 1st League - FBiH and 1st League - RS (tier 2).
- Bulgaria: First League (tier 1), Second League (tier 2).
- Cyprus: 1. Division (tier 1), 2. Division (tier 2).
- Georgia: Erovnuli Liga (tier 1), Erovnuli Liga 2 (tier 2).
- Gibraltar: Premier Division (tier 1).
- Kosovo: Superliga (tier 1).
- Malta: Premier League (tier 1), Challenge League (tier 2).
- Macedonia: First League (tier 1), Second League (tier 2).
- Montenegro: First League (tier 1), Second League (tier 2).
- San Marino: Campionato (tier 1).
- Luxembourg: National Division (tier 1).

## Filter validation

- Production SQL evaluated 43 competition labels from the 20–21 Nov pages: 43/43 passed, including the valid senior domestic tier-1/2 labels and rejection controls for Bulgaria Third League, Georgia Liga 3, Poland II Liga, England National League/League One, France Ligue 3, Italy Serie C, Spain Primera RFEF, Portugal Liga 3, Belgium First Amateur, Scotland Highland League and Switzerland 1. Liga Promotion.
- A further 12 SQL cases for Albania, Luxembourg, Faroe Islands, Iceland, Israel and Moldova passed. Blank Moldova competition correctly rejects; the system must not infer a league from country alone.

## Parser bug fixed

The FootyNomad HTML importer previously found the nearest league-group before checking the current country heading. If a country section had no league heading, the parser could accidentally inherit the previous country's competition. Commit 243de2f00c8c86875c6a7335996e3a9abd41ce12 now computes the country section first and accepts a league group only if it appears after that heading (gs > cs). A regression test confirms an empty competition is rejected.

Supabase footynomad-sync v89 deployed with verify_jwt=true. GitHub CI 44055361844 SUCCESS. Cloudflare MAIN deploy run 44055361947 was initiated for commit 243de2f; verify final status. A live authenticated scan is still needed to prove the parser fix end-to-end.

## Rules for future source audits

1. Do not treat FootyNomad /browse as a complete catalogue; inspect dated fixture pages.
2. Do not count global page totals as eligible European domestic matches.
3. Do not infer league names from country headings. A missing competition label must reject.
4. Keep exact country + competition aliases and explicit lower-tier exclusions under SQL regression.
5. Distinguish source/season coverage from a match being scheduled on a specific day.
## Shared FootyNomad parser + UI scope regression — 2026-11-17

### Second parser path corrected
- Discovery: the 15-minute automatic `moneyball-free-feed` had a separate FootyNomad HTML parser from authenticated `footynomad-sync`. The earlier country-heading/league-group fix had only been applied to the authenticated importer, leaving the automatic feed vulnerable to inheriting the previous country's league group when the current country had no competition heading.
- Commit `269e85f78b0d7a608fd6d1a1c4c339d646c663a7` adds shared `supabase/functions/_shared/footynomad-section.ts` and uses it in BOTH Edge Functions. A league group is accepted only if it follows the current country heading; missing competition remains null and is rejected by scope filters.
- Added two regression tests in `src/lib/domain.test.ts`: missing league heading cannot inherit the previous country's league; a league group after the current country heading is accepted.
- Supabase `moneyball-free-feed` deployed v45 and `footynomad-sync` deployed v90, both `verify_jwt=true`. CI run `44056482857` SUCCESS; Cloudflare MAIN Worker deploy `44056483454` SUCCESS.
- Triggered the real automatic feed through the existing cron-authenticated endpoint (HTTP request id 3964). Response HTTP 200: date 2026-11-17, reported fixtures 2, inserted 0, updated 2. The production feed table contains exactly two fixtures: Warrenpoint Town–Glenavon FC and Rathfriland–Moyola Park, both Northern Ireland Championship, scheduled 19:45 UTC. This is a real production feed refresh, not a mock.

### Prediction and results views aligned with canonical scope
- Found `moneyball_predictions_page` and `moneyball_results_page` did not apply the same European senior-men tier-1/tier-2 predicate already used by dashboard summary, selected picks and the match screen. This could expose legacy out-of-scope predictions/results in those two views.
- Migration `20261117110000_filter_prediction_and_results_views_to_european_top_two.sql` applied. It joins predictions to their match and applies `moneyball_is_eligible_european_match` plus senior-men scope in the prediction base CTE; results page applies the same filter to its match window. No historical rows, coupons, settlements or bankroll transactions were deleted or modified.
- Production RPC regression under the owner's auth context: first prediction page had 0 ineligible rows; first results page had 0 ineligible rows.
- GitHub CI `44056784876` SUCCESS; Cloudflare MAIN Worker deploy `44056784923` SUCCESS for commit `6ec923fc`. The app's `/` and `/login` routes load; `/panel` correctly remains protected and reports `login_required` without an authenticated session.

### Production day scope and outstanding proof
- 17 Nov database snapshot: 99 FootyNomad-sourced match rows for the day; exactly 2 pass the canonical eligibility predicate. Those two are the Northern Ireland Championship fixtures listed above. The remaining 97 are out-of-scope competitions/tiers (cups, youth, reserves, lower divisions, international matches etc.) and are not valid candidates. Existing legacy rows are preserved; current match, prediction and results views now filter them.
- Existing authenticated `mecze` page has separate '1. Szukaj meczów' (`footynomad-sync`) and '2. Analizuj' (`moneyball-predict`) actions, both using `brusselsDayKey(new Date())`. The automatic public feed refreshes independently every 15 minutes.
- The 17 Nov 09:33 UTC automatic feed refresh verified v45 in production. `footynomad-sync` v90 has been deployed, but no post-v90 authenticated user-triggered sync was performed from this audit; the database import through that authenticated path still needs end-to-end verification.
- Issue #77 remains OPEN. Continue source-vs-import comparison on dated FootyNomad pages and run the authenticated MAIN search/analysis from the user's session. Do not declare the app/project complete yet.