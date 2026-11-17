# European domestic source audit — 2026-11-17

## Result

Cross-checked the previously unverified UEFA associations against current 2026/27 federation, league and UEFA fixture sources. Combined source evidence is now at least 53 of 55 UEFA member associations. This is source-discovery coverage, NOT a claim that all 53 are already automatically imported by MONEYBALL.

- Belarus remains the only UEFA association with a domestic league for which this audit did not verify a current 2026/27 public fixture source.
- Liechtenstein has no national league; its clubs play in the Swiss league pyramid. Its national competition is the Liechtenstein Cup, which MONEYBALL intentionally excludes.
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
- 16 further associations above now have verified current official source pages, bringing evidence to 53/55.
- Belarus is the only remaining association with a domestic league for which a current 2026/27 fixture source was not verified in this audit. Its 2026 season is near/at completion; do not claim no league exists.
- Liechtenstein has no domestic national league. UEFA confirms its clubs play in the Swiss pyramid; only a national cup exists. Exclude Liechtenstein Cup from MONEYBALL league predictions.

## MONEYBALL alias coverage updated

The canonical domain predicate, both FootyNomad Edge Function filters, and the production SQL predicate now recognize the current names for the newly verified competitions, including: Abissnet Superiore; Lliga Multisegur Assegurances; Lliga Grup Pirineu; WWIN Liga Bosne i Hercegovine; Meistaradeildin menn; 1. deild menn; Erovnuli Liga 2; Gibraltar Football League; Lengjudeild karla; Ligat Winner / Winner League; Albi Mall Superliga; BGL Ligue; Promotion d'Honneur; VBet Malta Premier League; Liga 7777; Meridianbet 1. CFL; Prva MFL / Vtora MFL. Existing aliases already covered Armenian Premier League and Campionato Sammarinese.

Production migrations applied for these alias additions: `20261117102000` (Bulgaria/Lithuania), `20261117113000` (Moldova/Israel), `20261117114000` (Faroe/Iceland), `20261117115000` (Montenegro/North Macedonia/Bosnia), `20261117116000` (Albania/Kosovo/Luxembourg/Malta), and `20261117117000` (Andorra). SQL regression checks confirmed the aliases and rejected women's competitions.

## Important integration distinction

These official pages prove current league identity and provide fixtures/calendars, but they have NOT all been wired as automated MONEYBALL feed adapters. The live automatic feed remains FootyNomad; Football Charts is an owner-only private-use fallback for eight allowlisted leagues. Official sites above are future adapter candidates only after their access terms, robots policy, data reuse permissions, update frequency and stable page/API structure are checked. Do not copy or scrape them into production merely because pages are publicly readable.

Do not claim 53-country automated import. Current source discovery is 53/55; production importer coverage remains narrower and requires source-by-source integration and authenticated end-to-end verification.