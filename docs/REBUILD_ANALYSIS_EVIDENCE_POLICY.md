# MONEYBALL GLOBAL — evidence and source policy

Date: 2026-11-18  
Scope: repository `damianwalus3-jpg/moneyball-global`, branch `moneyball-rebuild`, Cloudflare Free Worker only. No Vercel, Lovable, paid feed, secret, API key or new database.

## Required evidence before a match can be labelled a strong candidate

The engine tracks eight separate areas. Every item must have a provider, an observation timestamp no later than assessment time, and a VERIFIED state. Missing, partial, stale, conflicting, future-dated or unattributed values cannot pass the gate.

1. Team and opponent xG/xGA.
2. Confirmed starting lineups and formations (predicted lineups do not count as confirmed).
3. Verified injuries.
4. Verified suspensions.
5. Shot volume, shots on target and chance-quality evidence (big chances / shot-level xG where available).
6. Tactical setup and meaningful tactical changes.
7. Schedule load: previous match dates, rest days, travel where verifiable, congestion.
8. Current bookmaker odds, bookmaker identity, capture timestamp, complete market and EV calculated from an independently calibrated probability model.

## Public source findings and integration decision

### open-matchday
- https://github.com/oladeeayo/open-matchday
- Its README describes 75 competitions, daily CSVs, results, HT, goal minutes and stats such as shots, shots on target, fouls, cards and corners.
- Its own coverage notes state detailed statistics exist only for a minority of rows (roughly 19% for shots/fouls/cards/corners); blank means unavailable, never zero. Scores refresh daily, not live, and football-data-derived stats may lag a gameweek or two.
- It explicitly says it does not provide xG, lineups, injuries, odds or play-by-play. Team spellings can differ between feeds. It states non-commercial use and attribution. Use only as an attributed public history/stat source with per-row null and provenance validation.

### OpenFootball Europe
- https://github.com/openfootball/europe
- Useful public historical and fixture feeds; current-season completeness varies by country and league. It is not an xG, injury, lineup or odds feed. Use as corroboration, never as a substitute for missing advanced evidence.

### StatsBomb Open Data
- https://github.com/hudl/open-data
- JSON event and lineup data with shot events and xG for selected competition/season samples. StatsBomb requests attribution.
- Coverage is curated and historical/selected, not all current European clubs or every matchday. Suitable for historical model research/backtesting where competition coverage matches; not a universal live feed.

### football-data.co.uk
- https://football-data.co.uk/data
- Large historical results, match stats and bookmaker odds CSVs across selected leagues and seasons.
- Its fair-use policy at https://football-data.co.uk/contact.php says free files are for private individuals/personal betting and academic research, at most light automated download (twice weekly), and excludes commercial, AI-usage and model-training projects using automated bots/scrapers unless permission is granted. Do not add it as an automated production/model-training dependency. An aggregator's republication does not automatically grant new rights to the original data.

### PitchAPI
- https://pitchapi.dev/
- Documentation advertises a no-charge plan with 77 leagues, xG shot data, stats, events, lineups and advanced metrics; all requests require an API key. It distinguishes predicted lineups from confirmed lineups via a confirmed flag. It also notes IDs for some restored leagues changed and old IDs can return 404.
- Not integrated because the current project constraint is no API keys/secrets and the reviewed docs do not establish a sufficiently clear redistribution/licence basis for importing its full feed into this public app. Reconsider only with explicit authorization for a free key and verified source licence/retention terms. Free price does not mean no key or unrestricted reuse.

### Soccer Data
- https://soccer-data.co/docs/introduction
- https://soccer-data.co/pricing
- Free plan advertises 50 requests/day and current-season coverage; injuries/suspensions, lineups, xG and match stats are documented, but odds are Pro/Business only. API key required.
- Not sufficient for a full Europe-wide scan at this quota and has no odds on free tier. Not integrated under the no-key/no-paid constraint.

### FBref / Understat / ESPN
- The reviewed free-source overview reports FBref advanced Opta metrics discontinued in January 2026. Do not treat it as a current universal xG feed.
- Understat is scrape-based and top-league limited; the reviewed source overview reports restrictive automated-access policy. No scraper is introduced.
- ESPN public endpoints can return 404/403 or omit team/league history. Best-effort only; never convert an HTTP error into a zero stat or valid empty history.

