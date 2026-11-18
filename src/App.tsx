import { useEffect, useMemo, useRef, useState } from "react";
import { scanTodayEuropeanFixtures, type FixtureScan, type FreeFixture } from "./free-fixtures";
import { addRecord, addRecordsIfMissing, exportBackup, exportCsv, importBackup, readRecords, removeRecord, type TrackerKind, type TrackerRecord } from "./tracker-store";
import { findOpenLigaFixtureResult, findOpenMatchdayResult, loadEspnRecentTeamForm, loadOpenLigaRecentTeamForm, loadRecentTeamForm, loadRecentTeamFormAcrossCountry, mergeVerifiedTeamForms, loadCalcioItSerieDTeamForm, type TeamForm } from "./team-form";
import { predictFromRecentForm, predictFromPitchApiXgForm, predictFromNeutralPrior, type FormPrediction } from "./form-prediction";
import { fetchPitchApiMatchLineups, fetchPitchApiXgFormsForFixture, type PitchApiLineups, type PitchApiXgForm } from "./pitchapi";
import { buildThreeLegCandidates } from "./coupon-engine";
import { findOpenFootballFixtureResult, loadOpenFootballRecentTeamForm } from "./openfootball";
import { buildPaperCouponSettlementRecord, evaluatePaperCoupon } from "./coupon-settlement";
import { uniquePendingPredictions } from "./pending-settlement";
import { auditTrackerPredictions } from "./model-audit";
import { describeHistoryProvenance, shouldAppendPrediction } from "./prediction-record";
import { getSafestPick, hasKickoffPassed, hasKnownKickoff } from "./safest-pick";
import { auditOddsFixtureMatches } from "./odds-matching";
import { buildBetSettlementRows } from "./bet-settlement";
import { listOddsBookmakers, shouldAutoFetchDailyOdds } from "./odds-value";
import { valueThreeLegCoupon } from "./coupon-value";
import { buildBaselineEvidenceAudit, getEvidenceGaps, isEvidenceAuditComplete } from "./analysis-evidence";
import {
  Activity, BarChart3, Bell, CalendarDays, ChevronRight, CircleDot,
  ClipboardList, Database, Gauge, LayoutDashboard, Menu, Plus, Search,
  ShieldCheck, Sparkles, Ticket, Trophy, X
} from "lucide-react";

const ODDS_PILOT_TOKEN_KEY = "moneyball.oddsPilotToken";
const STRIKER_DAILY_FETCH_KEY = "moneyball.strikerDailyFetchDate";
const STRIKER_DAILY_ATTEMPT_KEY = "moneyball.strikerDailyOddsAttemptDate";
const FALLBACK_RETRY_KEY = "moneyball.neutralFallbackRetryAt";
const FALLBACK_RETRY_INTERVAL_MS = 6 * 60 * 60 * 1000;

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

type Tab = "dashboard" | "matches" | "pick" | "coupons" | "intelligence" | "bets" | "tracker";

const nav: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "matches", label: "Mecze", icon: CalendarDays },
  { id: "pick", label: "Typ dnia", icon: Sparkles },
  { id: "coupons", label: "Kupony", icon: Ticket },
  { id: "intelligence", label: "Intelligence", icon: BarChart3 },
  { id: "bets", label: "Stawki", icon: Ticket },
  { id: "tracker", label: "Tracker", icon: ClipboardList },
];

