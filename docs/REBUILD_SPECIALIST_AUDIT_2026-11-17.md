# MONEYBALL REBUILD — specialist product, UX and engineering audit
**Review date:** 2026-11-17  
**Reviewed branch:** `moneyball-rebuild`  
**Reviewed commit:** `c7f9b197c5819d474224b1235796b9658008c822`  
**Production URL:** https://moneyball-global-rebuild.damianwalus3.workers.dev/

## Executive assessment
The rebuild is a useful, transparent local-first prototype with a clean React/TypeScript foundation, three public fixture sources, an append-oriented local Tracker, deterministic paper-coupon rules and automated CI/deployment. It is not yet a finished football-intelligence product. The most important gaps are not decorative: data-refresh policy, model validity, fixture identity, settlement lifecycle, missing product modules, persistence durability and end-to-end mobile acceptance.

**Recommendation:** do not add visual complexity before correcting the data/model trust layer. Prioritize source compliance and freshness, prediction integrity/backtesting, complete fixture/result lifecycle, then product workflows and visual polish.

## 1. Critical findings

### P0-1 — OpenLigaDB refresh policy needs correction
- The app forces a full fixture scan every 15 minutes while open.
- The browser enumerates the OpenLigaDB season catalogue and requests each selected competition's season match feed; the Worker currently assigns only 900 seconds of cache lifetime to match feeds.
- This can lead to repeated full-season retrievals, multiplied by browser users and Cloudflare cache locations. It does not use the provider's cheap change-date endpoint before re-fetching full datasets.
- OpenLigaDB's current fair-use terms say to poll `getlastchangedate` cheaply, retrieve full data only after a change, make considerably fewer requests outside live matches (a few per day), stagger requests, cache results, and back off on 429/5xx. During live matches the terms recommend no more than one request every 30–60 seconds per league.
- **Action:** implement a source-specific refresh policy: long-lived season/catalogue cache, change-date checks, conditional refresh, jitter, exponential backoff and a single shared fetch path. Do not have every browser independently refresh all feeds. Keep 15-minute local UI refresh separate from upstream source polling.
- Source: https://www.openligadb.de/en/terms-of-use

### P0-2 — Predictions can be created after kickoff
- The fixture list contains today's fixtures but does not carry a verified live/finished status or a prediction cutoff.
- The “Forma 5 + typ” action and “Analizuj wszystkie” can still be invoked for a match after its kickoff.
- The form query excludes matches on the fixture date, but that does not prevent a prediction timestamp after kickoff. Such records can enter model audit after the final result is known, contaminating evaluation with post-kickoff predictions.
- **Action:** persist a trusted UTC kickoff timestamp and source status; allow pre-match predictions only before a configurable cutoff; record `predictedAt`, reject late records from pre-match metrics, and keep any live/in-play analysis in a separate model/market namespace.

### P0-3 — Postponed/abandoned/void settlement lifecycle is missing
- Current result model supports only 1/X/2 and final scores.
- Coupon settlement returns null until all three legs have a valid 1/X/2 result. Postponed, cancelled, abandoned, awarded and void legs have no explicit state or policy, so coupons can remain pending indefinitely.
- The product specification says these states should be handled explicitly, but the implementation does not yet do so.
- **Action:** add a typed fixture/result lifecycle (scheduled, live, finished, postponed, cancelled, abandoned, awarded, unknown), explicit source evidence and settlement rules. A void leg should not be silently treated as a loss or a win.

## 2. High-priority product and data findings

### P1-1 — The “Typ dnia” tab is a placeholder
It currently displays only explanatory copy and counts. There is no daily selection engine, ranked rationale, risk factors, evidence freshness, or honest “no selection” state. Build this only after pre-match cutoff and model validation exist.

### P1-2 — Saved coupon lifecycle is not a real coupon workspace
The Kupony tab generates candidate combinations and lets the user save them, but does not show a saved-coupon list, leg-by-leg status, result timeline, settlement history, or filters. Repeated clicks can create duplicate saved coupons. The product should have separate “proposals”, “saved paper coupons”, “settled”, and “incomplete/void” views.

### P1-3 — Intelligence is much narrower than its product description
It currently reports 1X2 metrics, a derived Double Chance audit and 1X2 confidence buckets. It does not yet provide goals-market metrics, competition/source/model breakdown, rolling form, time-split performance, drawdown/ROI, confidence intervals or model-vs-baseline comparison. ROI must remain unavailable until verified bookmaker odds and a clearly separate paper ledger exist.

### P1-4 — Prediction model is a baseline, not a validated forecasting model
- It uses only recent goals/results (minimum three matches) and simple averages from home/away splits.
- Expected goals are constructed from the team's recent attack and opponent defence averages; there is no league scoring baseline, opponent-strength adjustment, recency weighting, season/roster context, xG, lineup or injury input.
- Independent Poisson is a reasonable baseline, but it does not model low-score dependence/correlation (e.g. Dixon–Coles) and its probability calibration has not been established.
- A 75% threshold is currently a rule, not an empirically demonstrated reliability boundary.
- **Action:** create a chronological, leakage-safe backtest; compare naive home/draw/away and league-average baselines; report sample size, Brier/log loss, calibration and confidence intervals by league/season. Add a probability calibration layer only after out-of-sample evidence. Do not market the current output as “verified”.

