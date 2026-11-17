import { useEffect, useMemo, useRef, useState } from "react";
import { scanTodayEuropeanFixtures, type FixtureScan, type FreeFixture } from "./free-fixtures";
import { addRecord, addRecordsIfMissing, exportBackup, importBackup, readRecords, removeRecord, type TrackerKind, type TrackerRecord } from "./tracker-store";
import { findOpenLigaFixtureResult, findOpenMatchdayResult, loadOpenLigaRecentTeamForm, loadRecentTeamForm, type TeamForm } from "./team-form";
import { predictFromRecentForm, type FormPrediction } from "./form-prediction";
import { buildThreeLegCandidates } from "./coupon-engine";
import { findOpenFootballFixtureResult, loadOpenFootballRecentTeamForm } from "./openfootball";
import { evaluatePaperCoupon } from "./coupon-settlement";
import { auditTrackerPredictions } from "./model-audit";
import {
  Activity, BarChart3, Bell, CalendarDays, ChevronRight, CircleDot,
  ClipboardList, Database, Gauge, LayoutDashboard, Menu, Plus, Search,
  ShieldCheck, Sparkles, Ticket, Trophy, X
} from "lucide-react";

type Tab = "dashboard" | "matches" | "pick" | "coupons" | "intelligence" | "tracker";

const nav: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "matches", label: "Mecze", icon: CalendarDays },
  { id: "pick", label: "Typ dnia", icon: Sparkles },
  { id: "coupons", label: "Kupony", icon: Ticket },
  { id: "intelligence", label: "Intelligence", icon: BarChart3 },
  { id: "tracker", label: "Tracker", icon: ClipboardList },
];

const descriptions: Record<Tab, { eyebrow: string; title: string; subtitle: string }> = {
  dashboard: { eyebrow: "CENTRUM DOWODZENIA", title: "Trust the Process.", subtitle: "Przejrzysta analityka. Zweryfikowane dane. Każda decyzja z uzasadnieniem." },
  matches: { eyebrow: "CENTRUM MECZÓW", title: "Mecze", subtitle: "Europejskie rozgrywki, forma drużyn i komplet danych źródłowych." },
  pick: { eyebrow: "SELEKCJA DNIA", title: "Typ dnia", subtitle: "Jedna selekcja oparta na danych — albo uczciwa informacja, że dziś brak przewagi." },
  coupons: { eyebrow: "ZARZĄDZANIE KUPONAMI", title: "Kupony", subtitle: "Buduj, zapisuj i rozliczaj kupony analityczne. Bez obstawiania za prawdziwe pieniądze." },
  intelligence: { eyebrow: "ANALITYKA MODELU", title: "Intelligence", subtitle: "Skuteczność, kalibracja, jakość danych i wyniki według lig oraz rynków." },
  tracker: { eyebrow: "REJESTR GŁÓWNY", title: "Tracker", subtitle: "Jedno miejsce dla skanów, prognoz, kursów, kuponów, wyników i historii." },
};

function Metric({ label, value, note, icon: Icon }: { label: string; value: string; note: string; icon: typeof Activity }) {
  return <article className="metric-card"><div className="metric-top"><span>{label}</span><Icon size={17} /></div><strong>{value}</strong><small>{note}</small></article>;
}

