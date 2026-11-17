# MONEYBALL REBUILD — release acceptance

## Verified implementation
- [x] Isolated application branch `moneyball-rebuild`; production `main` remains outside this rebuild.
- [x] Mobile-first React/Vite PWA shell with six product areas.
- [x] Europe/Brussels date handling and daily fixture discovery from the configured public feeds.
- [x] Source-level fixture coverage counts, failure disclosure, fixture normalization and cross-feed deduplication.
- [x] Local Tracker with validated JSON backup/restore, CSV export and same-origin tab synchronization.
- [x] Prediction history with retry recovery after failed form enrichment.
- [x] 1X2 and derived Double Chance probability recording.
- [x] Exactly-three-leg paper coupons with distinct fixtures and configured probability threshold.
- [x] Idempotent result and coupon settlement; explicit final-score validation.
- [x] Intelligence metrics for 1X2 and a separate derived Double Chance market audit.
- [x] PWA shell caching isolated from API responses.
- [x] Cloudflare Worker OpenLigaDB proxy and automated handler regression tests.
- [x] CI typecheck, unit tests and production build.
- [x] Separate Cloudflare Worker deployment workflow.

## Verified release
- Branch: `moneyball-rebuild`
- Production Worker: https://moneyball-global-rebuild.damianwalus3.workers.dev/
- Latest release commit at acceptance: `c6387de113aab364c41787120bda5681649574ca`
- MONEYBALL rebuild CI: success (run 44169754456).
- Cloudflare deployment: success (run 44169754054).
- Additional rebuild checks: success (run 44169754338; final status to be confirmed after completion).
- Automated Worker tests cover API routing, URL encoding, cache/CORS headers, failed upstream handling and static asset pass-through.

## Explicit capability boundaries — not represented as complete
- The public fixture feeds do not prove exhaustive coverage of every European competition, regional tier, women's or youth competition.
- Team-form model is based on recent goals/results and Poisson probabilities; it is not an xG-trained model and does not ingest confirmed lineups or injuries.
- Double Chance probabilities are derived from 1X2, not an independently trained model.
- No bookmaker odds ingestion, odds-based EV, or real-money bet placement is implemented. Coupons are paper-only.
- Tracker is browser-local. It synchronizes same-origin tabs, not separate devices; no authenticated backend or account sync is configured.
- Web Push/background notifications are not configured.
- Physical Android browser/install/offline acceptance and authenticated end-to-end browser smoke tests have not been independently performed in this environment.

## Release decision
Automated CI and Cloudflare deployment are verified. The implemented local-first analytical/paper-tracking scope is released. The capability boundaries above remain explicit future work and must not be hidden behind a blanket claim of exhaustive European coverage or full production feature parity.
