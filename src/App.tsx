import { useEffect, useMemo, useRef, useState } from "react";
import { canonicalFixtureId, scanTodayEuropeanFixtures, type FixtureScan, type FreeFixture } from "./free-fixtures";
import { buildApiFootballTrackerDetails, fetchApiFootballEnrichment, fetchApiFootballInjuriesForDate, fetchApiFootballOdds, parseApiFootballOdds, type ApiFootballFixtureEnrichment, type ApiFootballInjury } from "./api-football";
import { brusselsKickoffTimestamp, isConfirmedPitchApiLineups, isWithinLineupRefreshWindow } from "./lineup-refresh";
import { addRecord, addRecords, addRecordsIfMissing, exportBackup, exportCsv, importBackup, readRecords, type TrackerKind, type TrackerRecord } from "./tracker-store";
import { findOpenLigaFixtureResult, findOpenMatchdayResult, loadEspnRecentTeamForm, loadOpenLigaRecentTeamForm, loadRecentTeamForm, loadRecentTeamFormAcrossCountry, mergeVerifiedTeamForms, loadCalcioItSerieDTeamForm, type TeamForm } from "./team-form";
import { predictFromRecentForm, predictFromPitchApiXgForm, predictFromNeutralPrior, type FormPrediction } from "./form-prediction";
import { fetchPitchApiMatchLineups, fetchPitchApiXgFormsForFixture, type PitchApiLineups, type PitchApiXgForm } from "./pitchapi";
import { buildThreeLegCandidates } from "./coupon-engine";
import { findOpenFootballFixtureResult, loadOpenFootballRecentTeamForm } from "./openfootball";
import { buildPaperCouponSettlementRecord, evaluatePaperCoupon } from "./coupon-settlement";
import { uniquePendingPredictions } from "./pending-settlement";
import { auditTrackerPredictions } from "./model-audit";
import { describeHistoryProvenance, hasValidPredictionMarket, shouldAppendPrediction, shouldRetryPredictionWithEvidence, trackerFixtureIdentity } from "./prediction-record";
import { filterRecordsToCurrentScan } from "./current-scan-scope";
import { getSafestPick, hasKickoffPassed, hasKnownKickoff } from "./safest-pick";
import { getPredictionDisplayStatus, isEvidenceQualifiedCandidate } from "./prediction-eligibility";
import { auditOddsFixtureMatches } from "./odds-matching";
import { brusselsDateToday, getSelectedFixturePredictions } from "./selected-matches";
import { auditMarketCoverage } from "./market-coverage";
import { buildBetSettlementRows } from "./bet-settlement";
import { calculateBankroll, canReserveStake } from "./bankroll";
import { listFreshOddsSnapshots, listOddsBookmakers, shouldAutoFetchStrikerApi } from "./odds-value";
import { valueThreeLegCoupon } from "./coupon-value";
import { buildBaselineEvidenceAudit, getEvidenceGaps, isEvidenceAuditComplete } from "./analysis-evidence";
import { getSourceDiagnostics, summarizeFixtureCoverage } from "./source-diagnostics";
import {
  Activity, BarChart3, Bell, CalendarDays, ChevronRight, CircleDot,
  ClipboardList, Database, Gauge, LayoutDashboard, Menu, Plus, Search,
  ShieldCheck, Sparkles, Ticket, Trophy, X
} from "lucide-react";

const ODDS_PILOT_TOKEN_KEY = "moneyball.oddsPilotToken";
const STRIKER_DAILY_FETCH_KEY = "moneyball.strikerDailyFetchDate";
const STRIKER_DAILY_ATTEMPT_KEY = "moneyball.strikerDailyOddsAttemptDate";
const STRIKER_EXPLICIT_CONSENT_KEY = "moneyball.strikerApiExplicitConsent";
const ODDSPAPI_DAILY_ATTEMPT_KEY = "moneyball.oddspapiDailyOddsAttemptDate";
const API_FOOTBALL_ODDS_DAILY_ATTEMPT_KEY = "moneyball.apiFootballOddsDailyAttemptKey";
const FALLBACK_RETRY_KEY = "moneyball.neutralFallbackRetryAt";
const FALLBACK_RETRY_INTERVAL_MS = 6 * 60 * 60 * 1000;
const XG_RETRY_KEY = "moneyball.xgModelRetryAt";

function currentOddsSyncSlot(now = new Date()): "morning" | "afternoon" {
  const hour = Number(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Brussels", hour: "2-digit", hourCycle: "h23",
  }).format(now));
  return hour >= 15 ? "afternoon" : "morning";
}

function isStrikerExplicitlyEnabled(): boolean {
  try { return localStorage.getItem(STRIKER_EXPLICIT_CONSENT_KEY) === "true"; }
  catch { return false; }
}

function shouldRetryNeutralFallback(fixtureId: string, prior?: TrackerRecord): boolean {
  if (prior?.details.predictionMethod !== "neutral-prior-poisson") return false;
  try {
    const raw = localStorage.getItem(FALLBACK_RETRY_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    const attempts = parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown> : {};
    const lastAttempt = attempts[fixtureId];
    if (typeof lastAttempt === "number" && Number.isFinite(lastAttempt)
      && Date.now() - lastAttempt < FALLBACK_RETRY_INTERVAL_MS) return false;
    localStorage.setItem(FALLBACK_RETRY_KEY, JSON.stringify({ ...attempts, [fixtureId]: Date.now() }));
    return true;
  } catch { return false; }
}


function shouldRetryMissingXg(fixtureId: string): boolean {
  try {
    const raw = localStorage.getItem(XG_RETRY_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    const attempts = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
    const lastAttempt = attempts[fixtureId];
    if (typeof lastAttempt === "number" && Number.isFinite(lastAttempt) && Date.now() - lastAttempt < FALLBACK_RETRY_INTERVAL_MS) return false;
    localStorage.setItem(XG_RETRY_KEY, JSON.stringify({ ...attempts, [fixtureId]: Date.now() }));
    return true;
  } catch { return false; }
}


function shouldRetryIncompletePrediction(fixtureId: string, prior: TrackerRecord | undefined, market: "1X2" | "DOUBLE_CHANCE"): boolean {
  try {
    const key = "moneyball.incompletePredictionRetryAt";
    const raw = localStorage.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    const attempts = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
    const attemptKey = fixtureId + "|" + market;
    return shouldRetryPredictionWithEvidence(prior, market, attempts[attemptKey], Date.now(), FALLBACK_RETRY_INTERVAL_MS);
  } catch { return false; }
}

function markIncompletePredictionAttempt(fixtureId: string, market: "1X2" | "DOUBLE_CHANCE"): void {
  try {
    const key = "moneyball.incompletePredictionRetryAt";
    const raw = localStorage.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    const attempts = parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown> : {};
    localStorage.setItem(key, JSON.stringify({ ...attempts, [fixtureId + "|" + market]: Date.now() }));
  } catch { /* Storage failure must not block prediction generation. */ }
}

type Tab = "dashboard" | "matches" | "pick" | "coupons" | "intelligence" | "bets" | "tracker";

const nav: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "matches", label: "Mecze", icon: CalendarDays },
  { id: "pick", label: "Wytypowane mecze", icon: Sparkles },
  { id: "coupons", label: "Kupony", icon: Ticket },
  { id: "intelligence", label: "Intelligence", icon: BarChart3 },
  { id: "bets", label: "Stawki", icon: Ticket },
  { id: "tracker", label: "Tracker", icon: ClipboardList },
];

const descriptions: Record<Tab, { eyebrow: string; title: string; subtitle: string }> = {
  dashboard: { eyebrow: "CENTRUM DOWODZENIA", title: "Trust the Process.", subtitle: "Przejrzysta analityka. Zweryfikowane dane. Każda decyzja z uzasadnieniem." },
  matches: { eyebrow: "CENTRUM MECZÓW", title: "Mecze", subtitle: "Europejskie rozgrywki, forma drużyn i komplet danych źródłowych." },
  pick: { eyebrow: "WYTYPOWANE MECZE", title: "Mecze wybrane przez aplikację", subtitle: "Wybór modelu 1X2 i Double Chance, dokładne prawdopodobieństwo oraz krótkie uzasadnienie każdego meczu." },
  coupons: { eyebrow: "ZARZĄDZANIE KUPONAMI", title: "Kupony", subtitle: "Buduj, zapisuj i rozliczaj kupony analityczne. Bez obstawiania za prawdziwe pieniądze." },
  intelligence: { eyebrow: "ANALITYKA MODELU", title: "Intelligence", subtitle: "Skuteczność, kalibracja, jakość danych i wyniki według lig oraz rynków." },
  bets: { eyebrow: "REJESTR ZAKŁADÓW", title: "Stawki i wyniki", subtitle: "Wybrane i odrzucone typy, kursy, stawki oraz rzeczywisty bilans zysków i strat." },
  tracker: { eyebrow: "REJESTR GŁÓWNY", title: "Tracker", subtitle: "Jedno miejsce dla skanów, prognoz, kursów, kuponów, wyników i historii." },
};

function Metric({ label, value, note, icon: Icon, onClick }: { label: string; value: string; note: string; icon: typeof Activity; onClick: () => void }) {
  return <button type="button" className="metric-card metric-card-button" style={{ appearance: "none", textAlign: "left", width: "100%", cursor: "pointer", color: "inherit", font: "inherit" }} onClick={onClick} aria-label={`${label}: ${value}. Otwórz szczegóły`}><div className="metric-top"><span>{label}</span><Icon size={17} /></div><strong>{value}</strong><small>{note}</small><span className="metric-drilldown">Szczegóły <ChevronRight size={13}/></span></button>;
}

function DetailMetric({ label, value, detail, valueClass }: { label: string; value: string | number; detail: string; valueClass?: string }) {
  return <article className="detail-metric"><small>{label}</small><b className={valueClass}>{value}</b><details><summary>Szczegóły</summary><p>{detail}</p></details></article>;
}

function SourceDiagnostics({ scan }: { scan: FixtureScan }) {
  const sources = getSourceDiagnostics(scan);
  const coverage = summarizeFixtureCoverage(scan);
  return <section className="panel source-diagnostics">
    <div className="panel-heading"><div><h3>Audyt źródeł i pokrycia</h3><p>{scan.date} · {coverage.countries} krajów/federacji · {coverage.competitions} rozgrywek · {scan.fixtures.length} unikalnych meczów po scaleniu · poza zakresem odrzucono {scan.scopeAudit?.excludedOutOfScopeFixtures ?? 0}</p></div><Database size={18}/></div>
    <div className="tracker-table">
      <div className="tracker-head"><span>ŹRÓDŁO</span><span>SPRAWDZONE</span><span>SUROWE</span><span>PRZYJĘTE</span><span>STATUS</span></div>
      {sources.map(source => <div className="tracker-row" key={source.name}>
        <b>{source.name}</b><span>{source.checked}</span><span>{source.rawRecords ?? "N/D"}</span><span>{source.acceptedFixtures}</span>
        <span className={source.status === "ERROR" ? "scan-error" : source.status === "MECZE ZNALEZIONE" ? "status-positive" : "source-note"}>{source.status}</span>
        <small className="source-note" style={{ gridColumn: "1 / -1" }}>{source.catalogue} · przed zakresem: {source.preScopeFixtures ?? "N/D"} · {source.detail}{source.errors ? ` · błędy: ${source.errors}` : ""}</small>
      </div>)}
    </div>
    <p className="source-note">„Sprawdzone” oznacza wykonane zapytanie/katalog, „surowe” — tylko liczbę faktycznie udostępnioną przez adapter (N/D oznacza brak licznika), „przed zakresem” — rekordy po dacie/Europie przed filtrem pucharów i UEFA, a „przyjęte” — krajowe ligi europejskie po scaleniu. Kobiece, młodzieżowe i rezerwowe ligi pozostają w zakresie, jeśli źródło je udostępnia. Suma „przyjęte” nie jest liczbą unikalnych spotkań; źródła nie dowodzą pełnej kompletności.</p>
    <details><summary>Kraje/federacje z wykrytymi meczami</summary><p>{coverage.countryCodes.join(", ") || "Brak"}</p></details>
  </section>;
}