## Implemented safety behaviour
- Baseline goals-Poisson lambda is labelled as a goals-derived proxy, not xG.
- The current baseline model alone cannot mark a match as a strong 1X2 or Double Chance candidate. A probability >=75% is not enough evidence.
- Coupon generation requires `evidenceComplete === true`. Legacy probability-only Tracker rows cannot enter new coupons.
- A per-prediction evidence audit records all eight areas and explicit missing states.
- Default odds freshness is tightened from six hours to 15 minutes for EV valuation. Complete 1X2 snapshot, bookmaker identity, timestamp and valid decimal prices remain mandatory.
- EV remains unavailable until current timestamped odds are captured and the probability model is calibrated out of sample. The EV formula cannot prove the model probability is reliable.

## Hard limitations
- No reviewed source provides complete, current, verified xG, confirmed lineups, injuries, suspensions, tactical data and odds for every European league and team while satisfying no-key/no-paid constraints.
- Rest days can be calculated only when a sufficiently complete fixture history exists; travel and training load are not inferred from match dates.
- Formation is not full tactical analysis.
- Never turn missing fields into zero, infer injuries from absence, treat predicted XIs as confirmed, or call goal-rate lambdas xG.
- No historical Tracker, prediction, coupon, settlement or bankroll records are rewritten by this policy.

## Web references reviewed
- https://github.com/oladeeayo/open-matchday
- https://github.com/openfootball/europe
- https://github.com/hudl/open-data
- https://football-data.co.uk/data
- https://football-data.co.uk/contact.php
- https://pitchapi.dev/
- https://soccer-data.co/pricing
- https://github.com/withqwerty/football-docs/blob/main/docs/free-sources/overview.md


## PitchAPI integration (approved 2026-11-18)
- Official docs: https://pitchapi.dev/ and key registration: https://pitchapi.dev/get-api-key
- Provider docs state one no-charge plan, 77 leagues, all endpoints and history back to 2021; API key required. Key is a bearer credential and must remain server-side.
- Available documented data includes fixtures, match summaries, shot-level xG, shots, team/player statistics, events, lineups with an explicit `confirmed` flag, and advanced analytics including PPDA/field tilt/possession-value metrics. Some competitions have reduced/selected coverage and analytics may return `ANALYTICS_UNAVAILABLE`; 77 leagues must not be represented as every European competition.
- No dedicated injuries/suspensions endpoint was found in the reviewed official API reference. Do not claim these two evidence areas are supplied by PitchAPI. They remain missing until an independent verified source is added.
- Added a Cloudflare Worker server-side proxy. It accepts only allowlisted GET routes for date fixtures and match resources, validates dates/status and PitchAPI match IDs, rejects non-app browser origins, never returns the API key, caches ordinary reads, and never caches live snapshots. The secret name is `PITCHAPI_API_KEY`; it is a Cloudflare Worker secret, not a Vite variable, GitHub file, or browser setting.
- The user approved using a free key and configured it directly in the Cloudflare Worker settings. Authenticated live endpoint checks subsequently succeeded. Never ask the user to paste the key into ChatGPT or commit it.
- The proxy exposes `/api/pitchapi/date/{YYYY-MM-DD}?status=upcoming|played|all`, `/api/pitchapi/leagues/{l_XXXXXX}`, `/api/pitchapi/leagues/{l_XXXXXX}/matches?season=YYYY/YYYY&status=played`, and `/api/pitchapi/matches/{m_XXXXXX}[/{lineups|shots|events|momentum|stats|players|advanced|advanced/network|advanced/players|live}]`.
- Key provisioning is complete and the authenticated live endpoint smoke test passed on 2026-11-18. The secret remains server-side in the REBUILT Cloudflare Worker; never print or expose its value. See Stage 113 in the execution log for real-feed and xG coverage evidence.


### PitchAPI key formats
PitchAPI's official reference supports both production keys (`pk_live_`) and test keys (`pk_test_`), both sent in the `X-API-KEY` header. The Worker accepts both formats. A test key may be subject to provider sandbox semantics; successful authentication and usable match coverage must be verified against the live endpoint before it is treated as a production data source.
