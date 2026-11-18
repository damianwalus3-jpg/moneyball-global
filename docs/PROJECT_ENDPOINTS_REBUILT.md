# MONEYBALL GLOBAL REBUILT — canonical project addresses

Last verified: 2026-11-18 (Europe/Brussels)

## Active project

- Application (production REBUILT): https://moneyball-global-rebuild.damianwalus3.workers.dev/
- Production health check: https://moneyball-global-rebuild.damianwalus3.workers.dev/api/health
- GitHub repository: https://github.com/damianwalus3-jpg/moneyball-global
- Active branch: `moneyball-rebuild`
- Branch URL: https://github.com/damianwalus3-jpg/moneyball-global/tree/moneyball-rebuild
- Deployment workflow: https://github.com/damianwalus3-jpg/moneyball-global/actions/workflows/deploy-rebuild-cloudflare.yml
- Execution log: https://github.com/damianwalus3-jpg/moneyball-global/blob/moneyball-rebuild/docs/REBUILD_EXECUTION_LOG.md

## Live data endpoints

- FootyNomad daily fixtures: `/api/footynomad/fixtures/YYYY-MM-DD` on the application host above.
- PitchAPI league catalogue: `/api/pitchapi/leagues` on the application host above.
- PitchAPI date feed: `/api/pitchapi/date/YYYY-MM-DD?status=all` on the application host above.

## Environment separation

Only the REBUILT application and `moneyball-rebuild` branch are in scope for current work. Do not substitute the older MAIN deployment at `https://moneyball-global.damianwalus3.workers.dev/`, do not merge REBUILT work into `main`, and do not use Vercel, TEST, or Lovable.

The application uses browser-local Tracker storage. Exported Tracker JSON remains on the user's device until the user explicitly shares it; the URLs above do not expose that local data.
