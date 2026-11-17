# European domestic source audit — 2026-11-17

## Result

Cross-checked the previously unverified UEFA associations against current 2026/27 federation, league and UEFA fixture sources. Combined source evidence is now at least 54 of 55 UEFA member associations. This is source-discovery coverage, NOT a claim that all 53 are already automatically imported by MONEYBALL.

- Belarus is now covered by the primary FootyNomad source: the 21 Nov 2026 page lists the senior men's Premier League and 1. Division. The authenticated parser v97 returns 8 Premier League matches and 6 eligible 1. Division matches after excluding reserve-team fixtures.
- Liechtenstein has no national league; its clubs play in the Swiss league pyramid. Its national competition is the Liechtenstein Cup, which MONEYBALL intentionally excludes. This leaves no UEFA association with an existing domestic league unverified in this source audit.
- The 16 newly verified associations and their official current sources are listed below.

## Verified official sources

| Association | Verified current senior competition(s) | Official source | Current evidence |
|---|---|---|---|
| Albania | Abissnet Superiore (tier 1) | https://fshf.org/sq/abissnet-superiore-percaktohet-kalendari-nga-java-e-6-te-deri-ne-javen-e-11-te/ | FSHF published 2026/27 rounds 6–11 with dates and fixtures. |
| Andorra | Lliga Multisegur Assegurances (tier 1); Lliga Grup Pirineu (tier 2) | https://www.faf.ad/pnfg/NNws_ShwNewDup?cod_primaria=3000277&cod_secundaria=3001702&codigo=1009345 | FAF confirms the 2026/27 season and describes Lliga Grup Pirineu as the national second division; current league calendar is published. |
| Armenia | Armenian Premier League (tier 1) | https://www.uefa.com/nationalassociations/arm/domestic/league/1079/matches/ | UEFA's official Armenia association page exposes the 2026/27 domestic fixture calendar. |
| Bosnia and Herzegovina | WWIN Liga Bosne i Hercegovine (tier 1); First League FBiH / First League RS (tier 2) | https://www.nfsbih.ba/en/news/football-m/wwin-league-bh/dates-set-for-postponed-wwin-league-bih-and-bih-supercup-matches/ | NFSBiH published current 2026/27 competition fixture decisions and match dates. |
| Faroe Islands | Meistaradeildin menn (tier 1); 1. deild menn (tier 2) | https://www.fsf.fo/kappingar-og-urslit/fm-og-steypavinnarar/2026-2/ | FSF's 2026 champions page lists both men's senior divisions; 2026 season ended 31 Oct. |
| Georgia | Erovnuli Liga (tier 1); Erovnuli Liga 2 (tier 2) | https://liga.gff.ge/en/node/4894 | GFF's official league platform exposes 2026 Erovnuli Liga 2 match reports and results; official 2026 regulations list Liga and Liga 2. |
| Gibraltar | Gibraltar Football League (tier 1) | https://www.gibraltarfa.com/competitions/gibraltar-football-league-26-27-3395567 | GFA's official 2026/27 table, results and upcoming fixtures page. |
| Iceland | Besta deild karla (tier 1); Lengjudeild karla (tier 2) | https://www.ksi.is/oll-mot/?name=lengjudeild&pageSize=10&season=2026 | KSÍ's official 2026 men's competition index lists both current divisions and match results; season ended in October. |
| Israel | Ligat Winner (tier 1); Liga Leumit (tier 2) | https://www.football.org.il/leagues/league/?league_id=40&season_id=27 | Israel FA's official competition pages expose the current senior leagues and 2026/27 season data. |
| Kosovo | Albi Mall Superliga (tier 1) | https://ffk-kosova.com/garat/Albi-Mall-superliga | FFK's official 2026 match rounds, results and standings. |
| Luxembourg | BGL Ligue (tier 1); Promotion d'Honneur (tier 2) | https://www.flf.lu/generaux-92804v4 | FLF's official detailed 2026/27 calendars for both divisions. |
| Malta | VBet Malta Premier League (tier 1); Challenge League (tier 2) | https://tickets.mfa.com.mt/ | Malta FA's official 2026/27 event/fixture listing includes dates, kick-off times and venues for Premier League games. |
| Moldova | Liga 7777 (tier 1); Liga 1 (tier 2) | https://fmf.md/ | FMF's official 2026/27 competition and schedule publications for both senior divisions. |
| Montenegro | Meridianbet 1. CFL (tier 1) | https://fscg.me/takmicenja/meridianbet-1-cfl/ | FSCG's official 2026/27 fixture, result and table page. |
| North Macedonia | Prva MFL (tier 1); Vtora MFL (tier 2) | https://www.ffm.mk/en/natprevaruvanje/prva-mfl27/ | FFM's official English 2026/27 fixture and result page. |
| San Marino | Campionato Sammarinese (tier 1) | https://www.fsgc.sm/it/campionato/campionato-sammarinese/1 | FSGC's official 2026/27 matchday fixtures, results and dates. |

## Existing source coverage and exceptions

- Prior combined source catalogue: at least 37/55 UEFA associations.
- 16 further associations above have verified current official source pages; Belarus is additionally confirmed through FootyNomad, bringing evidence to 54/55.
- Belarus primary-feed proof: FootyNomad 21 Nov 2026 lists `Premier League` (8 fixtures) and `1. Division` (9 raw fixtures). Production `footynomad-sync` v97 GET returns 8 top-tier fixtures plus 6 senior second-tier fixtures after excluding 3 reserve-team fixtures. All 14 Belarus fixtures returned by the parser pass the production SQL eligibility predicate.
- Production `footynomad-sync` v97 GET for 21 Nov returns 301 eligible fixtures across 43 countries. All 301/301 pass `moneyball_is_eligible_european_match`; this is a live parser/source check, not yet proof of authenticated database insertion.
- Liechtenstein has no domestic national league. UEFA confirms its clubs play in the Swiss pyramid; only a national cup exists. Exclude Liechtenstein Cup from MONEYBALL league predictions.