function savePredictionRecord(match: FreeFixture, prediction?: FormPrediction, reason?: string): TrackerRecord[] {
  const model = "recent-form-goals-poisson-v1";
  const existing = readRecords().some(row => row.kind === "prediction" && row.details.fixtureId === match.id && row.details.model === model);
  if (existing) return readRecords();
  const probabilities = prediction?.prediction.probabilities;
  const dc = prediction?.prediction.doubleChance;
  addRecord({
    kind: "prediction",
    title: `${match.date} · ${match.home} vs ${match.away}`,
    status: prediction?.strongCandidate ? "KANDYDAT" : "ODRZUCONY",
    details: {
      fixtureId: match.id,
      fixtureDate: match.date,
      home: match.home,
      away: match.away,
      leagueFolder: match.leagueFolder ?? null,
      leagueShortcut: match.leagueShortcut ?? null,
      leagueSeason: match.leagueSeason ?? null,
      openFootballFeedId: match.openFootballFeedId ?? null,
      competition: match.competition,
      model,
      market: "1X2",
      selection: prediction?.pick ?? null,
      p1: probabilities?.home ?? null,
      px: probabilities?.draw ?? null,
      p2: probabilities?.away ?? null,
      dc1x: dc?.oneX ?? null,
      dcx2: dc?.xTwo ?? null,
      dc12: dc?.oneTwo ?? null,
      expectedGoalsHome: prediction?.prediction.expectedGoals.home ?? null,
      expectedGoalsAway: prediction?.prediction.expectedGoals.away ?? null,
      topProbability: prediction?.topProbability ?? null,
      strongCandidate: prediction?.strongCandidate ?? false,
      source: match.source,
      reason: reason ?? (prediction && !prediction.strongCandidate ? "Najwyższe prawdopodobieństwo poniżej progu 75%." : null),
    },
  });
  return readRecords();
}

