# MONEYBALL — zero-cost local-first domain model

The initial application is deliberately local-first. It does not provision Supabase, PostgreSQL, D1, or another paid/hosted database. Tracker records are stored in browser storage and can be exported/imported as versioned JSON. Records do not sync between devices automatically.

## Core entities stored in the browser
- Scan run: requested Europe/Brussels date, source, retrieval time, coverage and errors.
- Fixture: provider/source identifier, competition, home/away teams, kickoff and observed status.
- Prediction: fixture, immutable model version, market, selection, probabilities, data coverage, rationale and missing inputs.
- Odds snapshot: bookmaker, market, selection, decimal odds, source timestamp.
- Coupon and legs: exact three unique fixtures, selection, odds snapshot, paper stake, potential return and settlement.
- Result: score, provider and verification time.
- Paper ledger transaction: stake/return/adjustment and idempotency key.
- Tracker category and Jackpot entry.

## Rules
- European domestic leagues only; daily scans use the Europe/Brussels calendar date.
- Never invent fixtures, results, xG, lineups, injuries, odds or probabilities.
- Every imported fact carries provider/source and retrieval timestamp.
- 1X2 probabilities must be finite, in [0,1], and sum to 1. Double Chance is separately displayed and derived transparently.
- Standard coupon: exactly three distinct fixtures. Odds must be > 1.00.
- Import is merge-only: only IDs not already present are added; existing local records are never overwritten.
- Browser-local data is not cloud synchronized. Users should export backups before clearing browser data or changing devices.

## Later optional expansion
If free resources become available and the user explicitly approves, the local data model can be synchronized through a free-tier backend. No backend is required to use the local Tracker.