## MONEYBALL alias coverage updated

The canonical domain predicate, both FootyNomad Edge Function filters, and the production SQL predicate now recognize the current names for the newly verified competitions, including: Abissnet Superiore; Lliga Multisegur Assegurances; Lliga Grup Pirineu; WWIN Liga Bosne i Hercegovine; Meistaradeildin menn; 1. deild menn; Erovnuli Liga 2; Gibraltar Football League; Lengjudeild karla; Ligat Winner / Winner League; Albi Mall Superliga; BGL Ligue; Promotion d'Honneur; VBet Malta Premier League; Liga 7777; Meridianbet 1. CFL; Prva MFL / Vtora MFL. Existing aliases already covered Armenian Premier League and Campionato Sammarinese.

Production migrations applied for these alias additions: `20261117102000` (Bulgaria/Lithuania), `20261117113000` (Moldova/Israel), `20261117114000` (Faroe/Iceland), `20261117115000` (Montenegro/North Macedonia/Bosnia), `20261117116000` (Albania/Kosovo/Luxembourg/Malta), and `20261117117000` (Andorra). SQL regression checks confirmed the aliases and rejected women's competitions.

## Important integration distinction

These official pages prove current league identity and provide fixtures/calendars, but they have NOT all been wired as automated MONEYBALL feed adapters. The live automatic feed remains FootyNomad; Football Charts is an owner-only private-use fallback for eight allowlisted leagues. Official sites above are future adapter candidates only after their access terms, robots policy, data reuse permissions, update frequency and stable page/API structure are checked. Do not copy or scrape them into production merely because pages are publicly readable.

Do not claim 53-country automated import. Current source discovery is 54/55; production importer coverage remains narrower and requires source-by-source integration and authenticated end-to-end verification.

## Belarus and 21 November live parser regression — 2026-11-17

The initial audit incorrectly left Belarus as the remaining country without a verified source. A follow-up read of FootyNomad's actual 21 Nov page found Belarus: `Premier League` (8 fixtures) and `1. Division` (9 raw fixtures). Production `footynomad-sync` v97 GET returns 8 senior top-flight matches and 6 eligible senior second-tier matches; three reserve-team fixtures are excluded. All 14 returned Belarus fixtures pass the production SQL eligibility predicate.

The same live GET for 2026-11-21 returned 301 fixtures across 43 countries; SQL validation found 301 eligible and 0 rejected. This confirms the parser and canonical scope for that dated source response, but does not prove authenticated insertion into the owner's `matches` table.

Updated source discovery evidence: 54/55 UEFA associations. Liechtenstein is the sole association without a domestic national league; its clubs compete in Switzerland and its national cup is excluded. There is no remaining UEFA domestic-league association without at least one verified source in this audit. Automated import coverage remains narrower than source-discovery coverage.


## Additional tracker evaluation — 2026-11-17 17:10 Europe/Brussels

The following candidates were checked against the existing no-API-key / no-paid-provider project constraint:

| Candidate | Current public facts | Decision for MAIN |
|---|---|---|
| PitchAPI | Official site states 77 leagues, free/no paid tier and unlimited requests, but every call requires an API key. | Best future candidate for xG, shots, lineups and stats if the user explicitly permits a free API key. Not enabled under the current no-key constraint. |
| StrikerAPI | Official docs state 500 free credits/month, every request requires an API key; paid tiers start at $19/month. | Not suitable for full Europe-wide polling; keep disabled and do not consume credits. |
| API-Football | Official coverage lists 1,251 competitions, but the free plan is limited to 100 requests/day and requires an API key. | Catalogue is broad, quota is too small for a frequent all-Europe scan; do not enable under current no-key constraint. |
| Football Charts | No-key tier is limited to 25 requests/day and private/personal use; 8 allowlisted competitions are currently integrated. The 17 Nov scan returned 429 for 4 of 8 leagues. | Keep optional and owner-only only after durable caching and controlled request cadence; never let it block FootyNomad. |
| Flashscore third-party scraper | An unofficial scraper claims broad Flashscore competition coverage and no account/API key. | Do not add as a production dependency until the scraper's terms, source access, uptime, rate limits and redistribution rights are independently cleared. Use Flashscore as a manual verification source only. |
| FotMob / SofaScore | Existing project checks found unstable/restricted automated access; current research does not justify bypassing their controls. | Do not scrape or bypass blocks. |
| Fotbalinfo + Jina Reader | Current test function fetches one hard-coded Slovenian 2. SNL match page through a text proxy. | A one-match parser experiment, not a general European fixture tracker; do not enable for production ingestion. |
| OpenMatchday | Free/no-key daily CSV source with a fixed published competition index; useful for results/history and some fixtures, but not every European league. | Keep as an independent supplemental feed, with date, status and eligibility reconciliation. |

Official provider references checked:
- PitchAPI: https://pitchapi.dev/
- StrikerAPI docs/pricing: https://strikerapi.com/docs and https://strikerapi.com/
- API-Football coverage/pricing: https://www.api-football.com/coverage and https://www.api-football.com/pricing
- Flashscore scraper candidate: https://github.com/clearfetch/flashscore-football-scraper
- OpenMatchday: https://github.com/oladeeayo/open-matchday

No new provider was enabled, no API key was added, and no provider credits were consumed. The current best no-key primary fixture source remains FootyNomad, with OpenMatchday and carefully limited Football Charts as supplemental sources. The 54/55 official source-discovery audit remains distinct from automated importer coverage.
