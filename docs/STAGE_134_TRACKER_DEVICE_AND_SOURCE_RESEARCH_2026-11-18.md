# MONEYBALL GLOBAL REBUILT — Stage 134: Tracker device diagnostics and source/model review

Date: 2026-11-18
Scope: `moneyball-rebuild` only; isolated Cloudflare REBUILT Worker only. No MAIN, Vercel, TEST, Lovable, paid API, or paid credits.

## Tracker on-device integrity

The Tracker store is intentionally browser-local under `moneyball.local.tracker.v1`. GitHub Actions and the Cloudflare Worker cannot inspect a user's Android WebView/browser localStorage.

Added an on-device integrity panel to the Tracker tab. It reports, for the active Brussels scan date:
- total locally stored Tracker records;
- discovered fixture count;
- 1X2 record presence and missing count;
- valid 1X2 probability coverage and missing/invalid count;
- Double Chance record presence and missing count;
- valid Double Chance probability coverage and missing/invalid count.

The panel exposes an immediate JSON backup export. The backup remains local until the user chooses to share it. Import is additive and preserves existing IDs/records; no destructive migration or deletion was introduced.

This is a diagnostic affordance, not proof of the user's phone state until the panel is opened on that device. CI cannot remotely verify its output.

## Model quality and calibration gate

Reviewed `src/model-audit.ts` and the Intelligence UI:
- 1X2 is evaluated separately from Double Chance.
- 1X2 sample size counts distinct settled fixtures per model.
- Double Chance uses three binary outcomes per fixture (1X, X2, 12), while the qualification count is the number of distinct fixtures, not the number of binary events.
- The UI reports the configured minimum of 30 different settled fixtures per model and market; smaller samples are explicitly marked insufficient.

No new model accuracy or calibration claim is made in this stage. The 30-match threshold is a minimum eligibility gate, not a guarantee of statistical certainty. DC probabilities remain derived from the underlying 1X2 probabilities unless a separately trained DC model is introduced.

## European fixture source review

Reviewed the existing feed architecture and public source documentation:
- OpenMatchday publishes 2026/27 CSV for 75 competitions and refreshes daily, but states that coverage is uneven and its compilation is for informational/non-commercial use. It cannot be represented as a complete or commercial-grade Europe feed.
- OpenFootball Europe publishes public-domain text fixtures/results for selected European leagues. The current rebuild already discovers Europe catalogue paths and selected national repositories; it is useful as a supplement, not an exhaustive calendar.
- OpenFootball's separate Austria repository describes Bundesliga, Zweite Liga and Regionalliga datasets; the rebuild's existing national-repository discovery includes Austria, so this is not a wholly new provider.
- FootballAPI.org's public free tier is limited to Premier League; its broader 68-competition membership is paid. It does not solve broad free European coverage.
- No additional independently verifiable, free, broad-coverage European source with suitable terms was found in this review. Do not add a scraper or provider with unclear rights merely to inflate fixture counts.

Reference links:
- https://github.com/oladeeayo/open-matchday
- https://github.com/openfootball/europe
- https://github.com/openfootball/austria
- https://footballapi.org/

## Latest verified multi-source snapshot carried forward

The last completed source reconciliation for 2026-11-18 recorded 171 unique fixtures across 20 countries/federations and 63 competitions. All eight integrated source entry points were healthy at the time of that audit except one isolated OpenLigaDB timeout; duplicate canonical keys, wrong-date fixtures and non-European fixtures were zero. This is a multi-source snapshot, not proof of 100% European completeness.

## Validation

- Application change: Tracker integrity panel and one-click JSON backup export.
- Validation completed successfully on the final documentation head `42a899fc51faf0007aa87c406bf32714b10e0773`, which includes the Tracker code commit `40e12c39514fbc74047a3c6b1063e0000ba04b77`:
  - CI [44369076034](https://github.com/damianwalus3-jpg/moneyball-global/actions/runs/44369076034): PASS (TypeScript, tests, production build).
  - Rebuild Checks [44369075697](https://github.com/damianwalus3-jpg/moneyball-global/actions/runs/44369075697): PASS.
  - Cloudflare REBUILT deployment and live current-day European source reconciliation [44369075778](https://github.com/damianwalus3-jpg/moneyball-global/actions/runs/44369075778): PASS (all workflow steps successful, including deployment, smoke test and full reconciliation).
  - The application code commit was deployed by the successful final deployment workflow; the later head commit changes documentation only.
- After deployment, the remaining physical-device check is to open Tracker on Android, read the counts, export the JSON backup and share it for a real localStorage audit.