const descriptions: Record<Tab, { eyebrow: string; title: string; subtitle: string }> = {
  dashboard: { eyebrow: "CENTRUM DOWODZENIA", title: "Trust the Process.", subtitle: "Przejrzysta analityka. Zweryfikowane dane. Każda decyzja z uzasadnieniem." },
  matches: { eyebrow: "CENTRUM MECZÓW", title: "Mecze", subtitle: "Europejskie rozgrywki, forma drużyn i komplet danych źródłowych." },
  pick: { eyebrow: "SELEKCJA DNIA", title: "Typ dnia", subtitle: "Jedna selekcja oparta na danych — albo uczciwa informacja, że dziś brak przewagi." },
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

function savePredictionRecord(
  match: FreeFixture,
  prediction?: FormPrediction,
  reason?: string,
  homeForm?: TeamForm,
  awayForm?: TeamForm,
  pitchApiXgForms?: { home: PitchApiXgForm; away: PitchApiXgForm },
  pitchApiLineups?: PitchApiLineups,
  comparisonPredictions: FormPrediction[] = [],
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
    historyProvenance: homeForm && awayForm ? JSON.stringify({
      home: { source: homeForm.source, sourceUpdatedAt: homeForm.sourceUpdatedAt, matches: homeForm.matches.length, homeMatches: homeForm.home.length, awayMatches: homeForm.away.length },
      away: { source: awayForm.source, sourceUpdatedAt: awayForm.sourceUpdatedAt, matches: awayForm.matches.length, homeMatches: awayForm.home.length, awayMatches: awayForm.away.length },
      cutoffDateExclusive: match.date,
    }) : null,
    evidenceComplete: evidenceAudit.complete, evidenceAudit: JSON.stringify(evidenceAudit),
    evidenceGaps: getEvidenceGaps(evidenceAudit).join(", "),
  };
  let current = readRecords();
  for (const variant of uniqueVariants) {
    const method = variant?.method ?? "unavailable", model = "moneyball:" + method;
    const probabilities = variant?.prediction.probabilities, dc = variant?.prediction.doubleChance;
    const sampleValues = variant ? Object.values(variant.samples) : [];
    const couponEligible = !!variant && method !== "neutral-prior-poisson" && sampleValues.length === 4
      && sampleValues.every(value => Number.isFinite(value) && value >= 3) && hasKnownKickoff(match.date, match.time);
    const topProbability = variant?.topProbability ?? null;
    const strongCandidate = couponEligible && typeof topProbability === "number" && topProbability >= 0.75;
    const dcOptions = [{ selection: "1X", probability: dc?.oneX ?? null }, { selection: "X2", probability: dc?.xTwo ?? null }, { selection: "12", probability: dc?.oneTwo ?? null }];
    const bestDc = dcOptions.filter(item => typeof item.probability === "number").sort((a, b) => (b.probability as number) - (a.probability as number))[0];
    const dcProbability = typeof bestDc?.probability === "number" ? bestDc.probability : null;
    const strongDoubleChance = couponEligible && dcProbability !== null && dcProbability >= 0.75;
    const common = {
      ...shared, model, modelName: method, predictionMethod: variant?.method ?? null, modelMethod: variant?.method ?? null,
      expectedGoalsBasis: method === "pitchapi-recent-xg-poisson" ? "historyczne xG/xGA PitchAPI" : method === "recent-form-goals-poisson" ? "wyniki i gole historyczne (nie xG)" : "brak danych zespołów",
      lambdaProxyHome: variant?.prediction.expectedGoals.home ?? null, lambdaProxyAway: variant?.prediction.expectedGoals.away ?? null,
      sampleCounts: variant ? JSON.stringify(variant.samples) : null, couponEligible,
      reason: reason ?? (!couponEligible ? "ODRZUCONY: model wymaga co najmniej 3 wcześniejszych meczów dla obu drużyn oraz zweryfikowanej godziny rozpoczęcia." : null),
    };
    const oneXTwoDetails = { ...common, market: "1X2", selection: variant?.pick ?? null,
      p1: probabilities?.home ?? null, px: probabilities?.draw ?? null, p2: probabilities?.away ?? null,
      dc1x: dc?.oneX ?? null, dcx2: dc?.xTwo ?? null, dc12: dc?.oneTwo ?? null,
      topProbability, strongCandidate, source: match.source };
    if (shouldAppendPrediction(current, match.id, model, !!probabilities, method, "1X2")) {
      addRecord({ kind: "prediction", title: match.date + " · " + match.home + " vs " + match.away + " · 1X2 · " + method,
        status: strongCandidate ? "KANDYDAT" : "ODRZUCONY", details: oneXTwoDetails });
      current = readRecords();
    }
    const dcDetails = { ...common, market: "DOUBLE_CHANCE", selection: bestDc?.selection ?? null, probability: dcProbability,
      p1x: dc?.oneX ?? null, px2: dc?.xTwo ?? null, p12: dc?.oneTwo ?? null,
      strongCandidate: false, strongDoubleChance, source: match.source,
      reason: reason ?? (!couponEligible ? "ODRZUCONY: brak minimalnej próbki lub wiarygodnej godziny meczu." : dcProbability === null ? "Brak prawidłowych prawdopodobieństw Double Chance." : dcProbability < 0.75 ? "Najwyższe prawdopodobieństwo Double Chance poniżej 75%." : null) };
    if (shouldAppendPrediction(current, match.id, model, !!dc, method, "DOUBLE_CHANCE")) {
      addRecord({ kind: "prediction", title: match.date + " · " + match.home + " vs " + match.away + " · DOUBLE CHANCE · " + method,
        status: strongDoubleChance ? "KANDYDAT" : "ODRZUCONY", details: dcDetails });
      current = readRecords();
    }
  }
  return current;
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
  const [oddsProviderStatus, setOddsProviderStatus] = useState<{ strikerapi: boolean; pilotEnabled: boolean } | null>(null);
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
  const [settleProgress, setSettleProgress] = useState(0);
  const [scanError, setScanError] = useState("");
  const [teamForms, setTeamForms] = useState<Record<string, { home?: TeamForm; away?: TeamForm; pitchApiXgForms?: { home: PitchApiXgForm; away: PitchApiXgForm }; pitchApiLineups?: PitchApiLineups; prediction?: FormPrediction; predictionError?: string; loading: boolean; error?: string }>>({});
  const loadFixtureForms = async (match: NonNullable<typeof fixtureScan>["fixtures"][number]) => {
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
    setTeamForms(current => ({ ...current, [match.id]: { home: homeForm, away: awayForm, pitchApiXgForms, pitchApiLineups, prediction, predictionError, loading: false } }));
    setRecords(savePredictionRecord(match, prediction, predictionError, homeForm, awayForm, pitchApiXgForms, pitchApiLineups, comparisonPredictions));
  };
  const analyzeAllFixtures = async (fixtures?: FreeFixture[]) => {
    const sourceMatches = fixtures ?? fixtureScan?.fixtures;
    if (!sourceMatches || bulkAnalysisLock.current || (!fixtures && scanLoading)) return;
    const latestByFixture = new Map<string, TrackerRecord>();
    for (const row of readRecords()) {
      if (row.kind === "prediction" && row.details.market !== "DOUBLE_CHANCE" && typeof row.details.fixtureId === "string" && !latestByFixture.has(row.details.fixtureId)) latestByFixture.set(row.details.fixtureId, row);
    }
    const matches = [...new Map(sourceMatches.map(match => [match.id, match])).values()].filter(match => {
      if (hasKickoffPassed(match.date, match.time)) return false;
      const prior = latestByFixture.get(match.id);
      const missingProbabilities = !prior || typeof prior.details.p1 !== "number" || typeof prior.details.px !== "number" || typeof prior.details.p2 !== "number";
      // Neutral-prior rows are explicit placeholders, not finished forecasts. Retry them at most every six hours
      // so newly published history/xG can replace them without hammering free providers on each 15-minute scan.
      return missingProbabilities || shouldRetryNeutralFallback(match.id, prior);
    });
    if (!matches.length) { setRecords(readRecords()); return; }
    bulkAnalysisLock.current = true;
    setBulkLoading(true);
    setBulkProgress(0);
    const concurrency = 2;
    try {
      for (let index = 0; index < matches.length; index += concurrency) {
        const batch = matches.slice(index, index + concurrency);
        await Promise.all(batch.map(match => loadFixtureForms(match)));
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
    if (lastOddsFetchDate === fixtureScan.date) {
      setOddsNotice(`Kursy UTC ${fixtureScan.date} zostały już pobrane. Kolejne zapytanie kosztuje ponownie 10 kredytów. Odblokuj je świadomie poniżej.`);
      return;
    }
    if (!oddsTokenSaved || token.length < 32) {
      setOddsNotice("Najpierw zapisz token dostępu. Musi być identyczny z sekretem ODDS_PILOT_TOKEN w Cloudflare.");
      return;
    }
    // Persist the attempt before making a paid-credit call. This is a synchronous
    // guard against React StrictMode, page reloads and repeated 15-minute scans.
    let attemptedDate = "";
    try { attemptedDate = localStorage.getItem(STRIKER_DAILY_ATTEMPT_KEY) ?? ""; } catch { /* storage may be unavailable */ }
    if (attemptedDate === fixtureScan.date || lastOddsAttemptDate === fixtureScan.date) return;
    try { localStorage.setItem(STRIKER_DAILY_ATTEMPT_KEY, fixtureScan.date); } catch { /* best-effort persistence */ }
    setLastOddsAttemptDate(fixtureScan.date);
    setOddsLoading(true);
    setOddsNotice("");
    try {
      const utcDate = fixtureScan.date;
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
          const capturedAt = book.capturedAt || striker.capturedAt || new Date().toISOString();
          const snapshotKey = [fixture.id, "StrikerAPI", book.name, capturedAt].join("|");
          return [{
            kind: "odds" as const,
            title: `${fixture.home} vs ${fixture.away} · ${book.name}`,
            status: book.complete1X2 ? "COMPLETE_1X2" : "INCOMPLETE_1X2",
            details: {
              snapshotKey,
              fixtureId: fixture.id,
              fixtureDate: fixture.date,
              fixtureTime: fixture.time,
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
      setOddsNotice(`Pobrano ${games.length} meczów z StrikerAPI. Dopasowano ${audit.matched.length}; niejednoznaczne ${audit.ambiguousFixtureIds.length}; zapisano ${added} nowych snapshotów kursów. Nie dopasowane mecze nie są zgadywane.`);
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
    if (shouldAutoFetchDailyOdds({
      fixtureDate: fixtureScan.date,
      tokenSaved: oddsTokenSaved,
      providerReady: oddsProviderStatus?.strikerapi === true && oddsProviderStatus.pilotEnabled === true,
      lastSuccessfulDate: lastOddsFetchDate,
      lastAttemptedDate: lastOddsAttemptDate,
    })) void fetchDailyOdds();
  }, [fixtureScan, oddsTokenSaved, oddsProviderStatus, lastOddsFetchDate, lastOddsAttemptDate]);
  useEffect(() => {
    let active = true;
    void fetch("/api/odds/status").then(async response => {
      if (!response.ok) throw new Error("odds_status_unavailable");
      return response.json() as Promise<{ providers?: { strikerapi?: boolean }; pilotEnabled?: boolean }>;
    }).then(payload => {
      if (active) setOddsProviderStatus({ strikerapi: payload.providers?.strikerapi === true, pilotEnabled: payload.pilotEnabled === true });
    }).catch(() => {
      if (active) setOddsProviderStatus({ strikerapi: false, pilotEnabled: false });
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
  const predictionDiagnostics = useMemo(() => {
    const latestByFixtureMarketModel = new Map<string, TrackerRecord>();
    for (const row of [...records].filter(item => item.kind === "prediction").sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))) {
      const fixtureId = row.details.fixtureId;
      if (typeof fixtureId !== "string") continue;
      const market = row.details.market === "DOUBLE_CHANCE" ? "DOUBLE_CHANCE" : "1X2";
      const model = typeof row.details.model === "string" ? row.details.model : "legacy";
      const key = fixtureId + "|" + market + "|" + model;
      if (!latestByFixtureMarketModel.has(key)) latestByFixtureMarketModel.set(key, row);
    }
    const oneXTwo = [...latestByFixtureMarketModel.values()].filter(row => row.details.market !== "DOUBLE_CHANCE");
    const doubleChance = [...latestByFixtureMarketModel.values()].filter(row => row.details.market === "DOUBLE_CHANCE");
    const fixtures = new Set(oneXTwo.map(row => String(row.details.fixtureId)));
    const candidates = new Set(oneXTwo.filter(row => row.details.strongCandidate === true && row.status === "KANDYDAT").map(row => String(row.details.fixtureId)));
    const dcCandidates = new Set(doubleChance.filter(row => row.details.strongDoubleChance === true && row.status === "KANDYDAT").map(row => String(row.details.fixtureId)));
    const withProbabilities = new Set(oneXTwo.filter(row => [row.details.p1, row.details.px, row.details.p2].every(value => typeof value === "number" && Number.isFinite(value))).map(row => String(row.details.fixtureId)));
    const latestPerFixture = new Map<string, TrackerRecord>();
    for (const row of oneXTwo.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))) {
      const id = String(row.details.fixtureId); if (!latestPerFixture.has(id)) latestPerFixture.set(id, row);
    }
    const rejected = [...latestPerFixture.values()].filter(row => !candidates.has(String(row.details.fixtureId)));
    const reasons = new Map<string, number>();
    for (const row of rejected) { const reason = String(row.details.reason ?? "Nie zapisano konkretnego powodu"); reasons.set(reason, (reasons.get(reason) ?? 0) + 1); }
    return { total: fixtures.size, rejected: rejected.length, candidates: candidates.size, dcCandidates: dcCandidates.size,
      withoutProbabilities: fixtures.size - withProbabilities.size, reasons: [...reasons.entries()].sort((a, b) => b[1] - a[1]),
      oneXTwoRecords: oneXTwo.length, doubleChanceRecords: doubleChance.length };
  }, [records]);
  const safestPick = useMemo(() => getSafestPick(records), [records]);
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
          <section className="module-panel dashboard-safest-pick"><div className="module-icon"><Sparkles/></div><div><span className="safest-pick-label">JEDEN NAJMOCNIEJSZY TYP DNIA</span>{safestPick ? <><h2>{safestPick.title}</h2><b>{safestPick.market} · {(safestPick.probability*100).toFixed(1)}%</b><p>{safestPick.competition} · {safestPick.kickoff}</p><small>{safestPick.reason}</small></> : <p>Brak potwierdzonego kandydata DC ≥75%. Po analizie meczów pokażemy jeden wybór tylko wtedy, gdy spełni kryteria.</p>}<button className="text-link" onClick={() => changeTab("pick")}>Otwórz szczegóły selekcji <ChevronRight size={14}/></button></div></section>
          <section className="metrics-grid"><Metric label="Dzisiejsze mecze" value={fixtureScan ? String(fixtureScan.fixtures.length) : "—"} note={fixtureScan ? `Europa · ${fixtureScan.leaguesChecked} kanałów · otwórz terminarz` : scanError ? "Źródło chwilowo niedostępne" : "Pobieranie terminarzy"} icon={CalendarDays} onClick={() => changeTab("matches")}/><Metric label="Prognozy" value={String(predictionDiagnostics.total)} note={`${predictionDiagnostics.candidates} kandydatów · ${predictionDiagnostics.rejected} odrzuconych`} icon={Gauge} onClick={() => changeTab("intelligence")}/><Metric label="Aktywne kupony" value={String(records.filter(row => row.kind === "coupon" && ["PAPER_NO_ODDS", "PAPER_WITH_ODDS"].includes(row.status) && !records.some(child => child.kind === "coupon" && child.details.parentCouponId === row.id)).length)} note="Otwórz kupony i zobacz szczegóły" icon={Ticket} onClick={() => changeTab("coupons")}/><Metric label="Tracker" value={String(records.length)} note="Historia i zapisane dane lokalne" icon={Database} onClick={() => changeTab("tracker")}/></section>
          <section className="matches-preview"><div className="panel-heading"><div><h3>Dzisiaj w Europie</h3><p>{fixtureScan ? `open-matchday build: ${new Date(fixtureScan.generatedAt).toLocaleString("pl-BE")}` : "Darmowy terminarz publiczny · PitchAPI przez bezpieczny Worker"}</p></div><button onClick={() => void runFixtureScan(true)} disabled={scanLoading}>{scanLoading ? "Pobieranie…" : "Odśwież"}</button></div>{scanError && <p className="scan-error">{scanError}</p>}{fixtureScan?.fixtures.slice(0,6).map(match => <div className="match-preview-row" key={match.id}><time>{match.time}</time><b>{match.home}</b><span>vs</span><b>{match.away}</b><small>{match.competition}</small><details className="fixture-details"><summary>Szczegóły meczu</summary><p>Data i czas: {match.date} · {match.time} (Europe/Brussels)</p><p>Kraj / federacja: {match.countryCode}</p><p>Źródła: {match.source}</p><p>Aktualizacja źródła: {match.sourceUpdatedAt}</p><p>Identyfikator meczu: {match.id}</p><p>Folder historii: {match.leagueFolder || "brak"} · OpenLigaDB: {match.leagueShortcut || "brak"} / {match.leagueSeason || "brak"} · OpenFootball: {match.openFootballFeedId || "brak"} · PitchAPI: {match.pitchApiMatchId || "brak"} / liga {match.pitchApiLeagueId || "brak"}</p>{match.sourceUrl ? <a href={match.sourceUrl} target="_blank" rel="noreferrer">Otwórz źródło meczu</a> : <span>Brak bezpośredniego linku źródłowego</span>}</details>{match.sourceUrl ? <a href={match.sourceUrl} target="_blank" rel="noreferrer">Źródło</a> : null}</div>)}{fixtureScan && fixtureScan.fixtures.length === 0 && <div className="empty-state"><b>Brak zaplanowanych meczów w pobranych źródłach</b><span>To nie potwierdza braku meczów we wszystkich rozgrywkach Europy. Sprawdź liczbę błędów i katalogów w zakładce Mecze.</span></div>}<div className="source-note">Źródła: <a href="https://github.com/oladeeayo/open-matchday" target="_blank" rel="noreferrer">open-matchday</a> (użytek niekomercyjny) · <a href="https://www.openligadb.de/" target="_blank" rel="noreferrer">OpenLigaDB</a> · <a href="https://github.com/openfootball/europe" target="_blank" rel="noreferrer">OpenFootball</a> · <a href="https://www.espn.com/soccer/scoreboard" target="_blank" rel="noreferrer">ESPN</a> · <a href="https://footynomad.com/fixtures/" target="_blank" rel="noreferrer">FootyNomad</a> · <a href="https://timezone.football/about/data/" target="_blank" rel="noreferrer">timezone.football</a> · <a href="https://pitchapi.dev/" target="_blank" rel="noreferrer">PitchAPI</a> (xG, strzały, składy i analityka meczowa; zależnie od ligi). Pokrycie zależy od aktualnych plików dostawców.</div><button className="text-link" onClick={() => changeTab("matches")}>Pokaż wszystkie mecze <ChevronRight size={14}/></button></section>
          <section className="lower-grid"><article className="panel"><div className="panel-heading"><div><h3>Ostatnia aktywność</h3><p>Rzeczywiste zdarzenia w lokalnym Trackerze</p></div><Activity size={18}/></div>{records.length ? <div className="check-list">{[...records].sort((a,b) => b.createdAt.localeCompare(a.createdAt)).slice(0,5).map(row => <div className="check-row" key={row.id}><span>{row.kind.toUpperCase().slice(0,3)}</span><div><b>{row.title}</b><small>{new Date(row.createdAt).toLocaleString("pl-BE")}</small></div><i>{row.status}</i></div>)}</div> : <div className="empty-state"><div className="empty-icon"><Activity size={21}/></div><b>Brak zapisanych zdarzeń</b><span>Po pierwszym skanie, prognozie lub rozliczeniu historia pojawi się tutaj.</span></div>}</article><article className="panel"><div className="panel-heading"><div><h3>Stan etapów platformy</h3><p>Rzeczywisty zakres wdrożenia</p></div><Trophy size={18}/></div><div className="check-list"><div className="check-row done"><span>01</span><div><b>Fundament, PWA i publikacja</b><small>Oddzielny Cloudflare Worker i automatyczny deploy</small></div><i>DONE</i></div><div className="check-row done"><span>02</span><div><b>Tracker, kopie JSON i walidacja</b><small>Lokalny rejestr z importem łączonym</small></div><i>DONE</i></div><div className="check-row"><span>03</span><div><b>Europejskie źródła terminarzy</b><small>7 publicznych źródeł; pokrycie nie jest kompletne</small></div><i>ACTIVE</i></div><div className="check-row"><span>04</span><div><b>Forma, prognozy i kupony testowe</b><small>Oddzielny model historycznego xG PitchAPI; kursy i kalibracja nadal wymagają weryfikacji</small></div><i>ACTIVE</i></div><div className="check-row"><span>05</span><div><b>Audyt i testy końcowe</b><small>CI, testy i deploy potwierdzone; wizualny test Androida niepotwierdzony</small></div><i>LIMIT</i></div></div></article></section>
        </>}

        {active === "matches" && <section className="tracker-panel"><div className="tracker-toolbar"><div><h2>Europejski terminarz</h2><p>{fixtureScan ? `${fixtureScan.fixtures.length} meczów na ${fixtureScan.date} · ${fixtureScan.leaguesChecked} jednostek źródeł sprawdzonych` : "Darmowe źródła danych · klucz PitchAPI pozostaje po stronie serwera"}</p></div><div className="match-toolbar-actions"><button className="primary-button" onClick={() => void runFixtureScan(true)} disabled={scanLoading || bulkLoading}>{scanLoading ? "Skanowanie…" : "Skanuj dzisiaj"}</button><button onClick={() => void analyzeAllFixtures()} disabled={!fixtureScan || bulkLoading || scanLoading || fixtureScan.fixtures.length === 0}>{bulkLoading ? `Analiza ${bulkProgress}/${fixtureScan?.fixtures.length ?? 0}` : `Analizuj wszystkie (${fixtureScan?.fixtures.length ?? 0})`}</button></div></div>{scanError && <p className="scan-error">{scanError}</p>}{bulkLoading && <p className="source-note">Przetworzono {bulkProgress} z {fixtureScan?.fixtures.length ?? 0} meczów.</p>}{fixtureScan && <p className="source-note">Źródła — open-matchday: {fixtureScan.coverage.openMatchday.cataloguesChecked} katalogów, {fixtureScan.coverage.openMatchday.fixtures} meczów, {fixtureScan.coverage.openMatchday.errors} błędów · OpenLigaDB: {fixtureScan.coverage.openLigaDB.competitionsChecked} rozgrywek, {fixtureScan.coverage.openLigaDB.fixtures} meczów, {fixtureScan.coverage.openLigaDB.errors} błędów · openfootball: {fixtureScan.coverage.openFootball.feedsChecked} plików, {fixtureScan.coverage.openFootball.fixtures} meczów, {fixtureScan.coverage.openFootball.errors} błędów · ESPN: {fixtureScan.coverage.espn.scoreboardsChecked} scoreboard, {fixtureScan.coverage.espn.fixtures} meczów, {fixtureScan.coverage.espn.errors} błędów · <a href={`https://footynomad.com/fixtures/${fixtureScan.date}`} target="_blank" rel="noreferrer">FootyNomad</a>: {fixtureScan.coverage.footyNomad.pagesChecked} stron dziennych, {fixtureScan.coverage.footyNomad.pageMatches} wpisów europejskich z 2 dat UTC, {fixtureScan.coverage.footyNomad.fixtures} meczów europejskich, {fixtureScan.coverage.footyNomad.skippedNoTimestamp} bez czasu pominięto, {fixtureScan.coverage.footyNomad.errors} błędów · <a href="https://timezone.football/about/data/" target="_blank" rel="noreferrer">timezone.football</a>: {fixtureScan.coverage.timezoneFootball.feedMatches} meczów w 14-dniowym feedzie, {fixtureScan.coverage.timezoneFootball.fixtures} na ten dzień, feed z {fixtureScan.coverage.timezoneFootball.generatedAt || "brak daty"}, {fixtureScan.coverage.timezoneFootball.errors} błędów · PitchAPI feed dzienny: {fixtureScan.coverage.pitchApi?.fixtures ?? 0} meczów, {fixtureScan.coverage.pitchApi?.europeanFixtures ?? 0} europejskich po weryfikacji kraju · katalog: {fixtureScan.coverage.pitchApi?.catalogueLeagues ?? 0} lig, {fixtureScan.coverage.pitchApi?.europeanCatalogueLeagues ?? 0} europejskich, {fixtureScan.coverage.pitchApi?.freeEuropeanCatalogueLeagues ?? 0} bezpłatnych europejskich, {fixtureScan.coverage.pitchApi?.skippedNonFreeCatalogueLeagues ?? 0} płatnych pominięto, {fixtureScan.coverage.pitchApi?.catalogueUpcomingFixtures ?? 0} nadchodzących w sezonach, {fixtureScan.coverage.pitchApi?.catalogueDateFixtures ?? 0} na dzisiejszą datę · {fixtureScan.coverage.pitchApi?.errors ?? 0} błędów. Duplikaty źródeł są scalane.</p>}{fixtureScan && <p className="source-note">Zakres pokrycia zależy od dostępności publicznych katalogów i plików. Brak błędów pobierania nie oznacza kompletności wszystkich lig, poziomów regionalnych, kobiecych ani młodzieżowych w Europie.</p>}{fixtureScan?.leaguesFailed.length ? <details className="scan-warnings"><summary>Błędy pobierania: {fixtureScan.leaguesFailed.length} źródeł lub rozgrywek</summary>{fixtureScan.leaguesFailed.map(error => <p key={error}>{error}</p>)}</details> : null}<div className="tracker-search"><Search size={16}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Szukaj drużyny lub ligi…"/><span>{fixtureScan?.fixtures.filter(m => `${m.home} ${m.away} ${m.competition}`.toLowerCase().includes(query.toLowerCase())).length ?? 0} meczów</span></div><div className="fixture-list">{fixtureScan?.fixtures.filter(m => `${m.home} ${m.away} ${m.competition}`.toLowerCase().includes(query.toLowerCase())).map(match => <div className="fixture-row fixture-row-expanded" key={match.id}><time>{match.time}</time><div><b>{match.home}</b><span>{match.away}</span></div><small>{match.competition}</small><details className="fixture-details"><summary>Szczegóły meczu</summary><p>Data i czas: {match.date} · {match.time} (Europe/Brussels)</p><p>Kraj / federacja: {match.countryCode}</p><p>Źródła: {match.source}</p><p>Aktualizacja źródła: {match.sourceUpdatedAt}</p><p>Identyfikator meczu: {match.id}</p><p>Folder historii: {match.leagueFolder || "brak"} · OpenLigaDB: {match.leagueShortcut || "brak"} / {match.leagueSeason || "brak"} · OpenFootball: {match.openFootballFeedId || "brak"} · PitchAPI: {match.pitchApiMatchId || "brak"} / liga {match.pitchApiLeagueId || "brak"}</p>{match.sourceUrl ? <a href={match.sourceUrl} target="_blank" rel="noreferrer">Otwórz źródło meczu</a> : <span>Brak bezpośredniego linku źródłowego</span>}</details>{(() => {
              const matchOdds = records.filter(row => row.kind === "odds" && row.status === "COMPLETE_1X2" && row.details.fixtureId === match.id && row.details.complete1X2 === true)
                .sort((left, right) => Date.parse(String(right.details.capturedAt ?? "")) - Date.parse(String(left.details.capturedAt ?? ""))).slice(0, 3);
              const price = (value: unknown) => typeof value === "number" && value > 1 ? value.toFixed(2) : "—";
              return <div className="source-note"><b>Kursy 1X2:</b> {matchOdds.length ? matchOdds.map(row => <span key={row.id} style={{ display: "block" }}>{String(row.details.bookmaker ?? "Bukmacher")} · 1 {price(row.details.odds1)} / X {price(row.details.oddsX)} / 2 {price(row.details.odds2)}{typeof row.details.homeHandicapClose === "number" && typeof row.details.handicapHomeOdds === "number" && typeof row.details.handicapAwayOdds === "number" ? ` · AH ${row.details.homeHandicapClose} (1 ${price(row.details.handicapHomeOdds)} / 2 ${price(row.details.handicapAwayOdds)})` : ""}{typeof row.details.totalClose === "number" && typeof row.details.overOdds === "number" && typeof row.details.underOdds === "number" ? ` · O/U ${row.details.totalClose} (O ${price(row.details.overOdds)} / U ${price(row.details.underOdds)})` : ""} · {row.details.capturedAt ? new Date(String(row.details.capturedAt)).toLocaleString("pl-BE") : "czas nieznany"}</span>) : "brak potwierdzonego kursu dla tego meczu w ostatnim odczycie dostawcy"}</div>;
            })()}{match.sourceUrl ? <a href={match.sourceUrl} target="_blank" rel="noreferrer">Źródło</a> : null}<button className="form-button" onClick={() => void loadFixtureForms(match)} disabled={teamForms[match.id]?.loading || !hasKnownKickoff(match.date, match.time) || hasKickoffPassed(match.date, match.time)}>{teamForms[match.id]?.loading ? "Ładowanie…" : "Forma 5 + typ"}</button>{teamForms[match.id]?.error && <p className="scan-error">{teamForms[match.id].error}</p>}{records.find(row => row.kind === "prediction" && row.details.fixtureId === match.id)?.status === "ODRZUCONY" && <p className="scan-error">TYP ODRZUCONY: {String(records.find(row => row.kind === "prediction" && row.details.fixtureId === match.id)?.details.reason ?? "Brak uzasadnienia — wymaga ponownej analizy.")}</p>}{teamForms[match.id]?.home && teamForms[match.id]?.away && <div className="team-form-panel"><div><b>{match.home} · ostatnie mecze</b>{teamForms[match.id].home!.matches.map((item,i)=><small key={item.date+i}>{item.date} · {item.venue==="H"?"D":"W"} · {item.goalsFor}:{item.goalsAgainst} · {item.result} · {item.opponent}</small>)}</div><div><b>{match.away} · ostatnie mecze</b>{teamForms[match.id].away!.matches.map((item,i)=><small key={item.date+i}>{item.date} · {item.venue==="H"?"D":"W"} · {item.goalsFor}:{item.goalsAgainst} · {item.result} · {item.opponent}</small>)}</div><p>Źródła: {teamForms[match.id].home!.source} / {teamForms[match.id].away!.source} · tylko zakończone mecze przed datą spotkania. D=dom, W=wyjazd.</p>{teamForms[match.id].prediction && <div className="form-prediction"><b>Prognoza 1X2 · {teamForms[match.id].prediction!.pick} ({Math.round(teamForms[match.id].prediction!.topProbability * 100)}%)</b><span>1: {Math.round(teamForms[match.id].prediction!.prediction.probabilities.home * 100)}% · X: {Math.round(teamForms[match.id].prediction!.prediction.probabilities.draw * 100)}% · 2: {Math.round(teamForms[match.id].prediction!.prediction.probabilities.away * 100)}%</span><span>DC: 1X {Math.round(teamForms[match.id].prediction!.prediction.doubleChance.oneX * 100)}% · X2 {Math.round(teamForms[match.id].prediction!.prediction.doubleChance.xTwo * 100)}% · 12 {Math.round(teamForms[match.id].prediction!.prediction.doubleChance.oneTwo * 100)}%</span><small>{teamForms[match.id].prediction!.method === "pitchapi-recent-xg-poisson" ? "xG z historii PitchAPI" : teamForms[match.id].prediction!.method === "neutral-prior-poisson" ? "prior awaryjny (bez historii drużyn)" : "λ z goli (NIE xG)"}: {teamForms[match.id].prediction!.prediction.expectedGoals.home.toFixed(2)}–{teamForms[match.id].prediction!.prediction.expectedGoals.away.toFixed(2)} · próby: {teamForms[match.id].prediction!.samples.homeAttack}/{teamForms[match.id].prediction!.samples.awayAttack}</small><small>{teamForms[match.id].prediction!.note}</small><small>Kontrola 8 obszarów: xG/xGA, potwierdzone składy, kontuzje, zawieszenia, strzały/sytuacje, taktyka, zmęczenie terminarzem, kursy i EV. Brak zweryfikowanych danych blokuje status kandydata i kupony.</small>{teamForms[match.id].prediction!.strongCandidate && <small>Najwyższe prawdopodobieństwo ≥75% — kandydat do puli, nie gwarancja.</small>}</div>}{teamForms[match.id].predictionError && <p className="scan-error">Prognoza niedostępna: {teamForms[match.id].predictionError}</p>}</div>}{teamForms[match.id]?.pitchApiXgForms && <div className="team-form-panel"><div><b>{match.home} · PitchAPI xG</b><small>xG/mecz: {teamForms[match.id]!.pitchApiXgForms!.home.xgForPerMatch?.toFixed(2) ?? "brak"} · xGA/mecz: {teamForms[match.id]!.pitchApiXgForms!.home.xgAgainstPerMatch?.toFixed(2) ?? "brak"}</small><small>Strzały/mecz: {teamForms[match.id]!.pitchApiXgForms!.home.shotsForPerMatch?.toFixed(1) ?? "brak"} · celne: {teamForms[match.id]!.pitchApiXgForms!.home.shotsOnTargetForPerMatch?.toFixed(1) ?? "brak"}</small><small>xGOT/mecz: {teamForms[match.id]!.pitchApiXgForms!.home.xgOnTargetForPerMatch?.toFixed(2) ?? "brak"} · duże sytuacje: {teamForms[match.id]!.pitchApiXgForms!.home.bigChancesForPerMatch?.toFixed(1) ?? "brak"} · PPDA: {teamForms[match.id]!.pitchApiXgForms!.home.ppdaPerMatch?.toFixed(1) ?? "brak"} · field tilt: {teamForms[match.id]!.pitchApiXgForms!.home.fieldTiltPerMatch?.toFixed(1) ?? "brak"}% · wejścia w pole karne: {teamForms[match.id]!.pitchApiXgForms!.home.boxEntriesPerMatch?.toFixed(1) ?? "brak"} · próbka: {teamForms[match.id]!.pitchApiXgForms!.home.sampleSize}</small></div><div><b>{match.away} · PitchAPI xG</b><small>xG/mecz: {teamForms[match.id]!.pitchApiXgForms!.away.xgForPerMatch?.toFixed(2) ?? "brak"} · xGA/mecz: {teamForms[match.id]!.pitchApiXgForms!.away.xgAgainstPerMatch?.toFixed(2) ?? "brak"}</small><small>Strzały/mecz: {teamForms[match.id]!.pitchApiXgForms!.away.shotsForPerMatch?.toFixed(1) ?? "brak"} · celne: {teamForms[match.id]!.pitchApiXgForms!.away.shotsOnTargetForPerMatch?.toFixed(1) ?? "brak"}</small><small>xGOT/mecz: {teamForms[match.id]!.pitchApiXgForms!.away.xgOnTargetForPerMatch?.toFixed(2) ?? "brak"} · duże sytuacje: {teamForms[match.id]!.pitchApiXgForms!.away.bigChancesForPerMatch?.toFixed(1) ?? "brak"} · PPDA: {teamForms[match.id]!.pitchApiXgForms!.away.ppdaPerMatch?.toFixed(1) ?? "brak"} · field tilt: {teamForms[match.id]!.pitchApiXgForms!.away.fieldTiltPerMatch?.toFixed(1) ?? "brak"}% · wejścia w pole karne: {teamForms[match.id]!.pitchApiXgForms!.away.boxEntriesPerMatch?.toFixed(1) ?? "brak"} · próbka: {teamForms[match.id]!.pitchApiXgForms!.away.sampleSize}</small></div><p>Źródło: PitchAPI · tylko zakończone spotkania przed datą meczu · xG nie jest mieszane z innymi dostawcami.</p></div>}{teamForms[match.id]?.pitchApiLineups && <div className="team-form-panel"><div><b>{match.home} · {teamForms[match.id]!.pitchApiLineups!.home.confirmed ? "SKŁAD POTWIERDZONY" : "SKŁAD PRZEWIDYWANY"}</b><small>Ustawienie: {teamForms[match.id]!.pitchApiLineups!.home.formation ?? "brak"} · trener: {teamForms[match.id]!.pitchApiLineups!.home.coach?.name ?? "brak"}</small><small>{teamForms[match.id]!.pitchApiLineups!.home.starters?.map(player => player.name).join(", ") || "Brak danych o jedenastce"}</small></div><div><b>{match.away} · {teamForms[match.id]!.pitchApiLineups!.away.confirmed ? "SKŁAD POTWIERDZONY" : "SKŁAD PRZEWIDYWANY"}</b><small>Ustawienie: {teamForms[match.id]!.pitchApiLineups!.away.formation ?? "brak"} · trener: {teamForms[match.id]!.pitchApiLineups!.away.coach?.name ?? "brak"}</small><small>{teamForms[match.id]!.pitchApiLineups!.away.starters?.map(player => player.name).join(", ") || "Brak danych o jedenastce"}</small></div><p>Źródło: PitchAPI · tylko pole confirmed=true po obu stronach i pełne 11 nazwisk uznaje składy za potwierdzone. Przewidywany skład nie potwierdza dostępności zawodnika ani braku kontuzji.</p></div>}</div>)}{fixtureScan && fixtureScan.fixtures.length === 0 && <div className="tracker-empty">Brak meczów w pobranych źródłach na dziś. Nie oznacza to, że wszystkie europejskie rozgrywki zostały potwierdzone.</div>}</div><p className="source-note">Źródła: <a href="https://github.com/oladeeayo/open-matchday" target="_blank" rel="noreferrer">open-matchday</a> (CSV, użytek niekomercyjny) + <a href="https://www.openligadb.de/" target="_blank" rel="noreferrer">OpenLigaDB</a> (API) + <a href="https://github.com/openfootball/europe" target="_blank" rel="noreferrer">OpenFootball</a> (public domain) + <a href="https://www.espn.com/soccer/scoreboard" target="_blank" rel="noreferrer">ESPN</a> (dodatkowy globalny scoreboard, ograniczenia pokrycia). Puchary, rozgrywki młodzieżowe i kobiece są uwzględniane, gdy dostawca publikuje feed. Pokrycie zależy od dostępności danych; błędy i braki są raportowane.</p></section>}

        {active === "bets" && <section className="module-panel bets-module">
          <div className="module-icon"><Ticket/></div><h2>Bilans wybranych zakładów</h2>
          <article className="panel">
            <div className="panel-heading"><div><h3>Automatyczne kursy · StrikerAPI</h3><p>Uruchomienie po skanie · maksymalnie 1 odczyt dziennie · 10 kredytów</p></div><ShieldCheck size={18}/></div>
            <div className="tracker-form">
              <input type="password" autoComplete="off" value={oddsPilotToken} onChange={event => { setOddsPilotToken(event.target.value); setOddsTokenSaved(false); }} placeholder="ODDS_PILOT_TOKEN · min. 32 znaki" aria-label="Token dostępu do automatycznych kursów"/>
              <button onClick={saveOddsPilotToken}>Zapisz token</button>
              <button onClick={clearOddsPilotToken} disabled={!oddsTokenSaved && !oddsPilotToken}>Usuń</button>
              <span className="source-note">{oddsLoading ? "Pobieranie kursów…" : lastOddsFetchDate === fixtureScan?.date ? "Kursy pobrane dzisiaj" : lastOddsAttemptDate === fixtureScan?.date ? "Dzisiejsza próba wykonana — bez ponownego obciążania limitu" : oddsProviderStatus === null ? "Sprawdzanie konfiguracji dostawcy…" : !oddsProviderStatus.strikerapi ? "Brak STRIKERAPI_API_KEY w Workerze" : !oddsProviderStatus.pilotEnabled ? "Brak sekretu ODDS_PILOT_TOKEN w Workerze" : oddsTokenSaved ? "Oczekiwanie na skan — pobieranie automatyczne" : "Wymagane jednorazowe zapisanie tokenu"}</span>
            </div>
            <p className="source-note">Ustaw identyczny sekret <b>ODDS_PILOT_TOKEN</b> w Cloudflare Workerze <b>moneyball-global-rebuild</b> i zapisz go tutaj tylko raz. Token pozostaje lokalnie w tej przeglądarce; nie wklejaj go do czatu. Po skanie dzisiejszych meczów aplikacja automatycznie pobierze dzienny pakiet kursów. Limit aplikacji to jedna próba na datę, aby chronić darmowe kredyty. StrikerAPI daje 500 darmowych kredytów miesięcznie; jeden odczyt dzienny kosztuje 10 (około 300 na 30 dni). Dostawca obejmuje tylko wybrane ligi, nie całą Europę. Daty dostawcy są UTC; dopasowanie meczu odbywa się po nazwach drużyn, dacie i godzinie Europe/Brussels.</p>
            {oddsNotice && <div className="tracker-notice">{oddsNotice}</div>}
            {oddsAudit && <p className="source-note">Ostatni audyt · UTC {oddsAudit.utcDate} · dopasowane {oddsAudit.matched} · niejednoznaczne {oddsAudit.ambiguous} · bez dopasowania {oddsAudit.unmatched} · nowe snapshoty {oddsAudit.snapshots}.</p>}
            <h3>Ostatnie snapshoty kursów</h3>
            <div className="tracker-table">
              <div className="tracker-head"><span>BUKMACHER</span><span>MECZ</span><span>1</span><span>X</span><span>2</span></div>
              {records.filter(row => row.kind === "odds").slice(0, 20).map(row => {
                const price = (value: unknown) => typeof value === "number" && value > 1 ? value.toFixed(2) : "—";
                return <div className="tracker-row" key={row.id}>
                  <span>{String(row.details.bookmaker ?? "—")}</span>
                  <b>{row.title}</b>
                  <span>{price(row.details.odds1)}</span>
                  <span>{price(row.details.oddsX)}</span>
                  <span>{price(row.details.odds2)}</span>
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
        {active === "tracker" && <section className="tracker-panel"><div className="tracker-toolbar"><div><h2>Twój lokalny rejestr</h2><p>Dane są zapisywane w pamięci tej przeglądarki. Eksportuj kopię, aby ich nie utracić.</p></div><div className="backup-actions"><button onClick={downloadBackup}>Eksport JSON</button><button onClick={downloadCsv}>Eksport CSV</button><button onClick={() => fileRef.current?.click()}>Import JSON</button><input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={e => void loadBackup(e.target.files?.[0])}/></div></div><div className="tracker-form"><select value={newKind} onChange={e => setNewKind(e.target.value as TrackerKind)}><option value="match">Mecz</option><option value="prediction">Prognoza</option><option value="coupon">Kupon</option><option value="scan">Skan</option><option value="result">Wynik</option><option value="odds">Kurs</option><option value="ledger">Bankroll</option><option value="category">Kategoria</option><option value="jackpot">Jackpot</option></select><input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Dodaj wpis do Trackera…"/><button onClick={saveRecord} disabled={!newTitle.trim()}><Plus size={16}/> Zapisz</button></div>{notice && <div className="tracker-notice">{notice}</div>}<div className="tracker-search"><Search size={16}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Szukaj wpisów…"/><span>{visibleRecords.length} wpisów</span></div><div className="tracker-table"><div className="tracker-head"><span>TYP</span><span>NAZWA</span><span>STATUS</span><span>DATA</span><span/></div>{visibleRecords.map(row => <div className="tracker-row tracker-row-detail" key={row.id}><span>{row.kind}</span><b>{row.title}</b><span>{row.status}</span><time>{new Date(row.createdAt).toLocaleString("pl-BE")}</time><details className="record-details"><summary>Szczegóły</summary><dl>{Object.entries(row.details).map(([key,value]) => <div key={key}><dt>{key}</dt><dd>{key === "historyProvenance" ? describeHistoryProvenance(value) : typeof value === "object" ? JSON.stringify(value) : String(value ?? "—")}</dd></div>)}</dl></details><span className="history-protected" title="Historia jest chroniona — użyj kopii zapasowej do przenoszenia danych">Zapis chroniony</span></div>)}{visibleRecords.length === 0 && <div className="tracker-empty">Brak wpisów. Dodaj pierwszy rekord lub zaimportuj kopię zapasową.</div>}</div></section>}

        {active === "coupons" && <section className="module-panel coupon-module">
          <div className="module-icon"><Ticket/></div>
          <h2>Kupony testowe · dokładnie 3 mecze</h2>
          <p>Do puli trafiają wyłącznie typy z najwyższym prawdopodobieństwem co najmniej 75%. Każdy kupon ma trzy różne mecze, bez powtórek.</p>
          <div className="module-status"><span className="status-dot"/> {fixtureScan ? `DATA SKANU: ${fixtureScan.date}` : "NAJPIERW WYKONAJ SKAN MECZÓW"}</div>
          {(() => {
            const candidates = buildThreeLegCandidates(records, fixtureScan?.date ?? "");
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
                    <b>{leg.title}</b><span>{leg.selection} · {Math.round(leg.probability * 100)}%</span><small>{leg.competition}{priced ? ` · kurs ${priced.legs[legIndex].decimalOdds.toFixed(2)} · EV ${(priced.legs[legIndex].expectedValue * 100).toFixed(1)}%` : ""}</small>
                  </div>)}
                  <div className="coupon-candidate-bottom">
                    <span>Prawdopodobieństwo modelu: {(coupon.combinedProbability * 100).toFixed(1)}%</span>
                    {priced ? <span>AKO {priced.combinedOdds.toFixed(2)} · EV {(priced.expectedValue * 100).toFixed(1)}%</span> : <span>{coupon.legs.some(leg => leg.market === "DOUBLE_CHANCE") ? "Brak zweryfikowanych kursów DC — kupon bez wyceny" : selectedOddsBookmaker ? "Brak kompletnych/świeżych kursów dla wszystkich 3 meczów" : "Wybierz bukmachera — kursy niepotwierdzone"}</span>}
                  </div>
                  {priced && <p className="source-note">Stawka €{priced.stake.toFixed(2)} · możliwy zwrot €{priced.potentialReturn.toFixed(2)} · możliwy zysk €{priced.potentialProfit.toFixed(2)} · {priced.bookmaker}</p>}
                  <button disabled={alreadySaved} onClick={() => {
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
          <details className="scan-warnings" open><summary>Diagnostyka prognoz: {predictionDiagnostics.total} meczów · 1X2 ≥75%: {predictionDiagnostics.candidates} · DC ≥75%: {predictionDiagnostics.dcCandidates} · bez progu: {predictionDiagnostics.rejected}</summary><p>Bez pełnych prawdopodobieństw 1X2: {predictionDiagnostics.withoutProbabilities}. To zwykle oznacza brak historii, niedostępny feed wyników albo brak potwierdzonej godziny meczu.</p>{predictionDiagnostics.reasons.length ? predictionDiagnostics.reasons.map(([reason,count]) => <p key={reason}><b>{count}×</b> {reason}</p>) : <p>Brak zapisanych odrzuceń w najnowszej prognozie każdego meczu.</p>}<p>Kandydat 1X2: 75%. Kandydat Double Chance: 75%. To niezależne kryteria — mecz może spełnić próg DC, nawet jeśli nie spełnia progu 1X2.</p></details>
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
          <div className="module-icon"><Sparkles/></div><h2>Najmocniejszy kandydat dnia</h2>
          {safestPick ? <><div className="safest-pick-card"><span className="safest-pick-label">TOP WYBÓR MODELU · NIE GWARANCJA</span><h3>{safestPick.title}</h3><b className="safest-pick-market">{safestPick.market} · {(safestPick.probability * 100).toFixed(1)}%</b><p>{safestPick.competition} · {safestPick.kickoff} (Europe/Brussels)</p><small>{safestPick.reason}</small></div></> : <div className="tracker-empty">Brak kandydata spełniającego próg Double Chance 75% wśród zapisanych prognoz przedmeczowych. Najpierw uruchom „Analizuj wszystkie”. Jeśli żaden mecz nie spełnia kryteriów, nie wybieramy typu na siłę.</div>}
          <div className="module-status"><span className="status-dot"/> Zapisane prognozy: {records.filter(row => row.kind === "prediction").length} · kandydaci 1X2 ≥75%: {records.filter(row => row.kind === "prediction" && row.details.evidenceComplete === true && row.details.strongCandidate === true).length} · kandydaci DC ≥75%: {records.filter(row => row.kind === "prediction" && row.details.evidenceComplete === true && (row.details.strongDoubleChance === true || (typeof row.details.dc1x === "number" && typeof row.details.dcx2 === "number" && typeof row.details.dc12 === "number" && Math.max(row.details.dc1x,row.details.dcx2,row.details.dc12) >= 0.75))).length}</div>
        </section>}

        <footer className="footer"><span>MONEYBALL — TRUST THE PROCESS</span><span>FRESH BUILD · DATA TRANSPARENCY FIRST</span></footer>
      </div>
    </main>
  </div>;
}