function savePredictionRecord(
  match: FreeFixture,
  prediction?: FormPrediction,
  reason?: string,
  homeForm?: TeamForm,
  awayForm?: TeamForm,
  pitchApiXgForms?: { home: PitchApiXgForm; away: PitchApiXgForm },
  pitchApiLineups?: PitchApiLineups,
  comparisonPredictions: FormPrediction[] = [],
  apiFootballFixture?: ApiFootballFixtureEnrichment,
  apiFootballInjuries?: ApiFootballInjury[],
): TrackerRecord[] {
  const evidenceAudit = buildBaselineEvidenceAudit();
  const xgReady = !!pitchApiXgForms && pitchApiXgForms.home.sampleSize >= 3 && pitchApiXgForms.away.sampleSize >= 3;
  if (xgReady) evidenceAudit.areas.xg_xga = { status: "VERIFIED", source: "PitchAPI", observedAt: new Date().toISOString(), note: "Średnie xG/xGA z co najmniej 3 zakończonych, wcześniejszych meczów każdej drużyny." };
  if (xgReady && pitchApiXgForms) {
    const shotsComplete = [pitchApiXgForms.home, pitchApiXgForms.away].every(form => form.shotsForPerMatch != null && form.shotsAgainstPerMatch != null
      && form.shotsOnTargetForPerMatch != null && form.shotsOnTargetAgainstPerMatch != null && form.bigChancesForPerMatch != null && form.bigChancesAgainstPerMatch != null);
    if (shotsComplete) evidenceAudit.areas.shots_and_chances = { status: "VERIFIED", source: "PitchAPI", observedAt: new Date().toISOString(), note: "Strzały, celne strzały i duże sytuacje z wcześniejszych zakończonych spotkań." };
    const tacticsComplete = [pitchApiXgForms.home, pitchApiXgForms.away].every(form => form.ppdaPerMatch != null && form.fieldTiltPerMatch != null && form.boxEntriesPerMatch != null);
    if (tacticsComplete) evidenceAudit.areas.tactics = { status: "VERIFIED", source: "PitchAPI advanced", observedAt: new Date().toISOString(), note: "PPDA, field tilt i wejścia w pole karne z wcześniejszych zakończonych spotkań." };
  }
  if (pitchApiLineups) {
    const confirmed = pitchApiLineups.home.confirmed === true && pitchApiLineups.away.confirmed === true
      && (pitchApiLineups.home.starters?.length ?? 0) === 11 && (pitchApiLineups.away.starters?.length ?? 0) === 11;
    evidenceAudit.areas.confirmed_lineups = { status: confirmed ? "VERIFIED" : "PARTIAL", source: "PitchAPI", observedAt: new Date().toISOString(), note: confirmed ? "Obie jedenastki confirmed=true." : "Skład przewidywany lub niekompletny." };
  }
  const apiLineups = apiFootballFixture?.lineups ?? [];
  const apiHomeId = apiFootballFixture?.teams?.home?.id;
  const apiAwayId = apiFootballFixture?.teams?.away?.id;
  const apiHomeLineup = apiLineups.find(row => row.team?.id === apiHomeId);
  const apiAwayLineup = apiLineups.find(row => row.team?.id === apiAwayId);
  const apiLineupsConfirmed = !!apiHomeLineup && !!apiAwayLineup
    && (apiHomeLineup.startXI?.length ?? 0) === 11 && (apiAwayLineup.startXI?.length ?? 0) === 11;
  if (apiFootballFixture && evidenceAudit.areas.confirmed_lineups.status !== "VERIFIED") {
    evidenceAudit.areas.confirmed_lineups = { status: apiLineupsConfirmed ? "VERIFIED" : "PARTIAL", source: "API-Football Pro", observedAt: new Date().toISOString(), note: apiLineupsConfirmed ? "Obie jedenastki zawierają po 11 zawodników." : "API-Football nie zwrócił dwóch kompletnych jedenastek." };
  }
  if (apiFootballInjuries !== undefined) {
    const injuryRows = apiFootballInjuries.filter(row => /injur|illness|injured/i.test(String(row.player?.reason ?? "") + " " + String(row.player?.type ?? "")));
    const suspensionRows = apiFootballInjuries.filter(row => /suspend|ban|card accumulation/i.test(String(row.player?.reason ?? "") + " " + String(row.player?.type ?? "")));
    evidenceAudit.areas.injuries = { status: injuryRows.length ? "VERIFIED" : "PARTIAL", source: "API-Football Pro", observedAt: new Date().toISOString(), note: injuryRows.length ? "Dostawca zwrócił " + injuryRows.length + " wpisów o kontuzjach/chorobach." : "Brak wpisów o kontuzjach; nie jest to potwierdzenie pełnego pokrycia ligi." };
    evidenceAudit.areas.suspensions = { status: suspensionRows.length ? "VERIFIED" : "PARTIAL", source: "API-Football Pro", observedAt: new Date().toISOString(), note: suspensionRows.length ? "Dostawca zwrócił " + suspensionRows.length + " wpisów o zawieszeniach." : "Brak wpisów o zawieszeniach; nie jest to potwierdzenie pełnego pokrycia ligi." };
  }
  evidenceAudit.assessedAt = new Date().toISOString();
  evidenceAudit.complete = isEvidenceAuditComplete(evidenceAudit);
  const variants = [prediction, ...comparisonPredictions].filter((item): item is FormPrediction => !!item);
  const uniqueVariants = [...new Map(variants.map(item => [item.method, item])).values()];
  if (!uniqueVariants.length) uniqueVariants.push(undefined as unknown as FormPrediction);
  const shared = {
    fixtureId: match.id, fixtureDate: match.date, fixtureTime: match.time,
    home: match.home, away: match.away, competition: match.competition, source: match.source,
    leagueFolder: match.leagueFolder ?? null, leagueShortcut: match.leagueShortcut ?? null,
    leagueSeason: match.leagueSeason ?? null, openFootballFeedId: match.openFootballFeedId ?? null,
    pitchApiXgHome: pitchApiXgForms?.home.xgForPerMatch ?? null,
    pitchApiXgHomeAgainst: pitchApiXgForms?.home.xgAgainstPerMatch ?? null,
    pitchApiXgAway: pitchApiXgForms?.away.xgForPerMatch ?? null,
    pitchApiXgAwayAgainst: pitchApiXgForms?.away.xgAgainstPerMatch ?? null,
    pitchApiXgHomeXgot: pitchApiXgForms?.home.xgOnTargetForPerMatch ?? null,
    pitchApiXgAwayXgot: pitchApiXgForms?.away.xgOnTargetForPerMatch ?? null,
    pitchApiHomeShotsOnTarget: pitchApiXgForms?.home.shotsOnTargetForPerMatch ?? null,
    pitchApiAwayShotsOnTarget: pitchApiXgForms?.away.shotsOnTargetForPerMatch ?? null,
    pitchApiHomeBigChances: pitchApiXgForms?.home.bigChancesForPerMatch ?? null,
    pitchApiAwayBigChances: pitchApiXgForms?.away.bigChancesForPerMatch ?? null,
    pitchApiHomePpda: pitchApiXgForms?.home.ppdaPerMatch ?? null,
    pitchApiAwayPpda: pitchApiXgForms?.away.ppdaPerMatch ?? null,
    pitchApiHomeFieldTilt: pitchApiXgForms?.home.fieldTiltPerMatch ?? null,
    pitchApiAwayFieldTilt: pitchApiXgForms?.away.fieldTiltPerMatch ?? null,
    pitchApiHomeBoxEntries: pitchApiXgForms?.home.boxEntriesPerMatch ?? null,
    pitchApiAwayBoxEntries: pitchApiXgForms?.away.boxEntriesPerMatch ?? null,
    pitchApiHomeXThreat: pitchApiXgForms?.home.xThreatPerMatch ?? null,
    pitchApiAwayXThreat: pitchApiXgForms?.away.xThreatPerMatch ?? null,
    pitchApiXgSamples: pitchApiXgForms ? JSON.stringify({ home: pitchApiXgForms.home.sampleSize, away: pitchApiXgForms.away.sampleSize, source: "PitchAPI" }) : null,
    pitchApiXgHistory: pitchApiXgForms ? JSON.stringify({ home: pitchApiXgForms.home.matches, away: pitchApiXgForms.away.matches }) : null,
    pitchApiLineups: pitchApiLineups ? JSON.stringify(pitchApiLineups) : null,
    ...buildApiFootballTrackerDetails(apiFootballFixture, apiFootballInjuries, false, new Date().toISOString()),
    apiFootballFixtureId: apiFootballFixture?.fixture?.id ?? (match.apiFootballFixtureId ? Number(match.apiFootballFixtureId) : null),
    historyProvenance: homeForm && awayForm ? JSON.stringify({
      home: { source: homeForm.source, sourceUpdatedAt: homeForm.sourceUpdatedAt, matches: homeForm.matches.length, homeMatches: homeForm.home.length, awayMatches: homeForm.away.length },
      away: { source: awayForm.source, sourceUpdatedAt: awayForm.sourceUpdatedAt, matches: awayForm.matches.length, homeMatches: awayForm.home.length, awayMatches: awayForm.away.length },
      cutoffDateExclusive: match.date,
    }) : null,
    evidenceComplete: evidenceAudit.complete, evidenceAudit: JSON.stringify(evidenceAudit),
    evidenceGaps: getEvidenceGaps(evidenceAudit).join(", "),
  };
  const current = readRecords();
  const pendingPredictionRecords: Array<Omit<TrackerRecord, "id" | "createdAt">> = [];
  for (const variant of uniqueVariants) {
    const method = variant?.method ?? "unavailable", model = "moneyball:" + method;
    const probabilities = variant?.prediction.probabilities, dc = variant?.prediction.doubleChance;
    const modelSampleQualified = method === "recent-form-goals-poisson"
      ? (homeForm?.matches.length ?? 0) >= 3 && (awayForm?.matches.length ?? 0) >= 3
      : method === "pitchapi-recent-xg-poisson"
        ? (pitchApiXgForms?.home.sampleSize ?? 0) >= 3 && (pitchApiXgForms?.away.sampleSize ?? 0) >= 3
        : false;
    const couponEligible = !!variant && method !== "neutral-prior-poisson" && modelSampleQualified
      && hasKnownKickoff(match.date, match.time);
    const topProbability = variant?.topProbability ?? null;
    const modelStrongCandidate = couponEligible && typeof topProbability === "number" && topProbability >= 0.75;
    const strongCandidate = modelStrongCandidate && evidenceAudit.complete;
    const dcOptions = [{ selection: "1X", probability: dc?.oneX ?? null }, { selection: "X2", probability: dc?.xTwo ?? null }, { selection: "12", probability: dc?.oneTwo ?? null }];
    const bestDc = dcOptions.filter(item => typeof item.probability === "number").sort((a, b) => (b.probability as number) - (a.probability as number))[0];
    const dcProbability = typeof bestDc?.probability === "number" ? bestDc.probability : null;
    const modelStrongDoubleChance = couponEligible && dcProbability !== null && dcProbability >= 0.75;
    const strongDoubleChance = modelStrongDoubleChance && evidenceAudit.complete;
    const evidenceRejectionReason = evidenceAudit.complete ? null : "ODRZUCONY: brak wymaganych danych: " + getEvidenceGaps(evidenceAudit).join(", ");
    const common = {
      ...shared, model, modelName: method, predictionMethod: variant?.method ?? null, modelMethod: variant?.method ?? null,
      expectedGoalsBasis: method === "pitchapi-recent-xg-poisson" ? "historyczne xG/xGA PitchAPI" : method === "recent-form-goals-poisson" ? "wyniki i gole historyczne (nie xG)" : "brak danych zespołów",
      lambdaProxyHome: variant?.prediction.expectedGoals.home ?? null, lambdaProxyAway: variant?.prediction.expectedGoals.away ?? null,
      sampleCounts: variant ? JSON.stringify(variant.samples) : null,
      historySampleCounts: JSON.stringify({ home: homeForm?.matches.length ?? 0, away: awayForm?.matches.length ?? 0, xgHome: pitchApiXgForms?.home.sampleSize ?? 0, xgAway: pitchApiXgForms?.away.sampleSize ?? 0 }),
      minimumTeamHistoryMatches: 3, couponEligible,
      reason: reason ?? (!couponEligible ? "ODRZUCONY: model wymaga co najmniej 3 wcześniejszych meczów dla obu drużyn oraz zweryfikowanej godziny rozpoczęcia." : evidenceRejectionReason ?? (topProbability === null ? "Brak prawidłowej prognozy 1X2." : topProbability < 0.75 ? "Najwyższe prawdopodobieństwo 1X2 poniżej 75%." : null)),
    };
    const oneXTwoDetails = {
      ...common,
      ...(method === (uniqueVariants[0]?.method ?? "unavailable")
        ? buildApiFootballTrackerDetails(apiFootballFixture, apiFootballInjuries, true, new Date().toISOString())
        : {}),
      market: "1X2", selection: variant?.pick ?? null,
      p1: probabilities?.home ?? null, px: probabilities?.draw ?? null, p2: probabilities?.away ?? null,
      dc1x: dc?.oneX ?? null, dcx2: dc?.xTwo ?? null, dc12: dc?.oneTwo ?? null,
      topProbability, modelStrongCandidate, strongCandidate, source: match.source };
    const hasOneXTwoProbabilities = !!probabilities
      && [probabilities.home, probabilities.draw, probabilities.away].every(value => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1)
      && Math.abs(probabilities.home + probabilities.draw + probabilities.away - 1) <= 0.0001;
    if (shouldAppendPrediction(current, match.id, model, hasOneXTwoProbabilities, method, "1X2", evidenceAudit.complete, shared.evidenceGaps)) {
      pendingPredictionRecords.push({ kind: "prediction", title: match.date + " · " + match.home + " vs " + match.away + " · 1X2 · " + method,
        status: strongCandidate ? "KANDYDAT" : "ODRZUCONY", details: oneXTwoDetails });
    }
    const dcDetails = { ...common, market: "DOUBLE_CHANCE", selection: bestDc?.selection ?? null, probability: dcProbability,
      p1x: dc?.oneX ?? null, px2: dc?.xTwo ?? null, p12: dc?.oneTwo ?? null,
      strongCandidate: false, modelStrongDoubleChance, strongDoubleChance, source: match.source,
      reason: reason ?? (!couponEligible ? "ODRZUCONY: brak minimalnej próbki lub wiarygodnej godziny meczu." : evidenceRejectionReason ?? (dcProbability === null ? "Brak prawidłowych prawdopodobieństw Double Chance." : dcProbability < 0.75 ? "Najwyższe prawdopodobieństwo Double Chance poniżej 75%." : null)) };
    const hasDcProbabilities = !!dc
      && [dc.oneX, dc.xTwo, dc.oneTwo].every(value => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1)
      && Math.abs(dc.oneX + dc.xTwo + dc.oneTwo - 2) <= 0.0001;
    if (shouldAppendPrediction(current, match.id, model, hasDcProbabilities, method, "DOUBLE_CHANCE", evidenceAudit.complete, shared.evidenceGaps)) {
      pendingPredictionRecords.push({ kind: "prediction", title: match.date + " · " + match.home + " vs " + match.away + " · DOUBLE CHANCE · " + method,
        status: strongDoubleChance ? "KANDYDAT" : "ODRZUCONY", details: dcDetails });
    }
  }
  addRecords(pendingPredictionRecords);
  return readRecords();
}
export default function App() {
  const [active, setActive] = useState<Tab>("dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [records, setRecords] = useState<TrackerRecord[]>(() => readRecords());
  const [newTitle, setNewTitle] = useState("");
  const [betInputs, setBetInputs] = useState<Record<string, { market: string; odds: string; stake: string }>>({});
  const [newKind, setNewKind] = useState<TrackerKind>("match");
  const [notice, setNotice] = useState("");
  const [oddsPilotToken, setOddsPilotToken] = useState(() => { try { return localStorage.getItem(ODDS_PILOT_TOKEN_KEY) ?? ""; } catch { return ""; } });
  const [oddsTokenSaved, setOddsTokenSaved] = useState(() => { try { return Boolean(localStorage.getItem(ODDS_PILOT_TOKEN_KEY)); } catch { return false; } });
  const [lastOddsFetchDate, setLastOddsFetchDate] = useState(() => { try { return localStorage.getItem(STRIKER_DAILY_FETCH_KEY) ?? ""; } catch { return ""; } });
  const [lastOddsAttemptDate, setLastOddsAttemptDate] = useState(() => { try { return localStorage.getItem(STRIKER_DAILY_ATTEMPT_KEY) ?? ""; } catch { return ""; } });
  const [lastOddsPapiAttemptKey, setLastOddsPapiAttemptDate] = useState(() => { try { return localStorage.getItem(ODDSPAPI_DAILY_ATTEMPT_KEY) ?? ""; } catch { return ""; } });
  const [lastApiFootballOddsAttemptKey, setLastApiFootballOddsAttemptKey] = useState(() => { try { return localStorage.getItem(API_FOOTBALL_ODDS_DAILY_ATTEMPT_KEY) ?? ""; } catch { return ""; } });
  const [apiFootballOddsLoading, setApiFootballOddsLoading] = useState(false);
  const [apiFootballOddsNotice, setApiFootballOddsNotice] = useState("");
  const [oddsProviderStatus, setOddsProviderStatus] = useState<{ apiFootball: boolean; strikerapi: boolean; oddspapi: boolean; pilotEnabled: boolean; oddspapiAccount?: { status?: string; requestLimit?: number; requestCount?: number; remaining?: number; bookmakerSlugs?: string[] } | null } | null>(null);
  const [oddsLoading, setOddsLoading] = useState(false);
  const [oddsNotice, setOddsNotice] = useState("");
  const [oddsAudit, setOddsAudit] = useState<{ matched: number; unmatched: number; ambiguous: number; snapshots: number; utcDate: string } | null>(null);
  const [selectedOddsBookmaker, setSelectedOddsBookmaker] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [fixtureScan, setFixtureScan] = useState<FixtureScan | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [settling, setSettling] = useState(false);
  const settlementLock = useRef(false);
  const bulkAnalysisLock = useRef(false);
  const lineupRefreshAttempts = useRef<Record<string, number>>({});
  const lineupRefreshInFlight = useRef(new Set<string>());
  const lineupConfirmedFixtures = useRef(new Set<string>());
  const [settleProgress, setSettleProgress] = useState(0);
  const [scanError, setScanError] = useState("");
  const [teamForms, setTeamForms] = useState<Record<string, { home?: TeamForm; away?: TeamForm; pitchApiXgForms?: { home: PitchApiXgForm; away: PitchApiXgForm }; pitchApiLineups?: PitchApiLineups; apiFootballFixture?: ApiFootballFixtureEnrichment; apiFootballInjuries?: ApiFootballInjury[]; prediction?: FormPrediction; predictionError?: string; loading: boolean; error?: string }>>({});
  const loadFixtureForms = async (match: NonNullable<typeof fixtureScan>["fixtures"][number], apiFootballFixture?: ApiFootballFixtureEnrichment, apiFootballInjuries?: ApiFootballInjury[]) => {
    if (!hasKnownKickoff(match.date, match.time)) {
      const reason = "ODRZUCONY: brak zweryfikowanej godziny rozpoczęcia. Nie tworzymy prognozy przedmeczowej bez potwierdzonego czasu.";
      const fallback = predictFromNeutralPrior();
      setTeamForms(current => ({ ...current, [match.id]: { prediction: fallback, loading: false, error: reason } }));
      setRecords(savePredictionRecord(match, fallback, reason));
      return;
    }
    if (hasKickoffPassed(match.date, match.time)) {
      const reason = "ODRZUCONY: mecz już się rozpoczął lub zakończył. Nie zapisujemy prognoz jako przedmeczowych.";
      setTeamForms(current => ({ ...current, [match.id]: { loading: false, error: reason } }));
      setRecords(savePredictionRecord(match, undefined, reason));
      return;
    }
    setTeamForms(current => ({ ...current, [match.id]: { ...current[match.id], loading: true, error: undefined } }));
    const load = async (team: string): Promise<TeamForm> => {
      const failures: string[] = [];
      const attempts: Array<{ name: string; run: () => Promise<TeamForm> }> = [];
      if (match.leagueFolder && /^[A-Z]{3}_[0-9]+_[a-z0-9-]+$/.test(match.leagueFolder)) {
        attempts.push({ name: "open-matchday · liga meczu", run: () => loadRecentTeamForm(match.leagueFolder, team, match.date) });
      }
      if (match.leagueShortcut && match.leagueSeason) attempts.push({ name: "OpenLigaDB", run: () => loadOpenLigaRecentTeamForm(match.leagueShortcut!, match.leagueSeason!, team, match.date) });
      if (match.openFootballFeedId) attempts.push({ name: "OpenFootball", run: () => loadOpenFootballRecentTeamForm(match.openFootballFeedId!, team, match.date) });
      if (match.countryCode === "ITA" && /Serie D|Coppa Italia Serie D/i.test(match.competition)) attempts.push({ name: "calcio.it · włoska Serie D (grupy A–I)", run: () => loadCalcioItSerieDTeamForm(team, match.date) });
      if (/^[A-Z]{3}$/.test(match.countryCode) && match.countryCode !== "UEFA") {
        attempts.push({ name: "open-matchday · historia krajowa", run: () => loadRecentTeamFormAcrossCountry(match.countryCode, team, match.date) });
      }
      attempts.push({ name: "ESPN", run: () => loadEspnRecentTeamForm(team, match.date) });
      const settled = await Promise.allSettled(attempts.map(item => item.run()));
      const accepted: TeamForm[] = [];
      settled.forEach((result, index) => {
        if (result.status === "fulfilled") {
          const form = result.value;
          const valid = form.matches.filter(row => row.date < match.date && Number.isInteger(row.goalsFor) && Number.isInteger(row.goalsAgainst) && row.goalsFor >= 0 && row.goalsAgainst >= 0);
          accepted.push({ ...form, matches: valid });
          if (!valid.length) failures.push(attempts[index].name + ": brak poprawnych wcześniejszych wyników");
        } else failures.push(attempts[index].name + ": " + (result.reason instanceof Error ? result.reason.message : "błąd źródła"));
      });
      const merged = mergeVerifiedTeamForms(accepted, team);
      if (merged.matches.length < 3) throw new Error(failures.concat("Po scaleniu źródeł tylko " + merged.matches.length + "/3 unikalnych, zgodnych wyników").join(" · "));
      return merged;
    };
    const [historyResult, xgResult, lineupResult] = await Promise.allSettled([
      Promise.all([load(match.home), load(match.away)]),
      match.pitchApiLeagueId && match.pitchApiHomeTeamId && match.pitchApiAwayTeamId
        ? fetchPitchApiXgFormsForFixture({ leagueId: match.pitchApiLeagueId, season: match.pitchApiSeason, homeTeamId: match.pitchApiHomeTeamId, awayTeamId: match.pitchApiAwayTeamId, beforeDate: match.date })
        : Promise.reject(new Error("Brak identyfikatorów meczu PitchAPI — analiza xG niedostępna dla tego spotkania.")),
      match.pitchApiMatchId
        ? fetchPitchApiMatchLineups(match.pitchApiMatchId)
        : Promise.reject(new Error("Brak identyfikatora meczu PitchAPI — składy niedostępne.")),
    ]);
    const homeForm = historyResult.status === "fulfilled" ? historyResult.value[0] : undefined;
    const awayForm = historyResult.status === "fulfilled" ? historyResult.value[1] : undefined;
    const pitchApiXgForms = xgResult.status === "fulfilled" ? xgResult.value : undefined;
    const pitchApiLineups = lineupResult.status === "fulfilled" ? lineupResult.value : undefined;
    let goalsPrediction: FormPrediction | undefined;
    let xgPrediction: FormPrediction | undefined;
    const errors: string[] = [];
    if (pitchApiXgForms && pitchApiXgForms.home.sampleSize >= 3 && pitchApiXgForms.away.sampleSize >= 3) {
      try { xgPrediction = predictFromPitchApiXgForm(pitchApiXgForms.home, pitchApiXgForms.away); }
      catch (error) { errors.push(error instanceof Error ? error.message : "Błąd modelu xG"); }
    } else if (xgResult.status === "rejected") {
      errors.push(xgResult.reason instanceof Error ? xgResult.reason.message : "PitchAPI xG niedostępne");
    } else if (pitchApiXgForms) {
      errors.push("PitchAPI xG: za mało wcześniejszych meczów z kompletnymi statystykami (home " + pitchApiXgForms.home.sampleSize + "/3, away " + pitchApiXgForms.away.sampleSize + "/3).");
    }
    if (homeForm && awayForm) {
      try { goalsPrediction = predictFromRecentForm(homeForm, awayForm); }
      catch (error) { errors.push(error instanceof Error ? error.message : "Błąd bazowego modelu goli"); }
    }
    if (historyResult.status === "rejected") errors.push(historyResult.reason instanceof Error ? historyResult.reason.message : "Historia wyników niedostępna");
    const prediction = xgPrediction ?? goalsPrediction ?? predictFromNeutralPrior();
    const comparisonPredictions = [goalsPrediction, xgPrediction].filter((item): item is FormPrediction => !!item);
    const predictionError = prediction ? undefined : errors.join(" · ") || "Brak wystarczających danych do prognozy.";
    setTeamForms(current => ({ ...current, [match.id]: { home: homeForm, away: awayForm, pitchApiXgForms, pitchApiLineups, apiFootballFixture, apiFootballInjuries, prediction, predictionError, loading: false } }));
    setRecords(savePredictionRecord(match, prediction, predictionError, homeForm, awayForm, pitchApiXgForms, pitchApiLineups, comparisonPredictions, apiFootballFixture, apiFootballInjuries));
  };
  const analyzeAllFixtures = async (fixtures?: FreeFixture[]) => {
    const sourceMatches = fixtures ?? fixtureScan?.fixtures;
    if (!sourceMatches || bulkAnalysisLock.current || (!fixtures && scanLoading)) return;
    const currentRecords = readRecords();
    const latestByFixtureMarket = new Map<string, TrackerRecord>();
    for (const row of [...currentRecords].filter(item => item.kind === "prediction" && typeof item.details.fixtureId === "string")
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))) {
      const market = row.details.market === "DOUBLE_CHANCE" ? "DOUBLE_CHANCE" : "1X2";
      const key = String(row.details.fixtureId) + "|" + market;
      if (!latestByFixtureMarket.has(key)) latestByFixtureMarket.set(key, row);
    }
    const retryMarketByFixture = new Map<string, { oneXTwo: boolean; doubleChance: boolean }>();
    const matches = [...new Map(sourceMatches.map(match => [match.id, match])).values()].filter(match => {
      if (hasKickoffPassed(match.date, match.time)) return false;
      const prior = latestByFixtureMarket.get(match.id + "|1X2");
      const priorDc = latestByFixtureMarket.get(match.id + "|DOUBLE_CHANCE");
      const retryOneXTwo = shouldRetryIncompletePrediction(match.id, prior, "1X2");
      const retryDoubleChance = shouldRetryIncompletePrediction(match.id, priorDc, "DOUBLE_CHANCE");
      retryMarketByFixture.set(match.id, { oneXTwo: retryOneXTwo, doubleChance: retryDoubleChance });
      const missingProbabilities = retryOneXTwo || retryDoubleChance;
      const xgModel = "moneyball:pitchapi-recent-xg-poisson";
      const xgModelComplete = hasValidPredictionMarket(currentRecords, match.id, "1X2", xgModel)
        && hasValidPredictionMarket(currentRecords, match.id, "DOUBLE_CHANCE", xgModel);
      const missingXgModel = !!(match.pitchApiLeagueId && match.pitchApiHomeTeamId && match.pitchApiAwayTeamId)
        && !xgModelComplete && shouldRetryMissingXg(match.id);
      // Cooldown is committed only after the analysis has actually run, never when queued.
      return missingProbabilities || shouldRetryNeutralFallback(match.id, prior) || missingXgModel;
    });
    if (!matches.length) { setRecords(readRecords()); return; }
    bulkAnalysisLock.current = true;
    setBulkLoading(true);
    setBulkProgress(0);
    const apiFootballById = new Map<string, ApiFootballFixtureEnrichment>();
    const injuriesByFixture = new Map<string, ApiFootballInjury[]>();
    let apiFootballInjuriesLoaded = false;
    const apiFixtureIds = [...new Set(matches.map(match => match.apiFootballFixtureId).filter((id): id is string => typeof id === "string" && /^\d{1,12}$/.test(id)))];
    if (apiFixtureIds.length) {
      try {
        const enriched = await fetchApiFootballEnrichment(apiFixtureIds);
        for (const [id, fixture] of enriched) apiFootballById.set(id, fixture);
      } catch (error) {
        setNotice("API-Football Pro · wzbogacenie meczów: " + (error instanceof Error ? error.message : "brak danych") + ". Pozostałe źródła analizy działają dalej.");
      }
    }
    const targetDate = matches[0]?.date;
    if (targetDate) {
      try {
        const injuryRows = await fetchApiFootballInjuriesForDate(targetDate);
        apiFootballInjuriesLoaded = true;
        for (const row of injuryRows) {
          const id = row.fixture?.id;
          if (typeof id !== "number") continue;
          const list = injuriesByFixture.get(String(id)) ?? [];
          list.push(row);
          injuriesByFixture.set(String(id), list);
        }
      } catch (error) {
        setNotice("API-Football Pro · kontuzje/zawieszenia: " + (error instanceof Error ? error.message : "brak danych") + ". Nie oznaczam braków jako zweryfikowanych.");
      }
    }
    const concurrency = 2;
    try {
      for (let index = 0; index < matches.length; index += concurrency) {
        const batch = matches.slice(index, index + concurrency);
        await Promise.all(batch.map(async match => {
          const apiId = match.apiFootballFixtureId;
          await loadFixtureForms(match, apiId ? apiFootballById.get(apiId) : undefined, apiId && apiFootballInjuriesLoaded ? injuriesByFixture.get(apiId) ?? [] : undefined);
          const retry = retryMarketByFixture.get(match.id);
          if (retry?.oneXTwo) markIncompletePredictionAttempt(match.id, "1X2");
          if (retry?.doubleChance) markIncompletePredictionAttempt(match.id, "DOUBLE_CHANCE");
        }));
        setBulkProgress(Math.min(index + batch.length, matches.length));
      }
    } finally {
      bulkAnalysisLock.current = false;
      setBulkLoading(false);
      setRecords(readRecords());
    }
  };
  const settlePendingResults = async () => {
    if (settlementLock.current) return;
    settlementLock.current = true;
    const all = readRecords();
    const pending = uniquePendingPredictions(all);
    setSettling(true);
    setSettleProgress(0);
    let processed = 0;
    try {
      for (let index = 0; index < pending.length; index += 4) {
        const batch = pending.slice(index, index + 4);
        await Promise.all(batch.map(async prediction => {
          const d = prediction.details;
          if (typeof d.fixtureDate !== "string" || typeof d.home !== "string" || typeof d.away !== "string") return;
          try {
            let result = null;
            if (typeof d.leagueFolder === "string" && d.leagueFolder) {
              try { result = await findOpenMatchdayResult(d.leagueFolder, d.home, d.away, d.fixtureDate); } catch { /* try next provider */ }
            }
            if (!result && typeof d.leagueShortcut === "string" && typeof d.leagueSeason === "string") {
              try { result = await findOpenLigaFixtureResult(d.leagueShortcut, d.leagueSeason, d.home, d.away, d.fixtureDate); } catch { /* try next provider */ }
            }
            if (!result && typeof d.openFootballFeedId === "string") {
              try { result = await findOpenFootballFixtureResult(d.openFootballFeedId, d.home, d.away, d.fixtureDate); } catch { /* provider may not have published a score */ }
            }
            if (result) addRecordsIfMissing([{
              kind: "result",
              title: `${prediction.title} · ${result.homeGoals}:${result.awayGoals}`,
              status: "SETTLED",
              details: { fixtureId: d.fixtureId as string, actual: result.actual, homeGoals: result.homeGoals, awayGoals: result.awayGoals, date: result.date, source: result.source },
            }], "fixtureId");
          } catch { /* provider failures remain pending and are retried on next run */ }
        }));
        processed = Math.min(index + batch.length, pending.length);
        setSettleProgress(processed);
      }
    } finally {
      const latest = readRecords();
      const coupons = latest.filter(row => row.kind === "coupon" && ["PAPER_NO_ODDS", "PAPER_WITH_ODDS"].includes(row.status)
        && !latest.some(item => item.kind === "coupon" && item.details.parentCouponId === row.id));
      const settlementRows = coupons.flatMap(coupon => {
        const settlement = evaluatePaperCoupon(coupon, latest);
        return settlement ? [buildPaperCouponSettlementRecord(coupon, settlement)] : [];
      });
      addRecordsIfMissing(settlementRows, "parentCouponId");
      addRecordsIfMissing(buildBetSettlementRows(latest), "parentBetId");
      setSettling(false);
      settlementLock.current = false;
      setRecords(readRecords());
    }
  };
  const refreshUpcomingLineups = async () => {
    const scan = fixtureScan;
    if (!scan) return;
    const now = Date.now();
    const recordsNow = readRecords();
    const due = scan.fixtures
      .filter(match => !!match.pitchApiMatchId && hasKnownKickoff(match.date, match.time)
        && isWithinLineupRefreshWindow(match.date, match.time, now))
      .filter(match => {
        if (lineupConfirmedFixtures.current.has(match.id) || lineupRefreshInFlight.current.has(match.id)) return false;
        const confirmedSnapshot = recordsNow.find(row => row.kind === "match"
          && row.status === "LINEUP_CONFIRMED" && row.details.fixtureId === match.id
          && row.details.fixtureDate === match.date);
        if (confirmedSnapshot) {
          lineupConfirmedFixtures.current.add(match.id);
          return false;
        }
        return now - (lineupRefreshAttempts.current[match.id] ?? 0) >= 5 * 60 * 1000;
      })
      .sort((a, b) => {
        const kickoffA = brusselsKickoffTimestamp(a.date, a.time) ?? Number.MAX_SAFE_INTEGER;
        const kickoffB = brusselsKickoffTimestamp(b.date, b.time) ?? Number.MAX_SAFE_INTEGER;
        return kickoffA - kickoffB;
      })
      .slice(0, 6);

    for (let index = 0; index < due.length; index += 2) {
      await Promise.all(due.slice(index, index + 2).map(async match => {
        if (lineupRefreshInFlight.current.has(match.id)) return;
        lineupRefreshInFlight.current.add(match.id);
        lineupRefreshAttempts.current[match.id] = Date.now();
        try {
          const lineups = await fetchPitchApiMatchLineups(match.pitchApiMatchId!);
          const confirmed = isConfirmedPitchApiLineups(lineups);
          const observedAt = new Date().toISOString();
          const status = confirmed ? "LINEUP_CONFIRMED" : "LINEUP_PENDING";
          const snapshotKey = match.id + "|" + status;
          addRecordsIfMissing([{
            kind: "match",
            title: match.date + " · " + match.home + " vs " + match.away + " · kontrola składów",
            status,
            details: {
              lineupSnapshotKey: snapshotKey,
              fixtureId: match.id,
              fixtureDate: match.date,
              fixtureTime: match.time,
              pitchApiMatchId: match.pitchApiMatchId!,
              observedAt,
              homeConfirmed: lineups.home.confirmed,
              awayConfirmed: lineups.away.confirmed,
              homeStarterCount: lineups.home.starters?.length ?? 0,
              awayStarterCount: lineups.away.starters?.length ?? 0,
              minutesToKickoff: Math.max(0, Math.round(((brusselsKickoffTimestamp(match.date, match.time) ?? Date.now()) - Date.now()) / 60_000)),
              lineupsJson: JSON.stringify(lineups),
              source: "PitchAPI",
            },
          }], "lineupSnapshotKey");
          if (confirmed) lineupConfirmedFixtures.current.add(match.id);
          setTeamForms(current => ({
            ...current,
            [match.id]: { ...current[match.id], pitchApiLineups: lineups, loading: current[match.id]?.loading ?? false },
          }));
          setRecords(readRecords());
        } catch (error) {
          const snapshotKey = match.id + "|LINEUP_ERROR";
          addRecordsIfMissing([{
            kind: "match",
            title: match.date + " · " + match.home + " vs " + match.away + " · błąd kontroli składów",
            status: "LINEUP_ERROR",
            details: {
              lineupSnapshotKey: snapshotKey,
              fixtureId: match.id,
              fixtureDate: match.date,
              fixtureTime: match.time,
              pitchApiMatchId: match.pitchApiMatchId!,
              observedAt: new Date().toISOString(),
              error: error instanceof Error ? error.message : "Nieznany błąd źródła składów",
              source: "PitchAPI",
            },
          }], "lineupSnapshotKey");
          setRecords(readRecords());
        } finally {
          lineupRefreshInFlight.current.delete(match.id);
        }
      }));
    }
  };
  const runFixtureScan = async (force = false) => {
    setScanLoading(true); setScanError("");
    try {
      const scan = await scanTodayEuropeanFixtures(force);
      setFixtureScan(scan);
      addRecordsIfMissing(scan.fixtures.map(match => ({
        kind: "match" as const,
        title: `${match.home} vs ${match.away}`,
        status: "SCHEDULED",
        details: { fixtureId: match.id, date: match.date, time: match.time, competition: match.competition, source: match.source, sourceUpdatedAt: match.sourceUpdatedAt ?? null, sourceUrl: match.sourceUrl ?? null },
      })), "fixtureId");
      // Every fixture in today's European list receives both market rows. A match
      // already in play/finished is explicitly rejected as a pre-match prediction.
      for (const match of scan.fixtures) {
        if (hasKickoffPassed(match.date, match.time)) {
          savePredictionRecord(match, undefined, "ODRZUCONY: mecz już się rozpoczął lub zakończył — brak prognozy przedmeczowej.");
        }
      }
      const scanKey = [scan.date, scan.source, scan.fixtures.length, scan.leaguesChecked, JSON.stringify(scan.coverage), scan.leaguesFailed.join("|")].join("::");
      addRecordsIfMissing([{
        kind: "scan",
        title: `Skan europejski ${scan.date}`,
        status: scan.leaguesFailed.length ? "WITH_WARNINGS" : "OK",
        details: {
          scanKey,
          fixtures: scan.fixtures.length,
          catalogueEntries: scan.leaguesChecked,
          errors: scan.leaguesFailed.length,
          failedSources: scan.leaguesFailed.join(" | "),
          openMatchdayFixtures: scan.coverage.openMatchday.fixtures,
          openLigaDBFixtures: scan.coverage.openLigaDB.fixtures,
          openFootballFixtures: scan.coverage.openFootball.fixtures,
          espnFixtures: scan.coverage.espn.fixtures,
          footyNomadPagesChecked: scan.coverage.footyNomad.pagesChecked,
          footyNomadPageMatches: scan.coverage.footyNomad.pageMatches,
          footyNomadFixtures: scan.coverage.footyNomad.fixtures,
          footyNomadSkippedNoTimestamp: scan.coverage.footyNomad.skippedNoTimestamp,
          footyNomadErrors: scan.coverage.footyNomad.errors,
          sourceCoverageJson: JSON.stringify(scan.coverage),
          source: scan.source,
        },
      }], "scanKey");
      setRecords(readRecords());
      // Automatically analyze every newly discovered fixture after each successful scan.
      // Existing predictions with complete 1X2 probabilities are not fetched again.
      void analyzeAllFixtures(scan.fixtures);
    } catch (error) { setScanError(error instanceof Error ? error.message : "Nie udało się pobrać terminarza."); }
    finally { setScanLoading(false); }
  };
  const saveOddsPilotToken = () => {
    const token = oddsPilotToken.trim();
    if (token.length < 32) {
      setOddsNotice("Token powinien mieć co najmniej 32 znaki. Ustaw ten sam sekret ODDS_PILOT_TOKEN w Cloudflare Worker.");
      setOddsTokenSaved(false);
      return;
    }
    try {
      localStorage.setItem(ODDS_PILOT_TOKEN_KEY, token);
      setOddsPilotToken(token);
      setOddsTokenSaved(true);
      setOddsNotice("Token zapisany lokalnie w tej przeglądarce. Nie jest dodawany do Trackera ani wysyłany do repozytorium.");
    } catch {
      setOddsTokenSaved(false);
      setOddsNotice("Przeglądarka nie pozwoliła zapisać tokenu lokalnie.");
    }
  };
  const clearOddsPilotToken = () => {
    try { localStorage.removeItem(ODDS_PILOT_TOKEN_KEY); } catch { /* storage may be unavailable */ }
    setOddsPilotToken("");
    setOddsTokenSaved(false);
    setOddsNotice("Lokalny token został usunięty z tej przeglądarki.");
  };
  const fetchDailyOdds = async () => {
    if (!fixtureScan) {
      setOddsNotice("Najpierw uruchom skan dzisiejszych meczów.");
      return;
    }
    const token = oddsPilotToken.trim();
    if (!oddsTokenSaved || token.length < 32) {
      setOddsNotice("Najpierw zapisz token dostępu. Musi być identyczny z sekretem ODDS_PILOT_TOKEN w Cloudflare.");
      return;
    }
    // Provider attempts are tracked separately: a completed StrikerAPI request must not suppress
    // the first OddsPapi request (and vice versa) for the same Brussels date.
    let strikerPending = shouldAutoFetchStrikerApi({
      fixtureDate: fixtureScan.date,
      tokenSaved: oddsTokenSaved,
      providerReady: oddsProviderStatus?.strikerapi === true,
      explicitConsent: isStrikerExplicitlyEnabled(),
      lastSuccessfulDate: lastOddsFetchDate,
      lastAttemptedDate: lastOddsAttemptDate,
    });
    const oddspapiSlot = currentOddsSyncSlot();
    const oddspapiAttemptKey = fixtureScan.date + "|" + oddspapiSlot;
    let oddspapiPending = oddsProviderStatus?.oddspapi === true
      && lastOddsPapiAttemptKey !== oddspapiAttemptKey;
    let strikerAttemptedDate = "";
    let oddspapiAttemptedKey = "";
    try { strikerAttemptedDate = localStorage.getItem(STRIKER_DAILY_ATTEMPT_KEY) ?? ""; } catch { /* storage may be unavailable */ }
    try { oddspapiAttemptedKey = localStorage.getItem(ODDSPAPI_DAILY_ATTEMPT_KEY) ?? ""; } catch { /* storage may be unavailable */ }
    if (strikerAttemptedDate === fixtureScan.date) strikerPending = false;
    if (oddspapiAttemptedKey === oddspapiAttemptKey) oddspapiPending = false;
    if (!strikerPending && !oddspapiPending) {
      setOddsNotice(`Dzisiejsze próby dostawców kursów dla ${fixtureScan.date} zostały już wykonane.`);
      return;
    }
    if (strikerPending) {
      try { localStorage.setItem(STRIKER_DAILY_ATTEMPT_KEY, fixtureScan.date); } catch { /* best-effort persistence */ }
      setLastOddsAttemptDate(fixtureScan.date);
    }
    if (oddspapiPending) {
      try { localStorage.setItem(ODDSPAPI_DAILY_ATTEMPT_KEY, fixtureScan.date); } catch { /* best-effort persistence */ }
      setLastOddsPapiAttemptDate(fixtureScan.date);
    }
    setOddsLoading(true);
    setOddsNotice("");
    let oddspapiSummary = "";
    let oddspapiAudit = {
      matched: 0,
      unmatched: fixtureScan.fixtures.length,
      ambiguous: 0,
      snapshots: 0,
      utcDate: fixtureScan.date,
    };
    try {
      const utcDate = fixtureScan.date;
      // OddsPapi is a separate price layer. Missing quotes never remove a fixture or its 1X2/DC prediction.
      if (oddspapiPending) {
        try {
          const oddspapiResponse = await fetch("/api/odds/oddspapi/daily", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              date: utcDate,
              slot: oddspapiSlot,
              allowBillableMarketCatalogue: true,
              fixtures: fixtureScan.fixtures.map(fixture => ({
                id: fixture.id, date: fixture.date, time: fixture.time,
                home: fixture.home, away: fixture.away,
              })),
            }),
          });
          const oddspapiPayload = await oddspapiResponse.json() as {
            status?: string; error?: string; message?: string; matched?: number; unmatched?: number; ambiguous?: number;
            marketCatalogStatus?: string; marketTypes?: string[]; estimatedRequestsUsed?: number;
            oddsRequestBatches?: number; slotRequestBudget?: number; skippedTournamentIds?: number[];
            quotes?: Array<{
              fixtureId: string; providerFixtureId: string; market: "1X2" | "DOUBLE_CHANCE";
              bookmaker: string; bookmakerSlug: string;
              odds1: number | null; oddsX: number | null; odds2: number | null;
              odds1x: number | null; oddsX2: number | null; odds12: number | null;
              complete1X2: boolean; completeDoubleChance: boolean;
              capturedAt: string | null; timestampBasis: string; bookmakerIsActive: boolean;
              suspended: boolean; marketActive: boolean; fixturePath: string | null;
              kickoffDifferenceMinutes: number;
            }>;
            remaining?: number;
          };
          oddspapiAudit = {
            matched: oddspapiPayload.matched ?? 0,
            unmatched: oddspapiPayload.unmatched ?? fixtureScan.fixtures.length,
            ambiguous: oddspapiPayload.ambiguous ?? 0,
            snapshots: 0,
            utcDate,
          };
          if (!oddspapiResponse.ok) throw new Error(oddspapiPayload.message || oddspapiPayload.error || `OddsPapi HTTP ${oddspapiResponse.status}`);
          if (oddspapiPayload.status === "ok") {
            const fixtureById = new Map(fixtureScan.fixtures.map(fixture => [fixture.id, fixture]));
            const oddspapiSnapshots = (oddspapiPayload.quotes ?? []).flatMap(quote => {
              const fixture = fixtureById.get(quote.fixtureId);
              if (!fixture || hasKickoffPassed(fixture.date, fixture.time)) return [];
              const capturedAt = quote.capturedAt ?? "";
              const timestampVerified = quote.timestampBasis === "price_changed_at" && !!capturedAt;
              const marketComplete = quote.market === "1X2" ? quote.complete1X2 : quote.completeDoubleChance;
              const marketPrices = quote.market === "1X2"
                ? [quote.odds1, quote.oddsX, quote.odds2]
                : [quote.odds1x, quote.oddsX2, quote.odds12];
              const complete = marketComplete && timestampVerified
                && marketPrices.every(value => typeof value === "number" && Number.isFinite(value) && value > 1);
              const status = complete ? `COMPLETE_${quote.market}`
                : marketComplete ? "UNVERIFIED_TIMESTAMP" : `INCOMPLETE_${quote.market}`;
              const snapshotKey = [fixture.id, "OddsPapi", quote.bookmakerSlug, quote.market, capturedAt || "NO_TIMESTAMP"].join("|");
              return [{
                kind: "odds" as const,
                title: `${fixture.home} vs ${fixture.away} · ${quote.bookmaker} · OddsPapi · ${quote.market}`,
                status,
                details: {
                  snapshotKey, fixtureId: fixture.id, fixtureDate: fixture.date, fixtureTime: fixture.time,
                  home: fixture.home, away: fixture.away, competition: fixture.competition, provider: "OddsPapi", providerGameId: quote.providerFixtureId,
                  bookmaker: quote.bookmaker, bookmakerSlug: quote.bookmakerSlug, market: quote.market,
                  odds1: quote.odds1, oddsX: quote.oddsX, odds2: quote.odds2,
                  odds1x: quote.odds1x, oddsX2: quote.oddsX2, odds12: quote.odds12,
                  complete1X2: quote.market === "1X2" && complete,
                  completeDoubleChance: quote.market === "DOUBLE_CHANCE" && complete,
                  capturedAt, timestampBasis: quote.timestampBasis,
                  bookmakerIsActive: quote.bookmakerIsActive, suspended: quote.suspended,
                  marketActive: quote.marketActive, fixturePath: quote.fixturePath,
                  kickoffDifferenceMinutes: quote.kickoffDifferenceMinutes, utcDate,
                },
              }];
            });
            const addedOddsPapi = addRecordsIfMissing(oddspapiSnapshots, "snapshotKey");
            oddspapiAudit = { ...oddspapiAudit, snapshots: addedOddsPapi };
            oddspapiSummary = `OddsPapi: dopasowano ${oddspapiPayload.matched ?? 0}, snapshoty ${addedOddsPapi}, rynki ${(oddspapiPayload.marketTypes ?? ["1X2"]).join("/")}, katalog ${oddspapiPayload.marketCatalogStatus ?? "nieznany"}, niejednoznaczne ${oddspapiPayload.ambiguous ?? 0}, zapytania ${oddspapiPayload.estimatedRequestsUsed ?? "—"}/${oddspapiPayload.slotRequestBudget ?? "—"}, pominięte rozgrywki z limitu ${oddspapiPayload.skippedTournamentIds?.length ?? 0}.`;
            setRecords(readRecords());
          } else {
            oddspapiSummary = `OddsPapi: ${oddspapiPayload.message || oddspapiPayload.status || "brak kwotowań"}.`;
          }
        } catch (error) {
          oddspapiSummary = "OddsPapi: " + (error instanceof Error ? error.message : "błąd dostawcy") + ". Prognozy pozostają bez zmian.";
        }
      }
      if (!strikerPending) {
        setRecords(readRecords());
        setOddsNotice(oddspapiSummary || "OddsPapi: brak nowych kwotowań. Prognozy i rekordy 1X2/DC pozostają zapisane.");
        setOddsAudit(oddspapiAudit);
        return;
      }
      const response = await fetch(`/api/odds/pilot?strikerDate=${encodeURIComponent(utcDate)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json() as {
        error?: string;
        message?: string;
        results?: { strikerapi?: {
          status?: string;
          error?: string;
          capturedAt?: string;
          games?: Array<{
            gameId: string;
            startsAt: string;
            home: string;
            away: string;
            bookmakers?: Array<{
              name: string | null;
              source: string | null;
              capturedAt: string | null;
              odds1: number | null;
              oddsX: number | null;
              odds2: number | null;
              homeHandicapOpen?: number | null;
              homeHandicapClose?: number | null;
              handicapHomeOdds?: number | null;
              handicapAwayOdds?: number | null;
              totalOpen?: number | null;
              totalClose?: number | null;
              overOdds?: number | null;
              underOdds?: number | null;
              complete1X2: boolean;
            }>;
          }>;
        } };
      };
      if (!response.ok) throw new Error(payload.message || payload.error || `Worker HTTP ${response.status}`);
      const striker = payload.results?.strikerapi;
      if (!striker || striker.status !== "ok") throw new Error(striker?.error || "StrikerAPI nie zwrócił poprawnych danych.");
      const games = (striker.games ?? []).filter(game =>
        typeof game.gameId === "string" && typeof game.startsAt === "string"
        && typeof game.home === "string" && typeof game.away === "string"
      );
      if (games.length === 0) {
        throw new Error(`StrikerAPI przyjęło żądanie, ale nie zwróciło żadnych meczów dla daty UTC ${utcDate}. Dzisiejsza próba pozostaje zablokowana, aby nie zużyć kolejnych kredytów.`);
      }
      const audit = auditOddsFixtureMatches(fixtureScan.fixtures, games);
      const fixtureById = new Map(fixtureScan.fixtures.map(fixture => [fixture.id, fixture]));
      const gameById = new Map(games.map(game => [game.gameId, game]));
      const snapshots = audit.matched.flatMap(match => {
        const fixture = fixtureById.get(match.fixtureId);
        const game = gameById.get(match.gameId);
        if (!fixture || !game || hasKickoffPassed(fixture.date, fixture.time)) return [];
        return (game.bookmakers ?? []).flatMap(book => {
          if (!book.name) return [];
          const capturedAt = book.capturedAt || striker.capturedAt || ""; // Missing provider timestamps must never be replaced with the local clock.
          const snapshotKey = [fixture.id, "StrikerAPI", book.name, capturedAt].join("|");
          return [{
            kind: "odds" as const,
            title: `${fixture.home} vs ${fixture.away} · ${book.name}`,
            status: !book.complete1X2 ? "INCOMPLETE_1X2" : capturedAt ? "COMPLETE_1X2" : "UNVERIFIED_TIMESTAMP",
            details: {
              snapshotKey,
              fixtureId: fixture.id,
              fixtureDate: fixture.date,
              fixtureTime: fixture.time,
              home: fixture.home,
              away: fixture.away,
              competition: fixture.competition,
              provider: "StrikerAPI",
              providerGameId: game.gameId,
              bookmaker: book.name,
              market: "1X2",
              odds1: book.odds1,
              oddsX: book.oddsX,
              odds2: book.odds2,
              homeHandicapOpen: book.homeHandicapOpen ?? null,
              homeHandicapClose: book.homeHandicapClose ?? null,
              handicapHomeOdds: book.handicapHomeOdds ?? null,
              handicapAwayOdds: book.handicapAwayOdds ?? null,
              totalOpen: book.totalOpen ?? null,
              totalClose: book.totalClose ?? null,
              overOdds: book.overOdds ?? null,
              underOdds: book.underOdds ?? null,
              complete1X2: book.complete1X2,
              capturedAt,
              providerSource: book.source,
              utcDate,
              kickoffDifferenceMinutes: match.kickoffDifferenceMinutes,
            },
          }];
        });
      });
      const added = addRecordsIfMissing(snapshots, "snapshotKey");
      try { localStorage.setItem(STRIKER_DAILY_FETCH_KEY, utcDate); } catch { /* quota guard is best-effort */ }
      setLastOddsFetchDate(utcDate);
      setRecords(readRecords());
      setOddsAudit({
        matched: audit.matched.length,
        unmatched: audit.unmatchedFixtureIds.length,
        ambiguous: audit.ambiguousFixtureIds.length,
        snapshots: added,
        utcDate,
      });
      setOddsNotice([`StrikerAPI: pobrano ${games.length} meczów, dopasowano ${audit.matched.length}, nowe snapshoty ${added}.`, oddspapiSummary].filter(Boolean).join(" "));
    } catch (error) {
      setOddsNotice(error instanceof Error ? error.message : "Nie udało się pobrać dziennych kursów.");
    } finally {
      setOddsLoading(false);
    }
  };
  useEffect(() => {
    void runFixtureScan();
    void settlePendingResults();
    const refreshId = window.setInterval(() => {
      void runFixtureScan(true);
      void settlePendingResults();
    }, 15 * 60 * 1000);
    return () => window.clearInterval(refreshId);
  }, []);
  useEffect(() => {
    if (!fixtureScan) return;
    void refreshUpcomingLineups();
    const lineupRefreshId = window.setInterval(() => void refreshUpcomingLineups(), 60 * 1000);
    return () => window.clearInterval(lineupRefreshId);
  }, [fixtureScan]);
  const fetchApiFootballDailyOdds = async () => {
    if (!fixtureScan || apiFootballOddsLoading) return;
    const uniqueIds = [...new Set(fixtureScan.fixtures
      .map(fixture => fixture.apiFootballFixtureId)
      .filter((id): id is string => typeof id === "string" && /^\d{1,12}$/.test(id)))];
    if (!uniqueIds.length) {
      setApiFootballOddsNotice("API-Football Pro: brak dopasowanych identyfikatorów meczów do pobrania kursów.");
      return;
    }
    const attemptKey = fixtureScan.date + "|" + currentOddsSyncSlot();
    if (lastApiFootballOddsAttemptKey === attemptKey) return;
    let savedAttempt = "";
    try { savedAttempt = localStorage.getItem(API_FOOTBALL_ODDS_DAILY_ATTEMPT_KEY) ?? ""; } catch { /* storage may be unavailable */ }
    if (savedAttempt === attemptKey) {
      setLastApiFootballOddsAttemptKey(attemptKey);
      return;
    }
    try { localStorage.setItem(API_FOOTBALL_ODDS_DAILY_ATTEMPT_KEY, attemptKey); } catch { /* best-effort persistence */ }
    setLastApiFootballOddsAttemptKey(attemptKey);
    setApiFootballOddsLoading(true);
    try {
      const requestedIds = uniqueIds.slice(0, 20);
      const payload = await fetchApiFootballOdds(fixtureScan.date, requestedIds);
      const quotes = parseApiFootballOdds((payload.odds ?? []).flatMap(row => row.data ?? []));
      const fixtureByApiId = new Map(fixtureScan.fixtures
        .filter(fixture => typeof fixture.apiFootballFixtureId === "string")
        .map(fixture => [String(fixture.apiFootballFixtureId), fixture]));
      const snapshots = quotes.flatMap(quote => {
        const fixture = fixtureByApiId.get(quote.fixtureId);
        if (!fixture || hasKickoffPassed(fixture.date, fixture.time)) return [];
        const capturedAt = quote.capturedAt ?? "";
        const timestampVerified = quote.timestampBasis === "provider_update_at" && !!capturedAt;
        const marketComplete = quote.market === "1X2" ? quote.complete1X2 : quote.completeDoubleChance;
        const prices = quote.market === "1X2"
          ? [quote.odds1, quote.oddsX, quote.odds2]
          : [quote.odds1x, quote.oddsX2, quote.odds12];
        const complete = marketComplete && timestampVerified
          && prices.every(value => typeof value === "number" && Number.isFinite(value) && value > 1);
        const status = complete ? `COMPLETE_${quote.market}`
          : marketComplete ? "UNVERIFIED_TIMESTAMP" : `INCOMPLETE_${quote.market}`;
        const snapshotKey = [fixture.id, "API-Football Pro", quote.bookmakerSlug, quote.market, capturedAt || "NO_TIMESTAMP"].join("|");
        return [{
          kind: "odds" as const,
          title: `${fixture.home} vs ${fixture.away} · ${quote.bookmaker} · API-Football Pro · ${quote.market}`,
          status,
          details: {
            snapshotKey, fixtureId: fixture.id, fixtureDate: fixture.date, fixtureTime: fixture.time,
            home: fixture.home, away: fixture.away, competition: fixture.competition,
            provider: "API-Football Pro", providerGameId: quote.fixtureId,
            bookmaker: quote.bookmaker, bookmakerSlug: quote.bookmakerSlug, market: quote.market,
            odds1: quote.odds1, oddsX: quote.oddsX, odds2: quote.odds2,
            odds1x: quote.odds1x, oddsX2: quote.oddsX2, odds12: quote.odds12,
            complete1X2: quote.market === "1X2" && complete,
            completeDoubleChance: quote.market === "DOUBLE_CHANCE" && complete,
            capturedAt, timestampBasis: quote.timestampBasis,
            fixturePath: null, kickoffDifferenceMinutes: 0, utcDate: fixtureScan.date,
          },
        }];
      });
      const added = addRecordsIfMissing(snapshots, "snapshotKey");
      const quotedFixtureIds = new Set(quotes.map(quote => quote.fixtureId));
      const missingQuoteCount = requestedIds.filter(id => !quotedFixtureIds.has(id)).length;
      const matchedFixtures = new Set(snapshots.map(row => String(row.details.fixtureId))).size;
      setRecords(readRecords());
      setOddsAudit({
        matched: matchedFixtures,
        unmatched: Math.max(0, requestedIds.length - matchedFixtures),
        ambiguous: 0, snapshots: added, utcDate: fixtureScan.date,
      });
      setApiFootballOddsNotice(`API-Football Pro: ${requestedIds.length} identyfikatorów, ${quotes.length} kwotowań, ${added} nowych snapshotów 1X2/DC; pominięte identyfikatory ponad limit 20: ${Math.max(0, uniqueIds.length - requestedIds.length)}; mecze bez kwotowań: ${missingQuoteCount}; błędy dostawcy: ${(payload.failedFixtureIds ?? []).length}.`);
    } catch (error) {
      setApiFootballOddsNotice("API-Football Pro: " + (error instanceof Error ? error.message : "brak kursów") + ". Pozostałe dane i prognozy pozostają bez zmian.");
    } finally {
      setApiFootballOddsLoading(false);
    }
  };

  useEffect(() => {
    if (!fixtureScan) return;
    const apiFootballIds = fixtureScan.fixtures.filter(fixture =>
      typeof fixture.apiFootballFixtureId === "string" && /^\d{1,12}$/.test(fixture.apiFootballFixtureId)
    );
    if (!apiFootballIds.length || lastApiFootballOddsAttemptKey === fixtureScan.date + "|" + currentOddsSyncSlot()) return;
    void fetchApiFootballDailyOdds();
  }, [fixtureScan, lastApiFootballOddsAttemptKey]);

  useEffect(() => {
    if (!fixtureScan || !oddsTokenSaved || oddsProviderStatus?.pilotEnabled !== true) return;
    const strikerPending = shouldAutoFetchStrikerApi({
      fixtureDate: fixtureScan.date,
      tokenSaved: oddsTokenSaved,
      providerReady: oddsProviderStatus.strikerapi === true,
      explicitConsent: isStrikerExplicitlyEnabled(),
      lastSuccessfulDate: lastOddsFetchDate,
      lastAttemptedDate: lastOddsAttemptDate,
    });
    const oddspapiPending = oddsProviderStatus.oddspapi === true
      && lastOddsPapiAttemptKey !== fixtureScan.date + "|" + currentOddsSyncSlot();
    if (strikerPending || oddspapiPending) void fetchDailyOdds();
  }, [fixtureScan, oddsTokenSaved, oddsProviderStatus, lastOddsFetchDate, lastOddsAttemptDate, lastOddsPapiAttemptKey]);
  useEffect(() => {
    let active = true;
    void fetch("/api/odds/status").then(async response => {
      if (!response.ok) throw new Error("odds_status_unavailable");
      return response.json() as Promise<{ providers?: { apiFootball?: boolean; strikerapi?: boolean; oddspapi?: boolean }; pilotEnabled?: boolean; oddspapiAccount?: { status?: string; requestLimit?: number; requestCount?: number; remaining?: number; bookmakerSlugs?: string[] } | null }>;
    }).then(payload => {
      if (active) setOddsProviderStatus({ apiFootball: payload.providers?.apiFootball === true, strikerapi: payload.providers?.strikerapi === true, oddspapi: payload.providers?.oddspapi === true, pilotEnabled: payload.pilotEnabled === true, oddspapiAccount: payload.oddspapiAccount ?? null });
    }).catch(() => {
      if (active) setOddsProviderStatus({ apiFootball: false, strikerapi: false, oddspapi: false, pilotEnabled: false, oddspapiAccount: null });
    });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    const syncTracker = () => setRecords(readRecords());
    window.addEventListener("storage", syncTracker);
    window.addEventListener("moneyball:tracker-updated", syncTracker);
    return () => {
      window.removeEventListener("storage", syncTracker);
      window.removeEventListener("moneyball:tracker-updated", syncTracker);
    };
  }, []);
  const fileRef = useRef<HTMLInputElement>(null);
  const modelAudit = useMemo(() => auditTrackerPredictions(records), [records]);
  const bankroll = useMemo(() => calculateBankroll(records), [records]);
  const eligibleFixtureIds = useMemo(
    () => new Set(fixtureScan?.fixtures.map(match => match.id) ?? []),
    [fixtureScan],
  );
  const currentScanRecords = useMemo(
    () => filterRecordsToCurrentScan(records, eligibleFixtureIds),
    [records, eligibleFixtureIds],
  );
  const predictionDiagnostics = useMemo(() => {
    const coverageDate = fixtureScan?.date ?? new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Brussels", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    const latestByFixtureMarketModel = new Map<string, TrackerRecord>();
    for (const row of [...currentScanRecords].filter(item => item.kind === "prediction" && item.details.fixtureDate === coverageDate)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))) {
      const fixtureId = trackerFixtureIdentity(row);
      if (!fixtureId) continue;
      const market = row.details.market === "DOUBLE_CHANCE" ? "DOUBLE_CHANCE" : "1X2";
      const model = typeof row.details.model === "string" ? row.details.model : "legacy";
      const key = fixtureId + "|" + market + "|" + model;
      if (!latestByFixtureMarketModel.has(key)) latestByFixtureMarketModel.set(key, row);
    }
    const latestRows = [...latestByFixtureMarketModel.values()];
    const oneXTwo = latestRows.filter(row => row.details.market !== "DOUBLE_CHANCE");
    const doubleChance = latestRows.filter(row => row.details.market === "DOUBLE_CHANCE");
    const coverage = auditMarketCoverage(currentScanRecords, coverageDate);
    const candidates = new Set<string>(), dcCandidates = new Set<string>();
    const withProbabilities = new Set<string>(), withDcProbabilities = new Set<string>();
    for (const row of oneXTwo) {
      const id = trackerFixtureIdentity(row);
      if (!id) continue;
      if (isEvidenceQualifiedCandidate(row, "1X2")) candidates.add(id);
      if (hasValidPredictionMarket(currentScanRecords, id, "1X2")) withProbabilities.add(id);
    }
    for (const row of doubleChance) {
      const id = trackerFixtureIdentity(row);
      if (!id) continue;
      if (isEvidenceQualifiedCandidate(row, "DOUBLE_CHANCE")) dcCandidates.add(id);
      if (hasValidPredictionMarket(currentScanRecords, id, "DOUBLE_CHANCE")) withDcProbabilities.add(id);
    }
    const latestPerFixture = new Map<string, TrackerRecord>();
    for (const row of oneXTwo.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))) {
      const id = trackerFixtureIdentity(row);
      if (id && !latestPerFixture.has(id)) latestPerFixture.set(id, row);
    }
    const rejected = [...latestPerFixture.entries()].filter(([id]) => !candidates.has(id)).map(([, row]) => row);
    const reasons = new Map<string, number>();
    for (const row of rejected) { const reason = String(row.details.reason ?? "Nie zapisano konkretnego powodu"); reasons.set(reason, (reasons.get(reason) ?? 0) + 1); }
    return { total: coverage.fixtureCount, rejected: Math.max(rejected.length, coverage.fixtureCount - candidates.size),
      candidates: candidates.size, dcCandidates: dcCandidates.size,
      withoutProbabilities: Math.max(0, coverage.fixtureCount - withProbabilities.size),
      withoutDcProbabilities: Math.max(0, coverage.fixtureCount - withDcProbabilities.size),
      missing1X2: coverage.missingOneXTwo.length, missingDC: coverage.missingDoubleChance.length,
      reasons: [...reasons.entries()].sort((a, b) => b[1] - a[1]),
      oneXTwoRecords: oneXTwo.length, doubleChanceRecords: doubleChance.length };
  }, [currentScanRecords, fixtureScan?.date]);
  const activeFixtureDate = fixtureScan?.date ?? brusselsDateToday();
  const safestPick = useMemo(() => getSafestPick(currentScanRecords, 0.75, activeFixtureDate), [currentScanRecords, activeFixtureDate]);
  const visibleRecords = useMemo(() => records.filter(row => (active === "tracker" ? true : row.kind === (active === "matches" ? "match" : active === "coupons" ? "coupon" : active === "pick" ? "prediction" : "scan")) && (row.title.toLowerCase().includes(query.toLowerCase()) || row.status.toLowerCase().includes(query.toLowerCase()))), [records, active, query]);
  const refreshRecords = () => setRecords(readRecords());
  const betInputFor = (prediction: TrackerRecord) => betInputs[String(prediction.details.fixtureId)] ?? {
    market: typeof prediction.details.selection === "string" ? prediction.details.selection : "1",
    odds: "",
    stake: "5",
  };
  const recordBetDecision = (prediction: TrackerRecord, decision: "SELECTED" | "REJECTED") => {
    const fixtureId = String(prediction.details.fixtureId ?? "");
    const input = betInputFor(prediction);
    const odds = Number(input.odds);
    const stake = decision === "SELECTED" ? Number(input.stake) : 0;
    if (!fixtureId || !input.market || !Number.isFinite(odds) || odds <= 1) {
      setNotice("Wpisz prawidłowy kurs dziesiętny większy niż 1.00.");
      return;
    }
    if (decision === "SELECTED" && (!Number.isFinite(stake) || stake <= 0)) {
      setNotice("Dla wybranego zakładu wpisz stawkę większą od zera.");
      return;
    }
    if (decision === "SELECTED" && !canReserveStake(readRecords(), stake)) {
      const balance = calculateBankroll(readRecords()).availableBalance;
      setNotice(`Brak wystarczającego salda w wirtualnym bankrollu. Dostępne: €${balance.toFixed(2)}; wymagana stawka: €${stake.toFixed(2)}. Zmniejsz stawkę lub poczekaj na rozliczenie otwartych typów.`);
      return;
    }
    const prior = records.find(row => row.kind === "bet" && row.details.fixtureId === fixtureId && row.details.decision === decision);
    if (prior) {
      setNotice("Ten typ ma już zapisany taki wpis. Nie dodaję duplikatu.");
      return;
    }
    addRecord({
      kind: "bet",
      title: prediction.title,
      status: decision === "SELECTED" ? "OPEN" : "ODRZUCONY",
      details: {
        fixtureId,
        decision,
        market: input.market,
        odds,
        stake,
        potentialReturn: decision === "SELECTED" ? stake * odds : 0,
        potentialProfit: decision === "SELECTED" ? stake * (odds - 1) : 0,
        selection: input.market,
        modelProbability: (() => { const key = input.market === "1" ? "p1" : input.market === "X" ? "px" : input.market === "2" ? "p2" : input.market === "1X" ? "dc1x" : input.market === "X2" ? "dcx2" : "dc12"; const value = prediction.details[key]; return typeof value === "number" ? value : null; })(),
        rejectionReason: decision === "REJECTED" ? (prediction.status === "ODRZUCONY" ? String(prediction.details.reason ?? "Odrzucony przez model.") : "Odrzucony ręcznie przez użytkownika.") : null,
        competition: prediction.details.competition ?? null,
      },
    });
    setRecords(readRecords());
    setNotice(decision === "SELECTED" ? "Zapisano wybrany zakład. Wynik i P/L zostaną rozliczone po potwierdzeniu rezultatu meczu." : "Zapisano odrzucony typ do statystyk porównawczych.");
  };
  const saveRecord = () => { if (!newTitle.trim()) return; addRecord({ kind: newKind, title: newTitle.trim(), status: "draft", details: {} }); setNewTitle(""); refreshRecords(); setNotice("Zapisano lokalnie na tym urządzeniu."); };
  const downloadBackup = () => { const blob = new Blob([JSON.stringify(exportBackup(), null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "moneyball-backup.json"; a.click(); URL.revokeObjectURL(url); };
  const downloadCsv = () => { const blob = new Blob(["\uFEFF", exportCsv()], { type: "text/csv;charset=utf-8" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "moneyball-tracker.csv"; a.click(); URL.revokeObjectURL(url); };
  const loadBackup = async (file?: File) => { if (!file) return; try { const imported = importBackup(JSON.parse(await file.text())); refreshRecords(); setNotice(`Zaimportowano ${imported} nowych rekordów. Istniejące dane zachowano.`); } catch (error) { setNotice(error instanceof Error ? error.message : "Błąd importu kopii."); } if (fileRef.current) fileRef.current.value = ""; };
  const current = descriptions[active];

  const changeTab = (tab: Tab) => { setActive(tab); setMobileOpen(false); };

  return <div className="app-shell">
    <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
      <div className="brand"><div className="brand-mark"><Activity size={22} /></div><div><b>MONEYBALL</b><span>TRUST THE PROCESS</span></div><button className="mobile-close" onClick={() => setMobileOpen(false)} aria-label="Zamknij menu"><X size={18}/></button></div>
      <div className="workspace-label">WORKSPACE</div>
      <nav className="nav-list" aria-label="Główna nawigacja">
        {nav.map(item => <button key={item.id} className={`nav-item ${active === item.id ? "active" : ""}`} onClick={() => changeTab(item.id)}><item.icon size={18}/><span>{item.label}</span>{active === item.id && <span className="nav-dot"/>}</button>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="secure-note"><ShieldCheck size={17}/><div><b>Transparent by design</b><span>Źródła i historia każdej prognozy</span></div></div>
        <div className="profile"><div className="avatar">MB</div><div><b>MONEYBALL</b><span>Nowy projekt · v0.1</span></div><CircleDot size={15} className="online-dot"/></div>
      </div>
    </aside>

    {mobileOpen && <button className="scrim" onClick={() => setMobileOpen(false)} aria-label="Zamknij menu"/>}
    <main className="main-area">
      <header className="topbar">
        <button className="mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Otwórz menu"><Menu size={21}/></button>
        <div className="breadcrumb"><span>WORKSPACE</span><ChevronRight size={14}/><b>{nav.find(n => n.id === active)?.label}</b></div>
        <div className="top-actions"><span className="timezone"><span className="live-pulse"/> EUROPE / BRUSSELS</span><button className="icon-button" aria-label="Status powiadomień" aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen(value => !value)}><Bell size={18}/></button></div>
      </header>

      {notificationsOpen && <div className="module-status" role="status" style={{ margin: "12px 24px 0", maxWidth: 520 }}><span className="status-dot"/> Powiadomienia Push nie są jeszcze skonfigurowane. Aplikacja nie wysyła obecnie alertów w tle ani na inne urządzenia.</div>}

      <div className="content">
        <section className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line"/>{current.eyebrow}</div><h1>{current.title}</h1><p>{current.subtitle}</p></div><div className="build-chip"><span/> CLEAN BUILD <b>0.1.0</b></div></section>

        {active === "dashboard" && <>
          <section className="welcome-panel"><div className="welcome-glow"/><div className="welcome-copy"><div className="welcome-tag"><Sparkles size={14}/> NOWY ROZDZIAŁ</div><h2>Najpierw dane.<br/><em>Potem decyzje.</em></h2><p>Nowa platforma analityczna budowana od podstaw. Bez fikcyjnych statystyk i bez ukrywania brakujących informacji.</p><button className="primary-button" onClick={() => changeTab("tracker")}>Otwórz Tracker <ChevronRight size={16}/></button></div><div className="welcome-visual"><div className="orb orb-one"/><div className="orb orb-two"/><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="visual-center"><Activity size={36}/><span>MB</span></div><div className="visual-label label-top">DATA FIRST</div><div className="visual-label label-bottom">MODEL VERIFIED</div></div></section>
          <div className="section-title"><div><h3>Stan systemu</h3><p>{fixtureScan ? `Skan ${fixtureScan.date} · dane z ${fixtureScan.leaguesChecked} katalogów i kanałów` : "Automatyczne pobieranie europejskich terminarzy po uruchomieniu aplikacji"}</p></div><span className="neutral-tag">{scanLoading ? "ŁADOWANIE" : fixtureScan ? fixtureScan.leaguesFailed.length ? "ŹRÓDŁA Z OSTRZEŻENIAMI" : "SKAN GOTOWY" : scanError ? "BŁĄD ŹRÓDEŁ" : "START"}</span></div>
          <section className="module-panel dashboard-safest-pick"><div className="module-icon"><Sparkles/></div><div><span className="safest-pick-label">JEDEN NAJMOCNIEJSZY TYP DNIA</span>{safestPick ? <><h2>{safestPick.title}</h2><b>{safestPick.market} · {(safestPick.probability*100).toFixed(1)}%</b><p>{safestPick.competition} · {safestPick.kickoff}</p><small>{safestPick.reason}</small></> : <p>Brak potwierdzonego kandydata DC ≥75%. Po analizie meczów pokażemy jeden wybór tylko wtedy, gdy spełni kryteria.</p>}<button className="text-link" onClick={() => changeTab("pick")}>Otwórz szczegóły selekcji <ChevronRight size={14}/></button><button className="primary-button selected-matches-cta" onClick={() => changeTab("pick")}>Mecze wytypowane przez aplikację <ChevronRight size={16}/></button></div></section>
          <section className="metrics-grid"><Metric label="Dzisiejsze mecze" value={fixtureScan ? String(fixtureScan.fixtures.length) : "—"} note={fixtureScan ? `Europa · ${fixtureScan.leaguesChecked} kanałów · otwórz terminarz` : scanError ? "Źródło chwilowo niedostępne" : "Pobieranie terminarzy"} icon={CalendarDays} onClick={() => changeTab("matches")}/><Metric label="Prognozy" value={String(predictionDiagnostics.total)} note={`${predictionDiagnostics.candidates} kandydatów · ${predictionDiagnostics.rejected} odrzuconych`} icon={Gauge} onClick={() => changeTab("intelligence")}/><Metric label="Aktywne kupony" value={String(records.filter(row => row.kind === "coupon" && ["PAPER_NO_ODDS", "PAPER_WITH_ODDS"].includes(row.status) && !records.some(child => child.kind === "coupon" && child.details.parentCouponId === row.id)).length)} note="Otwórz kupony i zobacz szczegóły" icon={Ticket} onClick={() => changeTab("coupons")}/><Metric label="Tracker" value={String(records.length)} note="Historia i zapisane dane lokalne" icon={Database} onClick={() => changeTab("tracker")}/></section>
          <section className="matches-preview"><div className="panel-heading"><div><h3>Dzisiaj w Europie</h3><p>{fixtureScan ? `Skan wykonany: ${new Date(fixtureScan.generatedAt).toLocaleString("pl-BE")} · katalog OpenMatchday: ${fixtureScan.coverage.openMatchday.catalogueGeneratedAt ? new Date(fixtureScan.coverage.openMatchday.catalogueGeneratedAt).toLocaleString("pl-BE") : "brak daty"}` : "Darmowy terminarz publiczny · PitchAPI przez bezpieczny Worker"}</p></div><button onClick={() => void runFixtureScan(true)} disabled={scanLoading}>{scanLoading ? "Pobieranie…" : "Odśwież"}</button></div>{scanError && <p className="scan-error">{scanError}</p>}{fixtureScan?.fixtures.slice(0,6).map(match => <div className="match-preview-row" key={match.id}><time>{match.time}</time><b>{match.home}</b><span>vs</span><b>{match.away}</b><small>{match.competition}</small><details className="fixture-details"><summary>Szczegóły meczu</summary><p>Data i czas: {match.date} · {match.time} (Europe/Brussels)</p><p>Kraj / federacja: {match.countryCode}</p><p>Źródła: {match.source}</p><p>Aktualizacja źródła: {match.sourceUpdatedAt}</p><p>Identyfikator meczu: {match.id}</p><p>Folder historii: {match.leagueFolder || "brak"} · OpenLigaDB: {match.leagueShortcut || "brak"} / {match.leagueSeason || "brak"} · OpenFootball: {match.openFootballFeedId || "brak"} · PitchAPI: {match.pitchApiMatchId || "brak"} / liga {match.pitchApiLeagueId || "brak"}</p>{match.sourceUrl ? <a href={match.sourceUrl} target="_blank" rel="noreferrer">Otwórz źródło meczu</a> : <span>Brak bezpośredniego linku źródłowego</span>}</details>{match.sourceUrl ? <a href={match.sourceUrl} target="_blank" rel="noreferrer">Źródło</a> : null}</div>)}{fixtureScan && fixtureScan.fixtures.length === 0 && <div className="empty-state"><b>Brak zaplanowanych meczów w pobranych źródłach</b><span>To nie potwierdza braku meczów we wszystkich rozgrywkach Europy. Sprawdź liczbę błędów i katalogów w zakładce Mecze.</span></div>}<div className="source-note">Źródła: <a href="https://github.com/oladeeayo/open-matchday" target="_blank" rel="noreferrer">open-matchday</a> (użytek niekomercyjny) · <a href="https://www.openligadb.de/" target="_blank" rel="noreferrer">OpenLigaDB</a> · <a href="https://github.com/openfootball/europe" target="_blank" rel="noreferrer">OpenFootball</a> · <a href="https://www.espn.com/soccer/scoreboard" target="_blank" rel="noreferrer">ESPN</a> · <a href="https://footynomad.com/fixtures/" target="_blank" rel="noreferrer">FootyNomad</a> · <a href="https://timezone.football/about/data/" target="_blank" rel="noreferrer">timezone.football</a> · <a href="https://pitchapi.dev/" target="_blank" rel="noreferrer">PitchAPI</a> (xG, strzały, składy i analityka meczowa; zależnie od ligi). Pokrycie zależy od aktualnych plików dostawców.</div><button className="text-link" onClick={() => changeTab("matches")}>Pokaż wszystkie mecze <ChevronRight size={14}/></button></section>
          <section className="lower-grid"><article className="panel"><div className="panel-heading"><div><h3>Ostatnia aktywność</h3><p>Rzeczywiste zdarzenia w lokalnym Trackerze</p></div><Activity size={18}/></div>{records.length ? <div className="check-list">{[...records].sort((a,b) => b.createdAt.localeCompare(a.createdAt)).slice(0,5).map(row => <div className="check-row" key={row.id}><span>{row.kind.toUpperCase().slice(0,3)}</span><div><b>{row.title}</b><small>{new Date(row.createdAt).toLocaleString("pl-BE")}</small></div><i>{row.status}</i></div>)}</div> : <div className="empty-state"><div className="empty-icon"><Activity size={21}/></div><b>Brak zapisanych zdarzeń</b><span>Po pierwszym skanie, prognozie lub rozliczeniu historia pojawi się tutaj.</span></div>}</article><article className="panel"><div className="panel-heading"><div><h3>Stan etapów platformy</h3><p>Rzeczywisty zakres wdrożenia</p></div><Trophy size={18}/></div><div className="check-list"><div className="check-row done"><span>01</span><div><b>Fundament, PWA i publikacja</b><small>Oddzielny Cloudflare Worker i automatyczny deploy</small></div><i>DONE</i></div><div className="check-row done"><span>02</span><div><b>Tracker, kopie JSON i walidacja</b><small>Lokalny rejestr z importem łączonym</small></div><i>DONE</i></div><div className="check-row"><span>03</span><div><b>Europejskie źródła terminarzy</b><small>Wiele źródeł publicznych; pokrycie nie jest kompletne</small></div><i>ACTIVE</i></div><div className="check-row"><span>04</span><div><b>Forma, prognozy i kupony testowe</b><small>Oddzielny model historycznego xG PitchAPI; kursy i kalibracja nadal wymagają weryfikacji</small></div><i>ACTIVE</i></div><div className="check-row"><span>05</span><div><b>Audyt i testy końcowe</b><small>CI, testy i deploy potwierdzone; wizualny test Androida niepotwierdzony</small></div><i>LIMIT</i></div></div></article></section>
        </>}

        {active === "matches" && <section className="tracker-panel"><div className="tracker-toolbar"><div><h2>Europejski terminarz</h2><p>{fixtureScan ? `${fixtureScan.fixtures.length} meczów na ${fixtureScan.date} · ${fixtureScan.leaguesChecked} jednostek źródeł sprawdzonych` : "Darmowe źródła danych · klucz PitchAPI pozostaje po stronie serwera"}</p></div><div className="match-toolbar-actions"><button className="primary-button" onClick={() => void runFixtureScan(true)} disabled={scanLoading || bulkLoading}>{scanLoading ? "Skanowanie…" : "Skanuj dzisiaj"}</button><button onClick={() => void analyzeAllFixtures()} disabled={!fixtureScan || bulkLoading || scanLoading || fixtureScan.fixtures.length === 0}>{bulkLoading ? `Analiza ${bulkProgress}/${fixtureScan?.fixtures.length ?? 0}` : `Analizuj wszystkie (${fixtureScan?.fixtures.length ?? 0})`}</button></div></div>{scanError && <p className="scan-error">{scanError}</p>}{bulkLoading && <p className="source-note">Przetworzono {bulkProgress} z {fixtureScan?.fixtures.length ?? 0} meczów.</p>}{fixtureScan && <p className="source-note">Źródła — open-matchday: {fixtureScan.coverage.openMatchday.cataloguesChecked} katalogów, {fixtureScan.coverage.openMatchday.fixtures} meczów, {fixtureScan.coverage.openMatchday.errors} błędów · OpenLigaDB: {fixtureScan.coverage.openLigaDB.competitionsChecked} rozgrywek, {fixtureScan.coverage.openLigaDB.fixtures} meczów, {fixtureScan.coverage.openLigaDB.errors} błędów · openfootball: {fixtureScan.coverage.openFootball.feedsChecked} plików, {fixtureScan.coverage.openFootball.fixtures} meczów, {fixtureScan.coverage.openFootball.errors} błędów · ESPN: {fixtureScan.coverage.espn.scoreboardsChecked} scoreboard, {fixtureScan.coverage.espn.fixtures} meczów, {fixtureScan.coverage.espn.errors} błędów · <a href={`https://footynomad.com/fixtures/${fixtureScan.date}`} target="_blank" rel="noreferrer">FootyNomad</a>: {fixtureScan.coverage.footyNomad.pagesChecked} stron dziennych, {fixtureScan.coverage.footyNomad.pageMatches} wpisów europejskich z 2 dat UTC, {fixtureScan.coverage.footyNomad.fixtures} meczów europejskich, {fixtureScan.coverage.footyNomad.skippedNoTimestamp} bez czasu pominięto, {fixtureScan.coverage.footyNomad.errors} błędów · <a href="https://timezone.football/about/data/" target="_blank" rel="noreferrer">timezone.football</a>: {fixtureScan.coverage.timezoneFootball.feedMatches} meczów w 14-dniowym feedzie, {fixtureScan.coverage.timezoneFootball.fixtures} na ten dzień, feed z {fixtureScan.coverage.timezoneFootball.generatedAt || "brak daty"}, {fixtureScan.coverage.timezoneFootball.errors} błędów · Flashscore: {fixtureScan.coverage.flashscore.competitionsChecked} rozgrywek, {fixtureScan.coverage.flashscore.rawMatches} surowych wpisów, {fixtureScan.coverage.flashscore.fixtures} europejskich meczów, {fixtureScan.coverage.flashscore.skippedNonEuropean} poza Europą pominięto, {fixtureScan.coverage.flashscore.skippedWrongDate} z innej daty pominięto, {fixtureScan.coverage.flashscore.timestampMissing} bez czasu, {fixtureScan.coverage.flashscore.errors} błędów · PitchAPI feed dzienny: {fixtureScan.coverage.pitchApi?.fixtures ?? 0} meczów, {fixtureScan.coverage.pitchApi?.europeanFixtures ?? 0} europejskich po weryfikacji kraju · katalog: {fixtureScan.coverage.pitchApi?.catalogueLeagues ?? 0} lig, {fixtureScan.coverage.pitchApi?.europeanCatalogueLeagues ?? 0} europejskich, {fixtureScan.coverage.pitchApi?.freeEuropeanCatalogueLeagues ?? 0} bezpłatnych europejskich, {fixtureScan.coverage.pitchApi?.skippedNonFreeCatalogueLeagues ?? 0} płatnych pominięto, {fixtureScan.coverage.pitchApi?.catalogueUpcomingFixtures ?? 0} nadchodzących w sezonach, {fixtureScan.coverage.pitchApi?.catalogueDateFixtures ?? 0} na dzisiejszą datę · {fixtureScan.coverage.pitchApi?.errors ?? 0} błędów. Duplikaty źródeł są scalane.</p>}{fixtureScan && <p className="source-note">Kraje z meczami: {[...new Set(fixtureScan.fixtures.map(match => match.countryCode))].sort().join(", ")} · rozgrywki: {new Set(fixtureScan.fixtures.map(match => match.countryCode + "|" + match.competition)).size}. Zakres pokrycia zależy od dostępności publicznych katalogów i plików. Brak błędów pobierania nie oznacza kompletności wszystkich lig, poziomów regionalnych, kobiecych ani młodzieżowych w Europie.</p>}{fixtureScan?.leaguesFailed.length ? <details className="scan-warnings"><summary>Błędy pobierania: {fixtureScan.leaguesFailed.length} źródeł lub rozgrywek</summary>{fixtureScan.leaguesFailed.map(error => <p key={error}>{error}</p>)}</details> : null}{fixtureScan && <SourceDiagnostics scan={fixtureScan}/>}<div className="tracker-search"><Search size={16}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Szukaj drużyny lub ligi…"/><span>{fixtureScan?.fixtures.filter(m => `${m.home} ${m.away} ${m.competition}`.toLowerCase().includes(query.toLowerCase())).length ?? 0} meczów</span></div><div className="fixture-list">{fixtureScan?.fixtures.filter(m => `${m.home} ${m.away} ${m.competition}`.toLowerCase().includes(query.toLowerCase())).map(match => <div className="fixture-row fixture-row-expanded" key={match.id}><time>{match.time}</time><div><b>{match.home}</b><span>{match.away}</span></div><small>{match.competition}</small><details className="fixture-details"><summary>Szczegóły meczu</summary><p>Data i czas: {match.date} · {match.time} (Europe/Brussels)</p><p>Kraj / federacja: {match.countryCode}</p><p>Źródła: {match.source}</p><p>Aktualizacja źródła: {match.sourceUpdatedAt}</p><p>Identyfikator meczu: {match.id}</p><p>Folder historii: {match.leagueFolder || "brak"} · OpenLigaDB: {match.leagueShortcut || "brak"} / {match.leagueSeason || "brak"} · OpenFootball: {match.openFootballFeedId || "brak"} · PitchAPI: {match.pitchApiMatchId || "brak"} / liga {match.pitchApiLeagueId || "brak"}</p>{match.sourceUrl ? <a href={match.sourceUrl} target="_blank" rel="noreferrer">Otwórz źródło meczu</a> : <span>Brak bezpośredniego linku źródłowego</span>}</details>{(() => {
              const matchIdentity = canonicalFixtureId(match.date, match.home, match.away, match.competition);
              const matchOdds = listFreshOddsSnapshots(records, matchIdentity, new Date().toISOString(), 60).slice(0, 3);
              const price = (value: unknown) => typeof value === "number" && value > 1 ? value.toFixed(2) : "—";
              return <div className="source-note"><b>Kursy 1X2 i Double Chance · OddsPapi / StrikerAPI · świeżość maks. 60 min:</b> {matchOdds.length ? matchOdds.map(row => <span key={row.id} style={{ display: "block" }}>{String(row.details.bookmaker ?? "Bukmacher")} · {row.details.market === "DOUBLE_CHANCE" ? `DC 1X ${price(row.details.odds1x)} / X2 ${price(row.details.oddsX2)} / 12 ${price(row.details.odds12)}` : `1 ${price(row.details.odds1)} / X ${price(row.details.oddsX)} / 2 ${price(row.details.odds2)}`}{typeof row.details.homeHandicapClose === "number" && typeof row.details.handicapHomeOdds === "number" && typeof row.details.handicapAwayOdds === "number" ? ` · AH ${row.details.homeHandicapClose} (1 ${price(row.details.handicapHomeOdds)} / 2 ${price(row.details.handicapAwayOdds)})` : ""}{typeof row.details.totalClose === "number" && typeof row.details.overOdds === "number" && typeof row.details.underOdds === "number" ? ` · O/U ${row.details.totalClose} (O ${price(row.details.overOdds)} / U ${price(row.details.underOdds)})` : ""} · {row.details.capturedAt ? new Date(String(row.details.capturedAt)).toLocaleString("pl-BE") : "czas nieznany"}</span>) : "brak świeżego kursu (≤60 min); starsze snapshoty są ukryte i nie są używane jako aktualne"}</div>;
            })()}{match.sourceUrl ? <a href={match.sourceUrl} target="_blank" rel="noreferrer">Źródło</a> : null}<button className="form-button" onClick={() => void loadFixtureForms(match)} disabled={teamForms[match.id]?.loading || !hasKnownKickoff(match.date, match.time) || hasKickoffPassed(match.date, match.time)}>{teamForms[match.id]?.loading ? "Ładowanie…" : "Forma 5 + typ"}</button>{teamForms[match.id]?.error && <p className="scan-error">{teamForms[match.id].error}</p>}{records.find(row => row.kind === "prediction" && row.details.fixtureId === match.id)?.status === "ODRZUCONY" && <p className="scan-error">TYP ODRZUCONY: {String(records.find(row => row.kind === "prediction" && row.details.fixtureId === match.id)?.details.reason ?? "Brak uzasadnienia — wymaga ponownej analizy.")}</p>}{teamForms[match.id]?.home && teamForms[match.id]?.away && <div className="team-form-panel"><div><b>{match.home} · ostatnie mecze</b>{teamForms[match.id].home!.matches.map((item,i)=><small key={item.date+i}>{item.date} · {item.venue==="H"?"D":"W"} · {item.goalsFor}:{item.goalsAgainst} · {item.result} · {item.opponent}</small>)}</div><div><b>{match.away} · ostatnie mecze</b>{teamForms[match.id].away!.matches.map((item,i)=><small key={item.date+i}>{item.date} · {item.venue==="H"?"D":"W"} · {item.goalsFor}:{item.goalsAgainst} · {item.result} · {item.opponent}</small>)}</div><p>Źródła: {teamForms[match.id].home!.source} / {teamForms[match.id].away!.source} · tylko zakończone mecze przed datą spotkania. D=dom, W=wyjazd.</p>{teamForms[match.id].prediction && <div className="form-prediction"><b>Prognoza 1X2 · {teamForms[match.id].prediction!.pick} ({Math.round(teamForms[match.id].prediction!.topProbability * 100)}%)</b><span>1: {Math.round(teamForms[match.id].prediction!.prediction.probabilities.home * 100)}% · X: {Math.round(teamForms[match.id].prediction!.prediction.probabilities.draw * 100)}% · 2: {Math.round(teamForms[match.id].prediction!.prediction.probabilities.away * 100)}%</span><span>DC: 1X {Math.round(teamForms[match.id].prediction!.prediction.doubleChance.oneX * 100)}% · X2 {Math.round(teamForms[match.id].prediction!.prediction.doubleChance.xTwo * 100)}% · 12 {Math.round(teamForms[match.id].prediction!.prediction.doubleChance.oneTwo * 100)}%</span><small>{teamForms[match.id].prediction!.method === "pitchapi-recent-xg-poisson" ? "xG z historii PitchAPI" : teamForms[match.id].prediction!.method === "neutral-prior-poisson" ? "prior awaryjny (bez historii drużyn)" : "λ z goli (NIE xG)"}: {teamForms[match.id].prediction!.prediction.expectedGoals.home.toFixed(2)}–{teamForms[match.id].prediction!.prediction.expectedGoals.away.toFixed(2)} · próby: {teamForms[match.id].prediction!.samples.homeAttack}/{teamForms[match.id].prediction!.samples.awayAttack}</small><small>{teamForms[match.id].prediction!.note}</small><small>Kontrola 7 obszarów analizy sportowej: xG/xGA, składy, kontuzje, zawieszenia, strzały/sytuacje, taktyka i terminarz/zmęczenie. Kursy i EV są osobną warstwą wyceny — ich brak nie odrzuca meczu ani prognozy.</small>{teamForms[match.id].prediction!.strongCandidate && <small>Najwyższe prawdopodobieństwo ≥75% — kandydat do puli, nie gwarancja.</small>}</div>}{teamForms[match.id].predictionError && <p className="scan-error">Prognoza niedostępna: {teamForms[match.id].predictionError}</p>}</div>}{teamForms[match.id]?.pitchApiXgForms && <div className="team-form-panel"><div><b>{match.home} · PitchAPI xG</b><small>xG/mecz: {teamForms[match.id]!.pitchApiXgForms!.home.xgForPerMatch?.toFixed(2) ?? "brak"} · xGA/mecz: {teamForms[match.id]!.pitchApiXgForms!.home.xgAgainstPerMatch?.toFixed(2) ?? "brak"}</small><small>Strzały/mecz: {teamForms[match.id]!.pitchApiXgForms!.home.shotsForPerMatch?.toFixed(1) ?? "brak"} · celne: {teamForms[match.id]!.pitchApiXgForms!.home.shotsOnTargetForPerMatch?.toFixed(1) ?? "brak"}</small><small>xGOT/mecz: {teamForms[match.id]!.pitchApiXgForms!.home.xgOnTargetForPerMatch?.toFixed(2) ?? "brak"} · duże sytuacje: {teamForms[match.id]!.pitchApiXgForms!.home.bigChancesForPerMatch?.toFixed(1) ?? "brak"} · PPDA: {teamForms[match.id]!.pitchApiXgForms!.home.ppdaPerMatch?.toFixed(1) ?? "brak"} · field tilt: {teamForms[match.id]!.pitchApiXgForms!.home.fieldTiltPerMatch?.toFixed(1) ?? "brak"}% · wejścia w pole karne: {teamForms[match.id]!.pitchApiXgForms!.home.boxEntriesPerMatch?.toFixed(1) ?? "brak"} · próbka: {teamForms[match.id]!.pitchApiXgForms!.home.sampleSize}</small></div><div><b>{match.away} · PitchAPI xG</b><small>xG/mecz: {teamForms[match.id]!.pitchApiXgForms!.away.xgForPerMatch?.toFixed(2) ?? "brak"} · xGA/mecz: {teamForms[match.id]!.pitchApiXgForms!.away.xgAgainstPerMatch?.toFixed(2) ?? "brak"}</small><small>Strzały/mecz: {teamForms[match.id]!.pitchApiXgForms!.away.shotsForPerMatch?.toFixed(1) ?? "brak"} · celne: {teamForms[match.id]!.pitchApiXgForms!.away.shotsOnTargetForPerMatch?.toFixed(1) ?? "brak"}</small><small>xGOT/mecz: {teamForms[match.id]!.pitchApiXgForms!.away.xgOnTargetForPerMatch?.toFixed(2) ?? "brak"} · duże sytuacje: {teamForms[match.id]!.pitchApiXgForms!.away.bigChancesForPerMatch?.toFixed(1) ?? "brak"} · PPDA: {teamForms[match.id]!.pitchApiXgForms!.away.ppdaPerMatch?.toFixed(1) ?? "brak"} · field tilt: {teamForms[match.id]!.pitchApiXgForms!.away.fieldTiltPerMatch?.toFixed(1) ?? "brak"}% · wejścia w pole karne: {teamForms[match.id]!.pitchApiXgForms!.away.boxEntriesPerMatch?.toFixed(1) ?? "brak"} · próbka: {teamForms[match.id]!.pitchApiXgForms!.away.sampleSize}</small></div><p>Źródło: PitchAPI · tylko zakończone spotkania przed datą meczu · xG nie jest mieszane z innymi dostawcami.</p></div>}{teamForms[match.id]?.pitchApiLineups && <div className="team-form-panel"><div><b>{match.home} · {teamForms[match.id]!.pitchApiLineups!.home.confirmed ? "SKŁAD POTWIERDZONY" : "SKŁAD PRZEWIDYWANY"}</b><small>Ustawienie: {teamForms[match.id]!.pitchApiLineups!.home.formation ?? "brak"} · trener: {teamForms[match.id]!.pitchApiLineups!.home.coach?.name ?? "brak"}</small><small>{teamForms[match.id]!.pitchApiLineups!.home.starters?.map(player => player.name).join(", ") || "Brak danych o jedenastce"}</small></div><div><b>{match.away} · {teamForms[match.id]!.pitchApiLineups!.away.confirmed ? "SKŁAD POTWIERDZONY" : "SKŁAD PRZEWIDYWANY"}</b><small>Ustawienie: {teamForms[match.id]!.pitchApiLineups!.away.formation ?? "brak"} · trener: {teamForms[match.id]!.pitchApiLineups!.away.coach?.name ?? "brak"}</small><small>{teamForms[match.id]!.pitchApiLineups!.away.starters?.map(player => player.name).join(", ") || "Brak danych o jedenastce"}</small></div><p>Źródło: PitchAPI · tylko pole confirmed=true po obu stronach i pełne 11 nazwisk uznaje składy za potwierdzone. Przewidywany skład nie potwierdza dostępności zawodnika ani braku kontuzji.</p></div>}{(teamForms[match.id]?.apiFootballFixture || teamForms[match.id]?.apiFootballInjuries !== undefined) && <div className="team-form-panel"><div><b>API-FOOTBALL PRO · DANE MECZU</b><small>Zdarzenia: {teamForms[match.id]?.apiFootballFixture?.events?.length ?? "brak"} · składy: {teamForms[match.id]?.apiFootballFixture?.lineups?.length ?? "brak"} · statystyki drużyn: {teamForms[match.id]?.apiFootballFixture?.statistics?.length ?? "brak"} · statystyki zawodników: {teamForms[match.id]?.apiFootballFixture?.players?.length ?? "brak"}</small><small>Kontuzje i zawieszenia: {teamForms[match.id]?.apiFootballInjuries?.length ?? "niepobrano"}</small>{teamForms[match.id]?.apiFootballInjuries?.slice(0,8).map((row,index) => <small key={String(row.player?.id ?? index)}>{row.team?.name ?? "Drużyna"} · {row.player?.name ?? "Zawodnik"} · {row.player?.reason ?? row.player?.type ?? "brak powodu"}</small>)}</div><details className="api-football-details"><summary>Pełne dane API-Football Pro: zdarzenia, składy, statystyki drużyn i zawodników</summary><pre style={{ maxHeight: 320, overflow: "auto", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{JSON.stringify({ fixture: teamForms[match.id]?.apiFootballFixture ?? null, injuries: teamForms[match.id]?.apiFootballInjuries ?? null }, null, 2)}</pre></details><p>Źródło: API-Football Pro · pełny pakiet zapisujemy tylko raz na mecz w głównym rekordzie 1X2, aby ograniczyć zużycie pamięci Trackera. Brak rekordu dostawcy nie oznacza potwierdzenia braku kontuzji.</p></div>}</div>)}{fixtureScan && fixtureScan.fixtures.length === 0 && <div className="tracker-empty">Brak meczów w pobranych źródłach na dziś. Nie oznacza to, że wszystkie europejskie rozgrywki zostały potwierdzone.</div>}</div><p className="source-note">Źródła: <a href="https://github.com/oladeeayo/open-matchday" target="_blank" rel="noreferrer">open-matchday</a> (CSV, użytek niekomercyjny) + <a href="https://www.openligadb.de/" target="_blank" rel="noreferrer">OpenLigaDB</a> (API) + <a href="https://github.com/openfootball/europe" target="_blank" rel="noreferrer">OpenFootball</a> (public domain) + <a href="https://www.espn.com/soccer/scoreboard" target="_blank" rel="noreferrer">ESPN</a> (dodatkowy globalny scoreboard, ograniczenia pokrycia). Puchary, rozgrywki młodzieżowe i kobiece są uwzględniane, gdy dostawca publikuje feed. Pokrycie zależy od dostępności danych; błędy i braki są raportowane.</p></section>}

        {active === "bets" && <section className="module-panel bets-module">
          <div className="module-icon"><Ticket/></div><h2>Bilans wybranych zakładów</h2>
          <div className="audit-metrics bet-metrics"><DetailMetric label="Saldo początkowe" value={new Intl.NumberFormat("pl-BE",{style:"currency",currency:"EUR"}).format(bankroll.openingBalance)} detail="Wirtualny bankroll startowy €91,60; można go nadpisać wpisem OPENING_BALANCE w lokalnym Trackerze."/><DetailMetric label="Saldo dostępne" value={new Intl.NumberFormat("pl-BE",{style:"currency",currency:"EUR"}).format(bankroll.availableBalance)} valueClass={bankroll.availableBalance >= 0 ? "profit-positive" : "profit-negative"} detail="Saldo początkowe + zysk/strata rozliczonych zakładów − stawki zarezerwowane w otwartych zakładach."/><DetailMetric label="Otwarte stawki" value={new Intl.NumberFormat("pl-BE",{style:"currency",currency:"EUR"}).format(bankroll.openExposure)} detail="Kwota zarezerwowana przez wybrane, nierozliczone zakłady. Nie jest liczona jako strata."/><DetailMetric label="Rozliczone P/L" value={new Intl.NumberFormat("pl-BE",{style:"currency",currency:"EUR"}).format(bankroll.settledProfitLoss)} detail="Suma rzeczywistego zysku/straty z rekordów rozliczeń; odrzucone typy nie zmieniają salda."/></div>
          <article className="panel">
            <div className="panel-heading"><div><h3>Automatyczne kursy · API-Football Pro + OddsPapi + StrikerAPI</h3><p>API-Football Pro: automatyczne kursy 1X2/DC dla dostępnych meczów · OddsPapi: dwie synchronizacje z budżetem miesięcznym · StrikerAPI: tylko po osobnej zgodzie</p></div><ShieldCheck size={18}/></div>
            <div className="tracker-form">
              <input type="password" autoComplete="off" value={oddsPilotToken} onChange={event => { setOddsPilotToken(event.target.value); setOddsTokenSaved(false); }} placeholder="Opcjonalny ODDS_PILOT_TOKEN · min. 32 znaki" aria-label="Opcjonalny token do dodatkowych kursów OddsPapi i StrikerAPI"/>
              <button onClick={saveOddsPilotToken}>Zapisz token</button>
              <button onClick={clearOddsPilotToken} disabled={!oddsTokenSaved && !oddsPilotToken}>Usuń</button>
              <span className="source-note">{oddsLoading ? "Pobieranie kursów…" : lastOddsPapiAttemptKey.startsWith((fixtureScan?.date ?? "") + "|") && lastOddsFetchDate === fixtureScan?.date ? "OddsPapi i StrikerAPI: próby wykonane dzisiaj" : lastOddsPapiAttemptKey.startsWith((fixtureScan?.date ?? "") + "|") ? "OddsPapi: próba wykonana dzisiaj" : lastOddsFetchDate === fixtureScan?.date ? "StrikerAPI: kursy pobrane dzisiaj; OddsPapi osobno" : lastOddsAttemptDate === fixtureScan?.date ? "StrikerAPI: próba wykonana — bez ponawiania kosztownych zapytań" : oddsProviderStatus === null ? "Sprawdzanie konfiguracji dostawców…" : !oddsProviderStatus.apiFootball && !oddsProviderStatus.oddspapi && !oddsProviderStatus.strikerapi ? "Brak skonfigurowanych źródeł kursów" : !oddsProviderStatus.apiFootball ? (!oddsProviderStatus.pilotEnabled ? "Brak sekretu ODDS_PILOT_TOKEN dla dodatkowych dostawców" : oddsTokenSaved ? "OddsPapi: synchronizacja po zapisaniu tokenu; StrikerAPI wyłączony bez osobnej zgody" : "API-Football Pro niedostępny; token jest opcjonalny dla dodatkowych źródeł") : oddsTokenSaved ? "API-Football Pro działa automatycznie; dodatkowe OddsPapi dostępne po zapisaniu tokenu; StrikerAPI wyłączony bez osobnej zgody" : "API-Football Pro działa automatycznie; token jest opcjonalny dla dodatkowych OddsPapi/StrikerAPI"}</span>
            </div>
            <p className="source-note">{apiFootballOddsLoading ? "API-Football Pro: pobieranie kursów…" : apiFootballOddsNotice}</p>
            <p className="source-note">API-Football Pro pobiera automatycznie kursy przedmeczowe dla dopasowanych identyfikatorów meczów. Dostępność zależy od pokrycia ligi i bukmachera; dostawca aktualizuje ten endpoint co 3 godziny i udostępnia kursy w oknie 1–14 dni przed meczem. Znaczniki czasu pochodzą z pola aktualizacji dostawcy — brak czasu lub brak rynku nie jest uzupełniany sztucznie. OddsPapi używa istniejącego <b>ODDSPAPI_API_KEY</b>; Worker sprawdza rzeczywisty limit przez bezpłatny endpoint /account, preferuje Bwin.be i wysyła jednego bukmachera oraz maksymalnie trzy rozgrywki na zapytanie. Budżet 250 zapytań miesięcznych jest rozkładany na pozostałe dni miesiąca i dwa okna synchronizacji; pominięte rozgrywki są raportowane. Katalog rynków Double Chance jest odkrywany najwyżej raz na 7 dni, jeśli budżet pozwala; brak kursu nie blokuje prognozy. Sekret <b>ODDS_PILOT_TOKEN</b> jest potrzebny wyłącznie do dodatkowego OddsPapi i StrikerAPI i pozostaje w Workerze oraz lokalnej przeglądarce. StrikerAPI jest wyłączony bez osobnej zgody.</p>
            {oddsProviderStatus?.oddspapiAccount && <p className="source-note">OddsPapi · stan: {oddsProviderStatus.oddspapiAccount.status ?? "nieznany"}{typeof oddsProviderStatus.oddspapiAccount.remaining === "number" ? ` · pozostałe zapytania: ${oddsProviderStatus.oddspapiAccount.remaining}/${oddsProviderStatus.oddspapiAccount.requestLimit ?? "—"}` : ""}{oddsProviderStatus.oddspapiAccount.bookmakerSlugs?.length ? ` · dostępne feedy: ${oddsProviderStatus.oddspapiAccount.bookmakerSlugs.join(", ")}` : ""}</p>}
            {oddsNotice && <div className="tracker-notice">{oddsNotice}</div>}
            {oddsAudit && <p className="source-note">Ostatni audyt · UTC {oddsAudit.utcDate} · dopasowane {oddsAudit.matched} · niejednoznaczne {oddsAudit.ambiguous} · bez dopasowania {oddsAudit.unmatched} · nowe snapshoty {oddsAudit.snapshots}.</p>}
            <h3>Ostatnie snapshoty kursów</h3><p className="source-note">Historia zachowuje starsze odczyty, ale tylko snapshoty do 60 minut są oznaczane jako świeże. Starsze ceny są archiwalne i nie mogą potwierdzać aktualnego kuponu.</p>
            <div className="tracker-table">
              <div className="tracker-head"><span>BUKMACHER</span><span>MECZ / RYNEK</span><span>1 / 1X</span><span>X / X2</span><span>2 / 12</span></div>
              {records.filter(row => row.kind === "odds").slice(0, 20).map(row => {
                const price = (value: unknown) => typeof value === "number" && value > 1 ? value.toFixed(2) : "—";
                const capturedAt = typeof row.details.capturedAt === "string" ? Date.parse(row.details.capturedAt) : NaN;
                const ageMs = Date.now() - capturedAt;
                const freshness = Number.isFinite(capturedAt) && ageMs >= 0 && ageMs <= 60 * 60 * 1000 ? "ŚWIEŻY" : "ARCHIWALNY";
                const timestamp = Number.isFinite(capturedAt) ? new Date(capturedAt).toLocaleString("pl-BE") : "brak czasu";
                return <div className="tracker-row" key={row.id}>
                  <span>{String(row.details.bookmaker ?? "—")} · {freshness} · {timestamp}</span>
                  <b>{row.title}</b>
                  <span>{row.details.market === "DOUBLE_CHANCE" ? price(row.details.odds1x) : price(row.details.odds1)}</span>
                  <span>{row.details.market === "DOUBLE_CHANCE" ? price(row.details.oddsX2) : price(row.details.oddsX)}</span>
                  <span>{row.details.market === "DOUBLE_CHANCE" ? price(row.details.odds12) : price(row.details.odds2)}</span>
                </div>;
              })}
              {!records.some(row => row.kind === "odds") && <div className="tracker-empty">Brak zapisanych kursów. Po jednorazowym zapisaniu tokenu aplikacja pobierze je automatycznie po skanie.</div>}
            </div>
          </article>
          {(() => {
            const bets = records.filter(row => row.kind === "bet");
            const selected = bets.filter(row => row.details.decision === "SELECTED");
            const rejected = bets.filter(row => row.details.decision === "REJECTED");
            const betSettlements = new Map(bets.filter(row => typeof row.details.parentBetId === "string").map(row => [String(row.details.parentBetId), row]));
            const settled = selected.map(row => betSettlements.get(row.id)).filter((row): row is TrackerRecord => !!row && ["WON","LOST","VOID"].includes(row.status));
            const wins = settled.filter(row => row.status === "WON").length;
            const losses = settled.filter(row => row.status === "LOST").length;
            const profit = settled.reduce((sum,row) => sum + (typeof row.details.profitLoss === "number" ? row.details.profitLoss : 0),0);
            const openStake = selected.filter(row => !betSettlements.has(row.id)).reduce((sum,row) => sum + (Number(row.details.stake)||0),0);
            const stake = settled.reduce((sum,row) => sum + (typeof row.details.stake === "number" ? row.details.stake : 0),0);
            const rejectedSettled = rejected.map(row => betSettlements.get(row.id)).filter((row): row is TrackerRecord => !!row && ["ODRZUCONY_TRAFIŁ","ODRZUCONY_NIE_TRAFIŁ"].includes(row.status));
            const rejectedHits = rejectedSettled.filter(row => row.status === "ODRZUCONY_TRAFIŁ").length;
            const currency = (value: number) => new Intl.NumberFormat("pl-BE",{style:"currency",currency:"EUR"}).format(value);
            return <>
              <div className="audit-metrics bet-metrics">
                <DetailMetric label="Wybrane zakłady" value={selected.length} detail="Liczba zapisanych przez użytkownika decyzji SELECTED. Nie oznacza automatycznie postawionych zakładów."/>
                <DetailMetric label="Rozliczone" value={settled.length} detail="Wybrane zakłady, dla których zapisano końcowy status WON, LOST lub VOID."/>
                <DetailMetric label="Bilans netto" value={currency(profit)} valueClass={profit >= 0 ? "profit-positive" : "profit-negative"} detail="Suma zysków i strat wyłącznie z rozliczonych wybranych zakładów. Otwarte stawki nie są zyskiem ani stratą."/>
                <DetailMetric label="ROI" value={stake > 0 ? `${(profit/stake*100).toFixed(1)}%` : "—"} detail="Bilans netto podzielony przez sumę stawek rozliczonych zakładów. Bez rozliczonych stawek ROI nie jest wyliczany."/>
                <DetailMetric label="Wygrane / przegrane" value={`${wins} / ${losses}`} detail="Liczba zakładów zakończonych statusem WON i LOST. VOID jest liczony osobno i nie zwiększa tych wartości."/>
                <DetailMetric label="Odrzucone typy" value={rejected.length} detail="Liczba decyzji REJECTED zapisanych w Trackerze. Ich wyniki mogą być oceniane hipotetycznie, ale nie wpływają na P/L."/>
                <DetailMetric label="Odrzucone, które weszły" value={rejectedSettled.length ? `${rejectedHits}/${rejectedSettled.length}` : "—"} detail="Hipotetyczna trafność odrzuconych typów, dla których pobrano wynik. Nie jest uwzględniana w bilansie."/>
                <DetailMetric label="Średni kurs wybranych" value={selected.length ? (selected.reduce((s,r)=>s+(Number(r.details.odds)||0),0)/selected.length).toFixed(2) : "—"} detail="Średnia arytmetyczna zapisanych kursów wybranych zakładów; brak kursu w rekordzie traktowany jest jako zero i wymaga weryfikacji danych."/>
                <DetailMetric label="Średni kurs odrzuconych" value={rejected.length ? (rejected.reduce((s,r)=>s+(Number(r.details.odds)||0),0)/rejected.length).toFixed(2) : "—"} detail="Średnia arytmetyczna kursów zapisanych przy odrzuconych decyzjach. Służy do porównania selekcji, nie do wyliczania P/L."/>
                <DetailMetric label="Stawki w otwartych typach" value={currency(openStake)} detail="Suma stawek wybranych zakładów, które nie mają jeszcze rekordu rozliczenia. To ekspozycja, a nie zrealizowana strata."/>
              </div>
              <h3>Rejestr wybranych i odrzuconych</h3>
              <p>Przy każdym zapisanym typie można odnotować kurs. Dla odrzuconego stawka wynosi 0; jego trafność liczymy wyłącznie hipotetycznie.</p>
              <div className="tracker-table">
                <div className="tracker-head"><span>DECYZJA</span><span>MECZ / TYP</span><span>KURS</span><span>STAWKA</span><span>STATUS / P/L</span></div>
                {bets.filter(row => typeof row.details.parentBetId !== "string").map(row => { const settlement = betSettlements.get(row.id); return <div className="tracker-row bet-row" key={row.id}>
                  <span>{row.details.decision === "SELECTED" ? "WYBRANY" : "ODRZUCONY"}</span>
                  <b>{row.title} · {String(row.details.market ?? "")}</b>
                  <span>{Number(row.details.odds).toFixed(2)}</span>
                  <span>{currency(Number(row.details.stake)||0)}</span>
                  <span>{settlement?.status ?? row.status}{typeof settlement?.details.profitLoss === "number" ? ` · ${currency(settlement.details.profitLoss)}` : ""}</span>
                </div>; })}
                {!bets.length && <div className="tracker-empty">Nie ma jeszcze zapisanych decyzji. Wygeneruj prognozy, a następnie oznacz typ jako wybrany lub odrzucony w tym panelu.</div>}
              </div>
              <h3>Typy gotowe do decyzji</h3>
              <div className="bet-entry-list">
                {records.filter(row => row.kind === "prediction" && typeof row.details.fixtureId === "string").map(prediction => {
                  const input = betInputFor(prediction);
                  const already = bets.some(row => row.details.fixtureId === prediction.details.fixtureId);
                  return <article className="bet-entry" key={prediction.id}>
                    <div><b>{prediction.title}</b><small>{String(prediction.details.competition ?? "Liga nieustalona")} · {prediction.status} · {String(prediction.details.reason ?? "Brak powodu odrzucenia")}</small></div>
                    <div className="bet-entry-controls">
                      <select value={input.market} onChange={e=>setBetInputs(v=>({...v,[String(prediction.details.fixtureId)]:{...input,market:e.target.value}}))}>
                        <option value="1">1</option><option value="X">X</option><option value="2">2</option><option value="1X">1X</option><option value="X2">X2</option><option value="12">12</option>
                      </select>
                      <input type="number" min="1.01" step="0.01" placeholder="Kurs" value={input.odds} onChange={e=>setBetInputs(v=>({...v,[String(prediction.details.fixtureId)]:{...input,odds:e.target.value}}))}/>
                      <input type="number" min="0.01" step="0.01" placeholder="Stawka €" value={input.stake} onChange={e=>setBetInputs(v=>({...v,[String(prediction.details.fixtureId)]:{...input,stake:e.target.value}}))}/>
                      <button disabled={already} onClick={()=>recordBetDecision(prediction,"SELECTED")}>Wybieram</button>
                      <button disabled={already} onClick={()=>recordBetDecision(prediction,"REJECTED")}>Odrzucam</button>
                    </div>
                    {already && <small>Decyzja już zapisana w rejestrze.</small>}
                  </article>;
                })}
                {!records.some(row=>row.kind==="prediction") && <div className="tracker-empty">Najpierw uruchom analizę meczów, aby pojawiły się prognozy.</div>}
              </div>
              <p className="source-note">Bilans uwzględnia wyłącznie rozliczone, wybrane zakłady. Odrzucone typy są porównaniem hipotetycznym i nigdy nie zwiększają ani nie zmniejszają salda.</p>
            </>;
          })()}
          {notice && <div className="tracker-notice">{notice}</div>}
        </section>}
        {active === "tracker" && <section className="tracker-panel">
          <div className="scan-warnings" style={{ marginBottom: 16 }}>
            <h3>Kontrola integralności danych na urządzeniu</h3>
            <p>Data skanu: <b>{fixtureScan?.date ?? "brak aktualnego skanu"}</b> · lokalne rekordy: <b>{records.length}</b> · zapisane mecze: <b>{predictionDiagnostics.total}</b></p>
            <p>1X2: <b>{predictionDiagnostics.total - predictionDiagnostics.missing1X2}/{predictionDiagnostics.total}</b> rekordów · brak: <b>{predictionDiagnostics.missing1X2}</b> · z niepoprawnymi/brakującymi prawdopodobieństwami: <b>{predictionDiagnostics.withoutProbabilities}</b></p>
            <p>Double Chance: <b>{predictionDiagnostics.total - predictionDiagnostics.missingDC}/{predictionDiagnostics.total}</b> rekordów · brak: <b>{predictionDiagnostics.missingDC}</b> · z niepoprawnymi/brakującymi prawdopodobieństwami: <b>{predictionDiagnostics.withoutDcProbabilities}</b></p>
            <p><b>{predictionDiagnostics.missing1X2 === 0 && predictionDiagnostics.missingDC === 0 && predictionDiagnostics.withoutProbabilities === 0 && predictionDiagnostics.withoutDcProbabilities === 0 && predictionDiagnostics.total > 0 ? "Rekordy rynków kompletne dla zapisanych meczów" : "Wymagana kontrola brakujących lub niekompletnych rekordów"}</b></p>
            <p>To jest odczyt localStorage tej przeglądarki. Dane nie są wysyłane na serwer, więc zdalny CI nie może potwierdzić stanu Twojego telefonu. Użyj „Eksport JSON”, aby przekazać kopię do analizy — import zachowuje istniejące wpisy i dodaje brakujące.</p>
            <button onClick={downloadBackup}>Eksportuj dane do kontroli</button>
          </div>
          <div className="tracker-toolbar"><div><h2>Twój lokalny rejestr</h2><p>Dane są zapisywane w pamięci tej przeglądarki. Eksportuj kopię, aby ich nie utracić.</p></div><div className="backup-actions"><button onClick={downloadBackup}>Eksport JSON</button><button onClick={downloadCsv}>Eksport CSV</button><button onClick={() => fileRef.current?.click()}>Import JSON</button><input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={e => void loadBackup(e.target.files?.[0])}/></div></div><div className="tracker-form"><select value={newKind} onChange={e => setNewKind(e.target.value as TrackerKind)}><option value="match">Mecz</option><option value="prediction">Prognoza</option><option value="coupon">Kupon</option><option value="scan">Skan</option><option value="result">Wynik</option><option value="odds">Kurs</option><option value="ledger">Bankroll</option><option value="category">Kategoria</option><option value="jackpot">Jackpot</option></select><input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Dodaj wpis do Trackera…"/><button onClick={saveRecord} disabled={!newTitle.trim()}><Plus size={16}/> Zapisz</button></div>{notice && <div className="tracker-notice">{notice}</div>}<div className="tracker-search"><Search size={16}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Szukaj wpisów…"/><span>{visibleRecords.length} wpisów</span></div><div className="tracker-table"><div className="tracker-head"><span>TYP</span><span>NAZWA</span><span>STATUS</span><span>DATA</span><span/></div>{visibleRecords.map(row => <div className="tracker-row tracker-row-detail" key={row.id}><span>{row.kind}</span><b>{row.title}</b><span>{row.status}</span><time>{new Date(row.createdAt).toLocaleString("pl-BE")}</time><details className="record-details"><summary>Szczegóły</summary><dl>{Object.entries(row.details).map(([key,value]) => <div key={key}><dt>{key}</dt><dd>{key === "historyProvenance" ? describeHistoryProvenance(value) : typeof value === "object" ? JSON.stringify(value) : String(value ?? "—")}</dd></div>)}</dl></details><span className="history-protected" title="Historia jest chroniona — użyj kopii zapasowej do przenoszenia danych">Zapis chroniony</span></div>)}{visibleRecords.length === 0 && <div className="tracker-empty">Brak wpisów. Dodaj pierwszy rekord lub zaimportuj kopię zapasową.</div>}</div></section>}

        {active === "coupons" && <section className="module-panel coupon-module">
          <div className="module-icon"><Ticket/></div>
          <h2>Kupony testowe · dokładnie 3 mecze</h2>
          <p>Do puli trafiają wyłącznie typy z najwyższym prawdopodobieństwem co najmniej 75%. Każdy kupon ma trzy różne mecze, bez powtórek.</p>
          <div className="module-status"><span className="status-dot"/> {fixtureScan ? `DATA SKANU: ${fixtureScan.date}` : "NAJPIERW WYKONAJ SKAN MECZÓW"}</div>
          {(() => {
            const candidates = buildThreeLegCandidates(currentScanRecords, fixtureScan?.date ?? "");
            const bookmakers = listOddsBookmakers(records, candidates.flatMap(item => item.legs.map(leg => leg.fixtureId)));
            return candidates.length ? <div className="coupon-candidates">
              <label className="field-label">Bukmacher do wyceny kuponu
                <select value={selectedOddsBookmaker} onChange={event => setSelectedOddsBookmaker(event.target.value)}>
                  <option value="">Wybierz bukmachera</option>
                  {bookmakers.map(bookmaker => <option key={bookmaker} value={bookmaker}>{bookmaker}</option>)}
                </select>
              </label>
              <div className="coupon-candidate-heading"><b>{candidates.length} kombinacji spełnia próg</b><small>Kolejność według iloczynu prawdopodobieństw modelu</small></div>
              {candidates.slice(0, 10).map((coupon, index) => {
                const priced = selectedOddsBookmaker ? valueThreeLegCoupon(coupon, records, selectedOddsBookmaker) : null;
                const couponKey = [coupon.date, ...coupon.legs.map(leg => `${leg.fixtureId}:${leg.market}:${leg.selection}`), priced?.bookmaker ?? "NO_ODDS"].join("|");
                const alreadySaved = records.some(row => row.kind === "coupon" && row.details.couponKey === couponKey);
                return <article className="coupon-candidate" key={coupon.legs.map(leg => leg.fixtureId).join("|")}>
                  <div className="coupon-candidate-top"><b>Kupon testowy #{index + 1}</b><span>3/3 mecze</span></div>
                  {coupon.legs.map((leg, legIndex) => <div className="coupon-leg" key={leg.fixtureId}>
                    <b>{leg.title}</b><span>{leg.market === "DOUBLE_CHANCE" ? "DC " : "1X2 "}{leg.selection} · {Math.round(leg.probability * 100)}%</span><small>{leg.competition}{priced ? ` · kurs ${priced.legs[legIndex].decimalOdds.toFixed(2)} · EV ${(priced.legs[legIndex].expectedValue * 100).toFixed(1)}%` : ""}</small>
                  </div>)}
                  <div className="coupon-candidate-bottom">
                    <span>Prawdopodobieństwo modelu: {(coupon.combinedProbability * 100).toFixed(1)}%</span>
                    {priced ? <span>AKO {priced.combinedOdds.toFixed(2)} · EV {(priced.expectedValue * 100).toFixed(1)}%</span> : <span>{coupon.legs.some(leg => leg.market === "DOUBLE_CHANCE") ? "Brak zweryfikowanych kursów DC — kupon bez wyceny" : selectedOddsBookmaker ? "Brak kompletnych/świeżych kursów dla wszystkich 3 meczów" : "Wybierz bukmachera — kursy niepotwierdzone"}</span>}
                  </div>
                  {priced && <p className="source-note">Stawka €{priced.stake.toFixed(2)} · możliwy zwrot €{priced.potentialReturn.toFixed(2)} · możliwy zysk €{priced.potentialProfit.toFixed(2)} · {priced.bookmaker}</p>}
                  <button disabled={alreadySaved} onClick={() => {
                    if (priced && !canReserveStake(readRecords(), priced.stake)) {
                      const balance = calculateBankroll(readRecords()).availableBalance;
                      setNotice(`Brak wystarczającego salda na kupon papierowy. Dostępne: €${balance.toFixed(2)}; wymagana stawka: €${priced.stake.toFixed(2)}.`);
                      return;
                    }
                    addRecordsIfMissing([{
                      kind: "coupon",
                      title: `Kupon ${fixtureScan!.date} #${index + 1}`,
                      status: priced ? "PAPER_WITH_ODDS" : "PAPER_NO_ODDS",
                      details: {
                        date: coupon.date,
                        couponKey,
                        legsJson: JSON.stringify(coupon.legs.map((leg, legIndex) => ({
                          fixtureId: leg.fixtureId, selection: leg.selection, market: leg.market, probability: leg.probability,
                          odds: priced?.legs[legIndex].decimalOdds ?? null,
                        }))),
                        combinedProbability: coupon.combinedProbability,
                        bookmaker: priced?.bookmaker ?? null,
                        odds: priced?.combinedOdds ?? null,
                        expectedValue: priced?.expectedValue ?? null,
                        stake: priced?.stake ?? null,
                        potentialReturn: priced?.potentialReturn ?? null,
                        potentialProfit: priced?.potentialProfit ?? null,
                      },
                    }], "couponKey");
                    setRecords(readRecords());
                  }}>{alreadySaved ? "Kupon już zapisany" : priced ? "Zapisz wyceniony kupon €4" : "Zapisz kupon bez kursów"}</button>
                </article>;
              })}
            </div> : <div className="tracker-empty">Brak trzech różnych meczów z potwierdzoną prognozą ≥75% na dzień skanu. Wygeneruj prognozy w zakładce Mecze.</div>;
          })()}
          <p className="source-note">EV = prawdopodobieństwo modelu × kurs AKO − 1. Kupon z kursem wymaga trzech kompletnych, świeżych cen u jednego bukmachera. Stawka papierowa €4; wycena nie jest gwarancją wyniku.</p>
        </section>}
        {active === "intelligence" && <section className="module-panel audit-module">
          <div className="module-icon"><BarChart3/></div>
          <h2>Jakość modelu · wyniki rozliczone</h2><button className="settle-button" onClick={() => void settlePendingResults()} disabled={settling}>{settling ? `Sprawdzanie ${settleProgress}…` : "Pobierz wyniki i rozlicz"}</button>
          <p>Metryki liczone wyłącznie z prognoz połączonych z rzeczywistym wynikiem przez identyfikator meczu.</p>
          {modelAudit.metrics ? <><div className="audit-metrics"><DetailMetric label="Próba" value={modelAudit.metrics.count} detail="Liczba różnych meczów z prognozą 1X2 i dopasowanym rzeczywistym wynikiem. Duplikaty tego samego meczu nie zwiększają próby."/><DetailMetric label="Skuteczność 1X2" value={(modelAudit.metrics.accuracy*100).toFixed(1)+"%"} detail="Odsetek rozliczonych meczów, w których najwyższe prawdopodobieństwo 1X2 wskazało prawidłowy wynik."/><DetailMetric label="Brier score" value={modelAudit.metrics.brierScore.toFixed(4)} detail="Średni kwadratowy błąd prawdopodobieństw. Niższa wartość oznacza lepszą jakość probabilistyczną."/><DetailMetric label="Log loss" value={modelAudit.metrics.logLoss.toFixed(4)} detail="Kara za przypisywanie niskiego prawdopodobieństwa wynikowi, który faktycznie wystąpił. Niżej znaczy lepiej."/></div>{modelAudit.doubleChance && <><h3>Double Chance · osobny audyt rynku</h3><div className="audit-metrics"><DetailMetric label="Próba DC (3 rynki/mecz)" value={modelAudit.doubleChance.count} detail="Każdy rozliczony mecz dostarcza do trzech obserwacji: 1X, X2 i 12. To nie jest liczba meczów."/><DetailMetric label="Skuteczność DC" value={(modelAudit.doubleChance.accuracy*100).toFixed(1)+"%"} detail="Odsetek rynków Double Chance, dla których prognoza przekroczyła 50% i zdarzenie rzeczywiście zaszło."/><DetailMetric label="Brier DC" value={modelAudit.doubleChance.brierScore.toFixed(4)} detail="Średni kwadratowy błąd prawdopodobieństw dla trzech rynków Double Chance. Niższa wartość jest lepsza."/><DetailMetric label="Log loss DC" value={modelAudit.doubleChance.logLoss.toFixed(4)} detail="Logarytmiczna kara dla prognoz Double Chance, szczególnie za zbyt pewne nietrafione wskazania."/></div></>}<h3>Kalibracja pewności</h3><div className="audit-buckets">{modelAudit.buckets.map(bucket => <div key={bucket.label}><b>{bucket.label}</b><span>Prognoza: {(bucket.averageConfidence*100).toFixed(1)}%</span><span>Trafienia: {(bucket.observedAccuracy*100).toFixed(1)}%</span><small>n={bucket.count}</small></div>)}</div></> : <div className="tracker-empty">Brak rozliczonych prognoz. Zapisz wynik z tym samym fixtureId co prognoza, aby uruchomić Brier score, log loss, skuteczność i kalibrację.</div>}
          <details className="scan-warnings" open><summary>Pokrycie: {predictionDiagnostics.total} meczów · brak 1X2: {predictionDiagnostics.missing1X2} · brak DC: {predictionDiagnostics.missingDC} · 1X2 ≥75%: {predictionDiagnostics.candidates} · DC ≥75%: {predictionDiagnostics.dcCandidates} · odrzucone: {predictionDiagnostics.rejected}</summary><p>Bez prawidłowych prawdopodobieństw 1X2: {predictionDiagnostics.withoutProbabilities} · bez prawidłowych prawdopodobieństw Double Chance: {predictionDiagnostics.withoutDcProbabilities}. Puste lub matematycznie niepoprawne rekordy nie są zaliczane jako prognoza. Braki zwykle oznaczają niedostępną historię, feed albo niepotwierdzoną godzinę meczu.</p>{predictionDiagnostics.reasons.length ? predictionDiagnostics.reasons.map(([reason,count]) => <p key={reason}><b>{count}×</b> {reason}</p>) : <p>Brak zapisanych odrzuceń w najnowszej prognozie każdego meczu.</p>}<p>Kandydat 1X2: 75%. Kandydat Double Chance: 75%. To niezależne kryteria — mecz może spełnić próg DC, nawet jeśli nie spełnia progu 1X2.</p></details>
          {modelAudit.modelComparisons.length > 0 && <><h3>Porównanie modeli · osobne rynki</h3><div className="audit-metrics">{modelAudit.modelComparisons.map(item => {
            const metric = item.metrics;
            return <DetailMetric key={item.market + "|" + item.model} label={item.market + " · " + item.model}
              value={metric ? "Brier " + metric.brierScore.toFixed(4) : "Brak rozliczeń"}
              detail={"Próba: " + item.count + (item.market === "DOUBLE_CHANCE" ? " zdarzeń DC" : " prognoz") + " / " + item.sampleMatches + " różnych meczów"
                + "; minimum do oceny: " + item.minimumSampleSize + " meczów; " + (item.sampleQualified ? "próba wystarczająca" : "PRÓBA ZA MAŁA")
                + "; log loss: " + (metric ? metric.logLoss.toFixed(4) : "—")
                + "; skuteczność: " + (metric ? (metric.accuracy * 100).toFixed(1) + "%" : "—")
                + "; ECE: " + (item.expectedCalibrationError === null ? "—" : item.expectedCalibrationError.toFixed(4))} />;
          })}</div><p className="source-note">Minimalna próbka kalibracji: {modelAudit.minimumSampleSize} różnych meczów na model i rynek. Wynik poniżej progu jest wyłącznie orientacyjny; ECE bliższe 0 oznacza lepszą kalibrację.</p></>}
          <div className="module-status"><span className="status-dot"/> Rozliczone: {modelAudit.settledPredictions} · oczekujące na wynik: {modelAudit.unmatchedPredictions} · nierozliczone w kolejce: {settling ? settleProgress : "—"}</div>
          <p className="source-note">Nie pokazujemy skuteczności dla prognoz bez wyniku. Metryki nie są wyliczane z typów odrzuconych bez prawdopodobieństw.</p>
        </section>}
        {active === "pick" && <section className="module-panel safest-pick-panel">
          <div className="module-icon"><Sparkles/></div><h2>Mecze wytypowane przez aplikację</h2>
          <p>Pokazujemy najnowszą zapisaną prognozę każdego rynku dla meczu. Procent jest prawdopodobieństwem przypisanym dokładnie do wskazanego typu, a nie gwarancją wyniku.</p>
          {safestPick && <div className="safest-pick-card"><span className="safest-pick-label">NAJMOCNIEJSZY KANDYDAT · NIE GWARANCJA</span><h3>{safestPick.title}</h3><b className="safest-pick-market">{safestPick.market} · {(safestPick.probability * 100).toFixed(1)}%</b><p>{safestPick.competition} · {safestPick.kickoff} (Europe/Brussels)</p><small>{safestPick.reason}</small></div>}
          {(() => {
            const ordered = getSelectedFixturePredictions(currentScanRecords, activeFixtureDate);
            const chosenProbability = (row: TrackerRecord | undefined, market: "1X2" | "DOUBLE_CHANCE") => {
              if (!row || typeof row.details.selection !== "string") return null;
              const key = market === "1X2" ? ({ "1":"p1", "X":"px", "2":"p2" } as Record<string,string>)[row.details.selection] : ({ "1X":"p1x", "X2":"px2", "12":"p12" } as Record<string,string>)[row.details.selection];
              const value = key ? row.details[key] : null;
              return typeof value === "number" && Number.isFinite(value) ? value : null;
            };
            const reasonFor = (row: TrackerRecord) => {
              const parts: string[] = [];
              if (typeof row.details.reason === "string" && row.details.reason) parts.push(String(row.details.reason));
              if (typeof row.details.expectedGoalsBasis === "string") parts.push(String(row.details.expectedGoalsBasis));
              if (typeof row.details.lambdaProxyHome === "number" && typeof row.details.lambdaProxyAway === "number") parts.push("Oczekiwane gole " + Number(row.details.lambdaProxyHome).toFixed(2) + "–" + Number(row.details.lambdaProxyAway).toFixed(2));
              if (typeof row.details.evidenceGaps === "string" && row.details.evidenceGaps) parts.push("Braki danych: " + String(row.details.evidenceGaps));
              return parts.length ? parts.join(" · ") : "Wybór na podstawie zapisanych prawdopodobieństw modelu; szczegóły danych źródłowych w Trackerze.";
            };
            const card = (row: TrackerRecord | undefined, market: "1X2" | "DOUBLE_CHANCE") => {
              if (!row) return <div className="selected-market-missing">Brak zapisanego typu dla tego rynku.</div>;
              const probability = chosenProbability(row,market);
              const eligible = isEvidenceQualifiedCandidate(row, market);
              const displayStatus = getPredictionDisplayStatus(row, market, probability);
              const preliminary = !eligible && row.details.evidenceComplete !== true && probability !== null;
              const pick = typeof row.details.selection === "string" ? row.details.selection : "Brak typu";
              return <div className="selected-market">
                <div className="selected-market-head"><b>{market === "1X2" ? "1X2" : "DOUBLE CHANCE"}</b><span className={"selected-status " + (eligible ? "eligible" : preliminary ? "preliminary" : "rejected")}>{displayStatus}</span></div>
                <div className="selected-pick">{pick}<strong>{probability === null ? "Brak %" : (probability * 100).toFixed(1) + "%"}</strong></div>
                {!eligible && probability !== null && <small className="prediction-probability-note">{preliminary ? "Wysokie prawdopodobieństwo modelu — prognoza wstępna. Nie oznacza potwierdzonego typu ani dopuszczenia do kuponu." : "To surowe prawdopodobieństwo modelu, a nie potwierdzona wiarygodność ani kwalifikacja do kuponu."}</small>}
                <p>{reasonFor(row)}</p>
                <small>Model: {String(row.details.predictionMethod ?? row.details.modelName ?? "nieznany")} · próbka: {String(row.details.historySampleCounts ?? "brak danych")}</small>
              </div>;
            };
            return <div className="selected-fixture-list">
              <div className="module-status"><span className="status-dot"/> Mecze z dnia {activeFixtureDate}: {ordered.length} · kandydaci 1X2 ≥75%: {ordered.filter(item => isEvidenceQualifiedCandidate(item.one, "1X2")).length} · kandydaci DC ≥75%: {ordered.filter(item => isEvidenceQualifiedCandidate(item.dc, "DOUBLE_CHANCE")).length}</div>
              {ordered.map(item => {
                const id = item.fixtureId;
                const row = item.one ?? item.dc!;
                return <article className="selected-fixture-card" key={id}>
                  <div className="selected-fixture-title"><div><b>{String(row.details.home ?? "Gospodarze")} – {String(row.details.away ?? "Goście")}</b><small>{String(row.details.competition ?? "Rozgrywki")} · {String(row.details.fixtureDate ?? "Data nieznana")} {String(row.details.fixtureTime ?? "")}</small></div><span>{item.one && item.dc ? "1X2 + DC" : item.one ? "1X2" : "DC"}</span></div>
                  <div className="selected-markets">{card(item.one,"1X2")}{card(item.dc,"DOUBLE_CHANCE")}</div>
                </article>;
              })}
              {!ordered.length && <div className="tracker-empty">Nie ma jeszcze zapisanych prognoz. Uruchom „Skanuj dzisiaj” i poczekaj na automatyczną analizę meczów.</div>}
            </div>;
          })()}
          <div className="module-status"><span className="status-dot"/> Łącznie zapisane rekordy prognoz: {records.filter(row => row.kind === "prediction").length}. Historia, kupony, rozliczenia i bankroll nie są modyfikowane przez ten widok.</div>
        </section>}

        <footer className="footer"><span>MONEYBALL — TRUST THE PROCESS</span><span>FRESH BUILD · DATA TRANSPARENCY FIRST</span></footer>
      </div>
    </main>
  </div>;
}