### P1-5 — Three-leg combined probability assumes independence
The product of the three leg probabilities is a mathematical independence estimate, not a verified coupon hit rate. It is additionally affected by model miscalibration and selection bias (only the highest-probability candidates are selected).
**Action:** label it “model estimate under independence assumption”, show the individual legs and historical coupon sample, and avoid presenting it as a guaranteed or calibrated probability.

### P1-6 — Fixture deduplication identity is too weak
`fixtureKey` currently uses only Brussels date + normalized home + normalized away. It omits competition identity and kickoff time. Rare same-day repeat fixtures, reserve/youth teams with ambiguous naming, or competitions sharing team labels can be incorrectly merged.
**Action:** use provider IDs first, then a normalized fingerprint containing competition identity, teams and kickoff window; retain a reviewable cross-provider match-link table rather than silently discarding ambiguous candidates.

### P1-7 — Team-name matching is inconsistent
OpenLigaDB/OpenFootball use accent-insensitive normalization, while open-matchday result mapping uses lowercased exact team names. Common suffixes, accents, abbreviations and aliases can make valid history/results look missing.
**Action:** centralize team normalization and introduce provider aliases/team IDs with conservative matching and an explicit “ambiguous match” state. Do not fuzzy-match into a wrong settlement.

### P1-8 — Source freshness and stale-data UX are incomplete
A failed refresh leaves the previous `fixtureScan` visible. The UI can show “SKAN GOTOWY” without clearly distinguishing a fresh scan from cached/stale results. Some feeds do not expose a file update timestamp, but the app still needs a separate retrieval timestamp.
**Action:** show last successful fetch, last attempted fetch, cache age, per-provider freshness and stale/degraded status. Keep source update time distinct from Moneyball retrieval time.

### P1-9 — Current scan is too chatty and expensive for each browser
The scan reads the open-matchday index plus many competition CSV files, 18 OpenFootball feed files and a dynamic set of OpenLigaDB league feeds. Forcing this every 15 minutes scales network traffic with every open browser.
**Action:** separate UI refresh from source refresh; use per-source TTLs based on source update cadence, request coalescing, conditional fetches, and a cached normalized daily snapshot served from the Worker. Keep the free-tier subrequest/CPU/request limits in view.
- Cloudflare Workers Free limits: https://developers.cloudflare.com/workers/platform/limits/

## 3. Persistence, security and release engineering

### P1-10 — Tracker storage is fragile at scale
- All history is stored as one JSON array in `localStorage`; every write serializes the whole collection.
- There is no explicit storage-quota handling, size indicator, pruning/archiving strategy or IndexedDB migration.
- Backup format is version 1 only; no migration path exists for future schemas.
- Import deduplicates by row ID only, so importing the same logical fixture/prediction from another browser can create duplicate semantic records.
- Delete is immediate, without confirmation or undo.
- **Action:** migrate the record store to IndexedDB with indexes and transactions; retain export/import compatibility through versioned migrations; add semantic dedupe, storage health, undo/confirm and backup reminders. Local storage is appropriate only for non-sensitive local data; treat all browser-stored data as untrusted.
- OWASP: https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html

### P1-11 — Worker CORS reflects arbitrary Origin
The OpenLigaDB proxy returns the request's `Origin` as `Access-Control-Allow-Origin` without checking an allowlist. It serves public data, so this is not a credential leak, but it makes the endpoint broadly readable cross-origin and increases abuse surface.
**Action:** allow only the production app origin (and explicitly configured preview origins if required), reject unsupported methods/paths, add bounded response sizes/timeouts and upstream 429/5xx backoff. CORS is not an authorization control.

### P1-12 — Dependency and CI reproducibility
- No committed lockfile is present in the branch tree.
- Two CI workflows install dependencies differently (Bun latest vs Node/npm install), and deployment also uses Bun latest.
- Neither workflow uses a frozen lockfile. Builds can resolve different dependency versions at different times.
- The workflows do not run lint, accessibility checks, coverage thresholds, dependency audit or end-to-end browser tests.
- **Action:** choose one package manager, commit its lockfile, pin the runtime/tool versions, use frozen installs, add lint/static analysis, dependency audit and one browser smoke suite. Keep deploy gated on the same validated artifact.

### P2-1 — PWA offline/update experience is minimal
The service worker caches the shell and static assets, and avoids caching API responses. There is no visible update-available flow, no offline-data download/retention policy, and no tested recovery path for a stale service worker.
- **Action:** add an explicit “new version available” prompt, last-updated indicator and documented cache reset/recovery. Keep dynamic football data clearly marked stale/offline.
- PWA guidance: https://web.dev/learn/pwa/assets-and-data
- Update guidance: https://web.dev/learn/pwa/update

