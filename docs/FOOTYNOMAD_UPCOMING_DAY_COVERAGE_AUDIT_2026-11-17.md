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