export default function App() {
  const [active, setActive] = useState<Tab>("dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [records, setRecords] = useState<TrackerRecord[]>(() => readRecords());
  const [newTitle, setNewTitle] = useState("");
  const [newKind, setNewKind] = useState<TrackerKind>("match");
  const [notice, setNotice] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [fixtureScan, setFixtureScan] = useState<FixtureScan | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [settling, setSettling] = useState(false);
  const settlementLock = useRef(false);
  const [settleProgress, setSettleProgress] = useState(0);
  const [scanError, setScanError] = useState("");
  const [teamForms, setTeamForms] = useState<Record<string, { home?: TeamForm; away?: TeamForm; prediction?: FormPrediction; predictionError?: string; loading: boolean; error?: string }>>({});
  const loadFixtureForms = async (match: NonNullable<typeof fixtureScan>["fixtures"][number]) => {
    setTeamForms(current => ({ ...current, [match.id]: { ...current[match.id], loading: true, error: undefined } }));
    try {
      const load = async (team: string): Promise<TeamForm> => {
        const failures: string[] = [];
        if (match.leagueFolder) {
          try { return await loadRecentTeamForm(match.leagueFolder, team, match.date); }
          catch (error) { failures.push(error instanceof Error ? error.message : "open-matchday history failed"); }
        }
        if (match.leagueShortcut && match.leagueSeason) {
          try { return await loadOpenLigaRecentTeamForm(match.leagueShortcut, match.leagueSeason, team, match.date); }
          catch (error) { failures.push(error instanceof Error ? error.message : "OpenLigaDB history failed"); }
        }
        if (match.openFootballFeedId) {
          try { return await loadOpenFootballRecentTeamForm(match.openFootballFeedId, team, match.date); }
          catch (error) { failures.push(error instanceof Error ? error.message : "OpenFootball history failed"); }
        }
        throw new Error(failures.join(" · ") || "Brak źródła historii dla tej ligi.");
      };
      const [home, away] = await Promise.all([load(match.home), load(match.away)]);
      let prediction: FormPrediction | undefined;
      let predictionError: string | undefined;
      try { prediction = predictFromRecentForm(home, away); }
      catch (error) { predictionError = error instanceof Error ? error.message : "Za mało danych do prognozy."; }
      setTeamForms(current => ({ ...current, [match.id]: { home, away, prediction, predictionError, loading: false } }));
      setRecords(savePredictionRecord(match, prediction, predictionError));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nie udało się pobrać formy.";
      setTeamForms(current => ({ ...current, [match.id]: { loading: false, error: message } }));
      setRecords(savePredictionRecord(match, undefined, message));
    }
  };
  const analyzeAllFixtures = async () => {
    if (!fixtureScan || bulkLoading || scanLoading) return;
    setBulkLoading(true);
    setBulkProgress(0);
    const matches = fixtureScan.fixtures;
    const concurrency = 4;
    try {
      for (let index = 0; index < matches.length; index += concurrency) {
        const batch = matches.slice(index, index + concurrency);
        await Promise.all(batch.map(match => loadFixtureForms(match)));
        setBulkProgress(Math.min(index + batch.length, matches.length));
      }
    } finally {
      setBulkLoading(false);
      setRecords(readRecords());
    }
  };
  const settlePendingResults = async () => {
    if (settlementLock.current) return;
    settlementLock.current = true;
    const all = readRecords();
    const settledIds = new Set(all.filter(row => row.kind === "result" && typeof row.details.fixtureId === "string").map(row => row.details.fixtureId as string));
    // Fetch a result only once when legacy/duplicate prediction rows exist.
    const pendingByFixture = new Map<string, TrackerRecord>();
    for (const row of all) {
      const fixtureId = row.details.fixtureId;
      if (row.kind !== "prediction" || typeof fixtureId !== "string" || settledIds.has(fixtureId) || pendingByFixture.has(fixtureId)) continue;
      pendingByFixture.set(fixtureId, row);
    }
    const pending = [...pendingByFixture.values()];
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
            if (result) addRecord({
              kind: "result",
              title: `${prediction.title} · ${result.homeGoals}:${result.awayGoals}`,
              status: "SETTLED",
              details: { fixtureId: d.fixtureId as string, actual: result.actual, homeGoals: result.homeGoals, awayGoals: result.awayGoals, date: result.date, source: result.source },
            });
          } catch { /* provider failures remain pending and are retried on next run */ }
        }));
        processed = Math.min(index + batch.length, pending.length);
        setSettleProgress(processed);
      }
    } finally {
      const latest = readRecords();
      const coupons = latest.filter(row => row.kind === "coupon" && row.status === "PAPER_NO_ODDS"
        && !latest.some(item => item.kind === "coupon" && item.details.parentCouponId === row.id));
      for (const coupon of coupons) {
        const settlement = evaluatePaperCoupon(coupon, latest);
        if (settlement) addRecord({
          kind: "coupon",
          title: `${coupon.title} · ${settlement.correctLegs}/3`,
          status: settlement.status,
          details: {
            parentCouponId: coupon.id,
            correctLegs: settlement.correctLegs,
            totalLegs: settlement.totalLegs,
            legResultsJson: JSON.stringify(settlement.legResults),
            odds: null,
            stake: null,
          },
        });
      }
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
        details: { fixtureId: match.id, date: match.date, time: match.time, competition: match.competition, source: match.source, sourceUpdatedAt: match.sourceUpdatedAt ?? null },
      })), "fixtureId");
      addRecord({ kind: "scan", title: `Skan europejski ${scan.date}`, status: scan.leaguesFailed.length ? "WITH_WARNINGS" : "OK", details: { fixtures: scan.fixtures.length, catalogueEntries: scan.leaguesChecked, errors: scan.leaguesFailed.length, source: scan.source } });
      setRecords(readRecords());
    } catch (error) { setScanError(error instanceof Error ? error.message : "Nie udało się pobrać terminarza."); }
    finally { setScanLoading(false); }
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
  const visibleRecords = useMemo(() => records.filter(row => (active === "tracker" ? true : row.kind === (active === "matches" ? "match" : active === "coupons" ? "coupon" : active === "pick" ? "prediction" : "scan")) && (row.title.toLowerCase().includes(query.toLowerCase()) || row.status.toLowerCase().includes(query.toLowerCase()))), [records, active, query]);
  const refreshRecords = () => setRecords(readRecords());
  const saveRecord = () => { if (!newTitle.trim()) return; addRecord({ kind: newKind, title: newTitle.trim(), status: "draft", details: {} }); setNewTitle(""); refreshRecords(); setNotice("Zapisano lokalnie na tym urządzeniu."); };
  const downloadBackup = () => { const blob = new Blob([JSON.stringify(exportBackup(), null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "moneyball-backup.json"; a.click(); URL.revokeObjectURL(url); };
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
          <section className="metrics-grid"><Metric label="Dzisiejsze mecze" value={fixtureScan ? String(fixtureScan.fixtures.length) : "—"} note={fixtureScan ? `Europa · ${fixtureScan.leaguesChecked} katalogów / kanałów` : scanError ? "Źródło chwilowo niedostępne" : "Pobieranie terminarzy"} icon={CalendarDays}/><Metric label="Prognozy" value={String(records.filter(row => row.kind === "prediction").length)} note="Zapisane typy i odrzucone analizy" icon={Gauge}/><Metric label="Aktywne kupony" value={String(records.filter(row => row.kind === "coupon" && row.status === "PAPER_NO_ODDS" && !records.some(child => child.kind === "coupon" && child.details.parentCouponId === row.id)).length)} note="Kupony testowe bez potwierdzonych kursów" icon={Ticket}/><Metric label="Tracker" value={String(records.length)} note="Wpisy zapisane lokalnie na tym urządzeniu" icon={Database}/></section>
          <section className="matches-preview"><div className="panel-heading"><div><h3>Dzisiaj w Europie</h3><p>{fixtureScan ? `open-matchday build: ${new Date(fixtureScan.generatedAt).toLocaleString("pl-BE")}` : "Terminarz publiczny, bez klucza API"}</p></div><button onClick={() => void runFixtureScan(true)} disabled={scanLoading}>{scanLoading ? "Pobieranie…" : "Odśwież"}</button></div>{scanError && <p className="scan-error">{scanError}</p>}{fixtureScan?.fixtures.slice(0,6).map(match => <div className="match-preview-row" key={match.id}><time>{match.time}</time><b>{match.home}</b><span>vs</span><b>{match.away}</b><small>{match.competition}</small></div>)}{fixtureScan && fixtureScan.fixtures.length === 0 && <div className="empty-state"><b>Brak zaplanowanych meczów w pobranych źródłach</b><span>To nie potwierdza braku meczów we wszystkich rozgrywkach Europy. Sprawdź liczbę błędów i katalogów w zakładce Mecze.</span></div>}<div className="source-note">Źródła: <a href="https://github.com/oladeeayo/open-matchday" target="_blank" rel="noreferrer">open-matchday</a> (użytek niekomercyjny) · <a href="https://www.openligadb.de/" target="_blank" rel="noreferrer">OpenLigaDB</a> · <a href="https://github.com/openfootball/europe" target="_blank" rel="noreferrer">OpenFootball</a>. Pokrycie zależy od aktualnych plików dostawców.</div><button className="text-link" onClick={() => changeTab("matches")}>Pokaż wszystkie mecze <ChevronRight size={14}/></button></section>
          <section className="lower-grid"><article className="panel"><div className="panel-heading"><div><h3>Ostatnia aktywność</h3><p>Rzeczywiste zdarzenia w lokalnym Trackerze</p></div><Activity size={18}/></div>{records.length ? <div className="check-list">{[...records].sort((a,b) => b.createdAt.localeCompare(a.createdAt)).slice(0,5).map(row => <div className="check-row" key={row.id}><span>{row.kind.toUpperCase().slice(0,3)}</span><div><b>{row.title}</b><small>{new Date(row.createdAt).toLocaleString("pl-BE")}</small></div><i>{row.status}</i></div>)}</div> : <div className="empty-state"><div className="empty-icon"><Activity size={21}/></div><b>Brak zapisanych zdarzeń</b><span>Po pierwszym skanie, prognozie lub rozliczeniu historia pojawi się tutaj.</span></div>}</article><article className="panel"><div className="panel-heading"><div><h3>Stan etapów platformy</h3><p>Rzeczywisty zakres wdrożenia</p></div><Trophy size={18}/></div><div className="check-list"><div className="check-row done"><span>01</span><div><b>Fundament, PWA i publikacja</b><small>Oddzielny Cloudflare Worker i automatyczny deploy</small></div><i>DONE</i></div><div className="check-row done"><span>02</span><div><b>Tracker, kopie JSON i walidacja</b><small>Lokalny rejestr z importem łączonym</small></div><i>DONE</i></div><div className="check-row"><span>03</span><div><b>Europejskie źródła terminarzy</b><small>3 publiczne źródła; pokrycie nie jest kompletne</small></div><i>ACTIVE</i></div><div className="check-row"><span>04</span><div><b>Forma, prognozy i kupony testowe</b><small>Model bez xG i bez rzeczywistych kursów</small></div><i>ACTIVE</i></div><div className="check-row"><span>05</span><div><b>Audyt i testy końcowe</b><small>CI i deploy działają; wizualny test mobilny nadal wymagany</small></div><i>IN PROGRESS</i></div></div></article></section>
        </>}

        {active === "matches" && <section className="tracker-panel"><div className="tracker-toolbar"><div><h2>Europejski terminarz</h2><p>{fixtureScan ? `${fixtureScan.fixtures.length} meczów na ${fixtureScan.date} · ${fixtureScan.leaguesChecked} pozycji katalogu w skanie` : "Darmowe źródło danych, bez klucza API"}</p></div><div className="match-toolbar-actions"><button className="primary-button" onClick={() => void runFixtureScan(true)} disabled={scanLoading || bulkLoading}>{scanLoading ? "Skanowanie…" : "Skanuj dzisiaj"}</button><button onClick={() => void analyzeAllFixtures()} disabled={!fixtureScan || bulkLoading || scanLoading || fixtureScan.fixtures.length === 0}>{bulkLoading ? `Analiza ${bulkProgress}/${fixtureScan?.fixtures.length ?? 0}` : `Analizuj wszystkie (${fixtureScan?.fixtures.length ?? 0})`}</button></div></div>{scanError && <p className="scan-error">{scanError}</p>}{bulkLoading && <p className="source-note">Przetworzono {bulkProgress} z {fixtureScan?.fixtures.length ?? 0} meczów.</p>}{fixtureScan && <p className="source-note">Źródła — open-matchday: {fixtureScan.coverage.openMatchday.cataloguesChecked} katalogów, {fixtureScan.coverage.openMatchday.fixtures} meczów, {fixtureScan.coverage.openMatchday.errors} błędów · OpenLigaDB: {fixtureScan.coverage.openLigaDB.competitionsChecked} rozgrywek, {fixtureScan.coverage.openLigaDB.fixtures} meczów, {fixtureScan.coverage.openLigaDB.errors} błędów · openfootball: {fixtureScan.coverage.openFootball.feedsChecked} plików, {fixtureScan.coverage.openFootball.fixtures} meczów, {fixtureScan.coverage.openFootball.errors} błędów. Duplikaty źródeł są scalane.</p>}{fixtureScan?.leaguesFailed.length ? <details className="scan-warnings"><summary>Błędy pobierania: {fixtureScan.leaguesFailed.length} źródeł lub rozgrywek</summary>{fixtureScan.leaguesFailed.map(error => <p key={error}>{error}</p>)}</details> : null}<div className="tracker-search"><Search size={16}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Szukaj drużyny lub ligi…"/><span>{fixtureScan?.fixtures.filter(m => `${m.home} ${m.away} ${m.competition}`.toLowerCase().includes(query.toLowerCase())).length ?? 0} meczów</span></div><div className="fixture-list">{fixtureScan?.fixtures.filter(m => `${m.home} ${m.away} ${m.competition}`.toLowerCase().includes(query.toLowerCase())).map(match => <div className="fixture-row fixture-row-expanded" key={match.id}><time>{match.time}</time><div><b>{match.home}</b><span>{match.away}</span></div><small>{match.competition}</small>{match.leagueFolder || (match.leagueShortcut && match.leagueSeason) || match.openFootballFeedId ? <button className="form-button" onClick={() => void loadFixtureForms(match)} disabled={teamForms[match.id]?.loading}>{teamForms[match.id]?.loading ? "Ładowanie…" : "Forma 5 + typ"}</button> : <small className="source-note">Historia formy niedostępna w tym źródle</small>}{teamForms[match.id]?.error && <p className="scan-error">{teamForms[match.id].error}</p>}{teamForms[match.id]?.home && teamForms[match.id]?.away && <div className="team-form-panel"><div><b>{match.home} · ostatnie mecze</b>{teamForms[match.id].home!.matches.map((item,i)=><small key={item.date+i}>{item.date} · {item.venue==="H"?"D":"W"} · {item.goalsFor}:{item.goalsAgainst} · {item.result} · {item.opponent}</small>)}</div><div><b>{match.away} · ostatnie mecze</b>{teamForms[match.id].away!.matches.map((item,i)=><small key={item.date+i}>{item.date} · {item.venue==="H"?"D":"W"} · {item.goalsFor}:{item.goalsAgainst} · {item.result} · {item.opponent}</small>)}</div><p>Źródła: {teamForms[match.id].home!.source} / {teamForms[match.id].away!.source} · tylko zakończone mecze przed datą spotkania. D=dom, W=wyjazd.</p>{teamForms[match.id].prediction && <div className="form-prediction"><b>Prognoza 1X2 · {teamForms[match.id].prediction!.pick} ({Math.round(teamForms[match.id].prediction!.topProbability * 100)}%)</b><span>1: {Math.round(teamForms[match.id].prediction!.prediction.probabilities.home * 100)}% · X: {Math.round(teamForms[match.id].prediction!.prediction.probabilities.draw * 100)}% · 2: {Math.round(teamForms[match.id].prediction!.prediction.probabilities.away * 100)}%</span><span>DC: 1X {Math.round(teamForms[match.id].prediction!.prediction.doubleChance.oneX * 100)}% · X2 {Math.round(teamForms[match.id].prediction!.prediction.doubleChance.xTwo * 100)}% · 12 {Math.round(teamForms[match.id].prediction!.prediction.doubleChance.oneTwo * 100)}%</span><small>λ: {teamForms[match.id].prediction!.prediction.expectedGoals.home.toFixed(2)}–{teamForms[match.id].prediction!.prediction.expectedGoals.away.toFixed(2)} · próby: {teamForms[match.id].prediction!.samples.homeAttack}/{teamForms[match.id].prediction!.samples.awayAttack}</small><small>{teamForms[match.id].prediction!.note}</small>{teamForms[match.id].prediction!.strongCandidate && <small>Najwyższe prawdopodobieństwo ≥75% — kandydat do puli, nie gwarancja.</small>}</div>}{teamForms[match.id].predictionError && <p className="scan-error">Prognoza niedostępna: {teamForms[match.id].predictionError}</p>}</div>}</div>)}{fixtureScan && fixtureScan.fixtures.length === 0 && <div className="tracker-empty">Brak meczów w pobranych źródłach na dziś. Nie oznacza to, że wszystkie europejskie rozgrywki zostały potwierdzone.</div>}</div><p className="source-note">Źródła: <a href="https://github.com/oladeeayo/open-matchday" target="_blank" rel="noreferrer">open-matchday</a> (CSV, użytek niekomercyjny) + <a href="https://www.openligadb.de/" target="_blank" rel="noreferrer">OpenLigaDB</a> (API) + <a href="https://github.com/openfootball/europe" target="_blank" rel="noreferrer">OpenFootball</a> (public domain). Puchary, rozgrywki młodzieżowe i kobiece są uwzględniane, gdy dostawca publikuje feed. Pokrycie zależy od dostępności danych; błędy i braki są raportowane.</p></section>}

        {active === "tracker" && <section className="tracker-panel"><div className="tracker-toolbar"><div><h2>Twój lokalny rejestr</h2><p>Dane są zapisywane w pamięci tej przeglądarki. Eksportuj kopię, aby ich nie utracić.</p></div><div className="backup-actions"><button onClick={downloadBackup}>Eksport JSON</button><button onClick={() => fileRef.current?.click()}>Import JSON</button><input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={e => void loadBackup(e.target.files?.[0])}/></div></div><div className="tracker-form"><select value={newKind} onChange={e => setNewKind(e.target.value as TrackerKind)}><option value="match">Mecz</option><option value="prediction">Prognoza</option><option value="coupon">Kupon</option><option value="scan">Skan</option><option value="result">Wynik</option><option value="odds">Kurs</option><option value="ledger">Bankroll</option><option value="category">Kategoria</option><option value="jackpot">Jackpot</option></select><input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Dodaj wpis do Trackera…"/><button onClick={saveRecord} disabled={!newTitle.trim()}><Plus size={16}/> Zapisz</button></div>{notice && <div className="tracker-notice">{notice}</div>}<div className="tracker-search"><Search size={16}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Szukaj wpisów…"/><span>{visibleRecords.length} wpisów</span></div><div className="tracker-table"><div className="tracker-head"><span>TYP</span><span>NAZWA</span><span>STATUS</span><span>DATA</span><span/></div>{visibleRecords.map(row => <div className="tracker-row" key={row.id}><span>{row.kind}</span><b>{row.title}</b><span>{row.status}</span><time>{new Date(row.createdAt).toLocaleString("pl-BE")}</time><button aria-label="Usuń wpis" onClick={() => { removeRecord(row.id); refreshRecords(); }}>×</button></div>)}{visibleRecords.length === 0 && <div className="tracker-empty">Brak wpisów. Dodaj pierwszy rekord lub zaimportuj kopię zapasową.</div>}</div></section>}

        {active === "coupons" && <section className="module-panel coupon-module">
          <div className="module-icon"><Ticket/></div>
          <h2>Kupony testowe · dokładnie 3 mecze</h2>
          <p>Do puli trafiają wyłącznie typy z najwyższym prawdopodobieństwem co najmniej 75%. Każdy kupon ma trzy różne mecze, bez powtórek.</p>
          <div className="module-status"><span className="status-dot"/> {fixtureScan ? `DATA SKANU: ${fixtureScan.date}` : "NAJPIERW WYKONAJ SKAN MECZÓW"}</div>
          {(() => {
            const candidates = buildThreeLegCandidates(records, fixtureScan?.date ?? "");
            return candidates.length ? <div className="coupon-candidates">
              <div className="coupon-candidate-heading"><b>{candidates.length} kombinacji spełnia próg</b><small>Kolejność według iloczynu prawdopodobieństw modelu</small></div>
              {candidates.slice(0, 10).map((coupon, index) => <article className="coupon-candidate" key={coupon.legs.map(leg => leg.fixtureId).join("|")}>
                <div className="coupon-candidate-top"><b>Kupon testowy #{index + 1}</b><span>3/3 mecze</span></div>
                {coupon.legs.map(leg => <div className="coupon-leg" key={leg.fixtureId}><b>{leg.title}</b><span>{leg.selection} · {Math.round(leg.probability * 100)}%</span><small>{leg.competition}</small></div>)}
                <div className="coupon-candidate-bottom"><span>Iloczyn prawdopodobieństw: {(coupon.combinedProbability * 100).toFixed(1)}%</span><span>Kursy: brak potwierdzonych danych</span></div>
                <button onClick={() => {
                  addRecord({ kind: "coupon", title: `Kupon ${fixtureScan!.date} #${index + 1}`, status: "PAPER_NO_ODDS", details: { date: coupon.date, legsJson: JSON.stringify(coupon.legs.map(leg => ({ fixtureId: leg.fixtureId, selection: leg.selection, probability: leg.probability }))), combinedProbability: coupon.combinedProbability, odds: null, stake: null } });
                  setRecords(readRecords());
                }}>Zapisz kupon testowy</button>
              </article>)}
            </div> : <div className="tracker-empty">Brak trzech różnych meczów z potwierdzoną prognozą ≥75% na dzień skanu. Wygeneruj prognozy w zakładce Mecze.</div>;
          })()}
          <p className="source-note">Nie wyliczamy kursów ani potencjalnej wygranej bez rzeczywistych notowań bukmacherskich. Iloczyn prawdopodobieństw to metryka modelu, nie kurs AKO i nie gwarancja trafienia.</p>
        </section>}
        {active === "intelligence" && <section className="module-panel audit-module">
          <div className="module-icon"><BarChart3/></div>
          <h2>Jakość modelu · wyniki rozliczone</h2><button className="settle-button" onClick={() => void settlePendingResults()} disabled={settling}>{settling ? `Sprawdzanie ${settleProgress}…` : "Pobierz wyniki i rozlicz"}</button>
          <p>Metryki liczone wyłącznie z prognoz połączonych z rzeczywistym wynikiem przez identyfikator meczu.</p>
          {modelAudit.metrics ? <><div className="audit-metrics"><article><small>Próba</small><b>{modelAudit.metrics.count}</b></article><article><small>Skuteczność 1X2</small><b>{(modelAudit.metrics.accuracy*100).toFixed(1)}%</b></article><article><small>Brier score</small><b>{modelAudit.metrics.brierScore.toFixed(4)}</b></article><article><small>Log loss</small><b>{modelAudit.metrics.logLoss.toFixed(4)}</b></article></div><h3>Kalibracja pewności</h3><div className="audit-buckets">{modelAudit.buckets.map(bucket => <div key={bucket.label}><b>{bucket.label}</b><span>Prognoza: {(bucket.averageConfidence*100).toFixed(1)}%</span><span>Trafienia: {(bucket.observedAccuracy*100).toFixed(1)}%</span><small>n={bucket.count}</small></div>)}</div></> : <div className="tracker-empty">Brak rozliczonych prognoz. Zapisz wynik z tym samym fixtureId co prognoza, aby uruchomić Brier score, log loss, skuteczność i kalibrację.</div>}
          <div className="module-status"><span className="status-dot"/> Rozliczone: {modelAudit.settledPredictions} · oczekujące na wynik: {modelAudit.unmatchedPredictions} · nierozliczone w kolejce: {settling ? settleProgress : "—"}</div>
          <p className="source-note">Nie pokazujemy skuteczności dla prognoz bez wyniku. Metryki nie są wyliczane z typów odrzuconych bez prawdopodobieństw.</p>
        </section>}
        {active === "pick" && <section className="module-panel">
          <div className="module-icon"><Sparkles/></div><h2>Selekcja bez zgadywania</h2>
          <p>Prognozy z całego skanu są dostępne po użyciu „Analizuj wszystkie” w zakładce Mecze. Kandydaci ≥75% trafiają do puli kuponów.</p>
          <div className="module-status"><span className="status-dot"/> Zapisane prognozy: {records.filter(row => row.kind === "prediction").length} · kandydaci: {records.filter(row => row.kind === "prediction" && row.status === "KANDYDAT").length}</div>
        </section>}

        <footer className="footer"><span>MONEYBALL — TRUST THE PROCESS</span><span>FRESH BUILD · DATA TRANSPARENCY FIRST</span></footer>
      </div>
    </main>
  </div>;
}