## 4. UX and visual design audit

### Observed from source and live page
- The visual direction is coherent: dark navy panels, mint accent, strong dashboard hero and consistent card language.
- The typography is frequently very small (many 8–11px labels), especially source notes, Tracker rows and metadata. This is difficult on a phone.
- The dashboard's stage list is stale: it labels source discovery and prediction/coupon work as ACTIVE and final audit as IN PROGRESS, although the release acceptance document marks the implemented scope released. This undermines confidence.
- The hero says “MODEL VERIFIED”, although the model is not yet independently validated/calibrated.
- “Typ dnia” is visibly underfilled; “Kupony” does not show saved coupon history; Intelligence has only a small part of its intended scope.
- Match browsing has search only; it lacks country/competition/status/time filters, sorting and a proper match-detail view.
- Tracker has no detail drawer, type filters or robust delete confirmation. The search covers title/status, not the structured details.
- Keyboard focus styling is not consistently visible; some inputs suppress outlines. A mobile accessibility pass should check touch targets, contrast, screen-reader names and focus order.
- The live page was fetched successfully and its page content/metadata were inspected. A full interactive mobile browser pass could not be completed in this review environment, so no claim is made that all tabs were manually exercised on a real Android device.

### Recommended visual improvements
1. Replace “MODEL VERIFIED” with “MODEL UNDER VALIDATION” until a real out-of-sample audit supports stronger wording.
2. Redesign the dashboard around live operational facts: today's fixture count, source freshness, scan errors, pending settlements, predictions made before kickoff, verified sample size and last backup.
3. Make fixtures a compact table/list with competition badge, country, local kickoff, status, data coverage and one clear “Szczegóły” action.
4. Give every match a detail panel: team form, model inputs, missing inputs, 1X2/DC/goals, prediction timestamp, source provenance and model version.
5. Turn Typ dnia into a real ranked editorial page with reasons, risks and “brak wartościowego typu” state.
6. Turn Kupony into a saved-coupon workspace with three leg cards, progress, settlement and void handling.
7. Turn Intelligence into a real analytics area with time-series charts, calibration plot, league/model/source filters, baseline comparison and sample-size warnings.
8. Make Tracker a searchable ledger with filters, expandable details, safe delete/undo and backup health.
9. Increase body text and metadata sizes; reserve tiny mono labels for secondary metadata only. Add clear `:focus-visible` states and accessible button names.
10. Add loading skeletons, empty/error/stale states, retry actions and clear “last updated” times rather than generic loading text.

## 5. Recommended implementation order

| Priority | Work package | Why it comes first |
|---|---|---|
| P0 | OpenLigaDB compliant refresh/cache/backoff | Protect source access and stop avoidable repeated full-season downloads |
| P0 | Kickoff cutoff + prediction provenance | Prevent post-kickoff leakage into performance metrics |
| P0 | Explicit fixture/result lifecycle and void settlement | Prevent stuck or incorrect paper coupon outcomes |
| P1 | Fixture identity + team alias matching | Improve completeness and reduce wrong merges/missed results |
| P1 | Leak-safe historical backtest and baseline comparison | Establish whether probabilities deserve trust |
| P1 | IndexedDB Tracker, migrations, semantic import dedupe | Protect growing historical data |
| P1 | Complete Typ dnia, Kupony and Intelligence | Turn placeholders into actual product workflows |
| P1 | Shared cached daily fixture/result snapshot | Reduce per-user feed traffic and improve initial-load speed |
| P1 | Lockfile, pinned CI, lint, a11y and browser smoke | Make releases reproducible and test user-visible behavior |
| P2 | Visual redesign, richer match detail and charts | Improve usability after the underlying data is reliable |
| P2 | Optional account sync/notifications only if free and explicitly approved | Avoid premature infrastructure and hidden cost |

## 6. Acceptance gates for the next release
- No pre-match prediction can be recorded after kickoff in the pre-match model.
- Every result has source, retrieval timestamp, final-score verification and a typed lifecycle status.
- OpenLigaDB refreshes follow its published fair-use guidance; 429/5xx responses trigger backoff.
- Duplicate fixtures across providers are linked, not accidentally merged across competitions.
- Backtest uses strict chronological splits and reports baseline, sample count and calibration.
- Coupon settlement covers finished, postponed, abandoned, cancelled and void scenarios.
- Tracker survives reload, import/export, schema migration and simulated quota failure.
- All six tabs have complete empty/loading/error/success states.
- Mobile viewport, keyboard navigation and screen-reader smoke tests pass.
- CI uses one locked dependency graph and deploys only the artifact that passed validation.

## Scope note
This is a code/spec/live-page review, not a claim of exhaustive penetration testing, full browser interaction testing, or a statistical backtest against a verified historical dataset. Findings above are grounded in the reviewed branch and documented external source guidance; proposed improvements are recommendations, not implemented features.
