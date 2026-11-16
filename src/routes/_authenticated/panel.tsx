import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CalendarDays, ChevronRight, Loader2, ScanLine, Ticket, Trophy, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fmtMoney, fmtOdds } from "@/lib/format";
import { couponFinanceQuery, dashboardSelectedPicksQuery, dashboardSummaryQuery } from "@/lib/queries";
import { EmptyState, NoGuarantee, PageHeader, StatCard } from "@/components/app/ui-bits";
import { fmtPct } from "@/lib/format";
import { brusselsDayKey, fmtDateTime } from "@/lib/time";
import { getSupabase } from "@/lib/supabase";

export const Route = createFileRoute("/_authenticated/panel")({
  head: () => ({ meta: [{ title: "Panel — MONEYBALL GLOBAL 2.0" }, { name: "description", content: "Podsumowanie prognoz, kuponów i bankrolla." }, { property: "og:title", content: "Panel — MONEYBALL" }, { property: "og:description", content: "Podsumowanie prognoz." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Panel,
});

function DashboardTile({ to, label, value, hint, icon, tone = "default" }: {
  to: "/bankroll" | "/mecze" | "/statystyki" | "/kupony" | "/historia";
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  tone?: "default" | "primary" | "warning";
}) {
  return (
    <Link
      to={to}
      aria-label={`${label}: ${value}. Zobacz szczegóły`}
      className="group block min-w-0 rounded-xl outline-none transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
    >
      <StatCard label={label} value={value} hint={hint} icon={icon} tone={tone} className="h-full transition-colors group-hover:border-primary/50" />
      <span className="mt-1 flex items-center justify-end gap-1 px-1 text-xs font-semibold text-primary">
        Zobacz szczegóły <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}


type FinancePeriodKey = "day" | "week" | "month" | "all";
function FinanceDashboard({ finance, loading, error, retry }: {
  finance: import("@/lib/db").CouponFinanceSummary | undefined;
  loading: boolean; error: boolean; retry: () => void;
}) {
  const [periodKey, setPeriodKey] = useState<FinancePeriodKey>("week");
  const period = finance?.[periodKey];
  const typeLabels: Record<string,string> = { MAIN: "MAIN", MEGA: "MEGA", EXTRA: "EXTRA", TEST: "TEST" };
  const types = Object.entries(finance?.by_type ?? {}).sort(([a],[b]) => (["MAIN","MEGA","EXTRA","TEST"].indexOf(a) - ["MAIN","MEGA","EXTRA","TEST"].indexOf(b)));
  return (
    <section className="mb-5 rounded-2xl border border-primary/25 bg-card p-3 shadow-card sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div><h2 className="font-display text-lg font-bold">PODSUMOWANIE MONEYBALL</h2><p className="text-xs text-muted-foreground">Wirtualna symulacja · stawka 4 € · Europe/Brussels</p></div>
        <Badge variant="success">LIVE FINANSE</Badge>
      </div>
      <div className="mb-3 grid grid-cols-4 gap-1 rounded-xl bg-secondary/40 p-1">
        {([["day","Dzisiaj"],["week","Tydzień"],["month","Miesiąc"],["all","Cała historia"]] as [FinancePeriodKey,string][]).map(([key,label]) =>
          <Button key={key} size="sm" variant={periodKey===key ? "default" : "ghost"} className="px-1 text-xs" onClick={()=>setPeriodKey(key)}>{label}</Button>
        )}
      </div>
      {loading ? <p className="rounded-lg bg-secondary/30 p-3 text-sm text-muted-foreground">Ładowanie rozliczeń…</p> :
       error ? <div className="rounded-lg bg-secondary/30 p-3 text-sm"><p className="text-destructive">Nie udało się pobrać finansów.</p><Button className="mt-2" size="sm" variant="outline" onClick={retry}>Ponów</Button></div> :
       period ? <>
        <div className="mb-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-border bg-secondary/25 p-3"><div className="text-xs text-muted-foreground">Zysk / strata netto</div><div className={`num mt-1 text-2xl font-extrabold ${period.net == null ? "" : period.net >= 0 ? "text-success" : "text-destructive"}`}>{period.net == null ? "BRAK DANYCH" : (period.net>0?"+":"")+fmtMoney(period.net)}</div><div className="text-xs text-muted-foreground">{period.count} rozliczonych kuponów</div></div>
          <div className="rounded-xl border border-border bg-secondary/25 p-3"><div className="text-xs text-muted-foreground">Zwrot brutto</div><div className="num mt-1 text-2xl font-bold">{fmtMoney(period.payout)}</div><div className="text-xs text-muted-foreground">Stawki: {fmtMoney(period.stake)}</div></div>
        </div>
        {period.incomplete>0 && <p className="mb-3 rounded-lg border border-warning/30 bg-warning/10 p-2 text-xs text-warning">Niepełne dane finansowe: {period.incomplete}. Wynik netto jest ukryty, aby nie zaniżać ani nie zawyżać symulacji.</p>}
        <div className="mb-2 flex items-center justify-between"><h3 className="font-display font-bold">WYNIKI SEKCJI · CAŁA HISTORIA</h3><span className="text-xs text-muted-foreground">wszystkie rozliczone</span></div>
        <div className="grid grid-cols-2 gap-2">
          {types.map(([key,value]) => <div key={key} className="rounded-lg border border-border bg-secondary/20 p-3">
            <div className="flex justify-between gap-2 text-sm font-semibold"><span>{typeLabels[key] ?? key}</span><span className="text-muted-foreground">{value.won}/{value.count} wygrane</span></div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{width:`${value.count ? Math.min(100,value.won/value.count*100) : 0}%`}} /></div>
            <div className={`num mt-2 text-right font-bold ${value.net == null ? "" : value.net>=0 ? "text-success" : "text-destructive"}`}>{value.net==null ? "—" : (value.net>0?"+":"")+fmtMoney(value.net)}</div>
            <div className="text-right text-xs text-muted-foreground">{value.lost} przegrane · {value.void} zwroty · stawki {fmtMoney(value.stake)}</div>
            {value.incomplete>0 && <div className="text-xs text-warning">Brak danych: {value.incomplete}</div>}
          </div>)}
        </div>
        <div className="mt-4 flex items-center justify-between gap-2"><h3 className="font-display font-bold">OSTATNIE ROZLICZENIA</h3><Link to="/kupony" className="text-xs font-semibold text-primary">Pełna historia <ChevronRight className="inline size-3"/></Link></div>
        <div className="mt-2 grid gap-2">{finance?.history.slice(0,8).map(coupon=><div key={coupon.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
          <div className="min-w-0 flex-1"><div className="truncate font-semibold">{coupon.name}</div><div className="text-xs text-muted-foreground">{coupon.coupon_type} · {fmtDateTime(coupon.settled_at)}</div></div>
          <div className={`num font-bold ${coupon.net==null ? "" : coupon.net>=0 ? "text-success" : "text-destructive"}`}>{coupon.net==null ? "—" : (coupon.net>0?"+":"")+fmtMoney(coupon.net)}</div>
        </div>)}</div>
       </> : null}
    </section>
  );
}

function Panel() {
  // Dashboard sections load independently: a slow summary RPC must not hide the whole panel.
  const summaryQuery = useQuery(dashboardSummaryQuery());
  const selectedQuery = useQuery(dashboardSelectedPicksQuery());
  const financeQuery = useQuery(couponFinanceQuery());
  const [scanRunning, setScanRunning] = useState(false);
  const [scanProgress, setScanProgress] = useState("");
  const [scanError, setScanError] = useState("");
  const [scanSummary, setScanSummary] = useState<{ matches: number; predictions: number; selected: number; batches: number } | null>(null);

  // Manual fallback: run bounded sequential batches while the scheduled prediction cron is paused.
  const runManualScan = async () => {
    if (scanRunning) return;
    const sb = getSupabase();
    if (!sb) { setScanError("Brak połączenia z Supabase. Zaloguj się ponownie."); return; }
    setScanRunning(true); setScanError(""); setScanSummary(null);
    const date = brusselsDayKey(new Date());
    let offset = 0, batches = 0, matches = 0, predictions = 0, selected = 0;
    try {
      while (batches < 100) {
        setScanProgress(`Analiza partii ${batches + 1} · ${matches} meczów przeanalizowanych`);
        const { data, error } = await sb.functions.invoke("moneyball-predict", { body: { date, offset, batch_size: 10 } });
        if (error) throw error;
        if (!data?.ok) throw new Error(data?.error || "Silnik typowania nie potwierdził poprawnego wykonania.");
        batches += 1;
        matches += Number(data.matches || 0);
        predictions += Number(data.created || 0) + Number(data.updated || 0);
        selected += Number(data.selected || 0);
        if (!data.has_more) break;
        offset += 10;
      }
      if (batches >= 100) throw new Error("Osiągnięto limit bezpieczeństwa 100 partii. Sprawdź terminarz przed ponowieniem.");
      setScanSummary({ matches, predictions, selected, batches });
      setScanProgress("Skan zakończony. Odświeżam panel…");
      await Promise.all([summaryQuery.refetch(), selectedQuery.refetch(), financeQuery.refetch()]);
    } catch (error) {
      setScanError(error instanceof Error ? error.message : "Nie udało się wykonać ręcznego skanu.");
    } finally {
      setScanRunning(false);
      setScanProgress("");
    }
  };
  const summary = summaryQuery.data ?? { matches_today: 0, bankroll: null, coupons_in_play: 0, candidates: 0, to_settle: 0, hit_rates: { "1X2": { won: 0, settled: 0, rate: null }, DOUBLE_CHANCE: { won: 0, settled: 0, rate: null }, GOALS: { won: 0, settled: 0, rate: null } } };
  const selectedRows = selectedQuery.data ?? [];
  const selectedPicks = selectedRows.map((row) => ({
    prediction: {
      id: row.prediction_id,
      market: row.market,
      selection: row.selection,
      probability: row.probability,
      odds: row.odds,
      settlement_status: row.settlement_status,
      rationale: row.rationale,
      confidence: row.confidence,
      data_coverage: row.data_coverage,
    },
    match: {
      id: row.match_id,
      home_team: row.home_team,
      away_team: row.away_team,
      competition: row.competition,
      league: row.league,
      kickoff_at: row.kickoff_at,
      kickoff_date: row.kickoff_date,
      status: row.match_status,
    },
    result: row.home_score != null && row.away_score != null
      ? { home_score: row.home_score, away_score: row.away_score }
      : undefined,
  }));
  const hr1 = summary.hit_rates["1X2"] ?? { rate: null, won: 0, settled: 0 };
  const hrDc = summary.hit_rates["DOUBLE_CHANCE"] ?? { rate: null, won: 0, settled: 0 };
  const hrGoals = summary.hit_rates.GOALS;

  return (
    <div>
      <PageHeader
        eyebrow="Europe/Brussels · dzisiejszy przegląd"
        title="Panel"
        description="Najważniejsze informacje o dzisiejszych meczach, prognozach i kuponach."
        actions={
          <>
            <Button onClick={() => void runManualScan()} disabled={scanRunning}>{scanRunning ? <Loader2 className="animate-spin" /> : <ScanLine />}{scanRunning ? "Analizuję…" : "Skanuj dzisiejsze mecze"}</Button>
            <Button variant="outline" asChild><Link to="/mecze"><CalendarDays /> Terminarz</Link></Button>
            <Button variant="outline" asChild><Link to="/kupony"><Ticket /> Kupony</Link></Button>
          </>
        }
      />
      {(scanRunning || scanError || scanSummary) && <section className="mb-4 rounded-xl border border-primary/30 bg-card p-3 text-sm" aria-live="polite">
        <div className="flex items-center gap-2 font-semibold">{scanRunning && <Loader2 className="size-4 animate-spin" />}{scanRunning ? "Ręczny skan MONEYBALL" : scanError ? "Skan nie został ukończony" : "Skan zakończony"}</div>
        {scanProgress && <p className="mt-1 text-muted-foreground">{scanProgress}</p>}
        {scanSummary && <p className="mt-1">Przeanalizowano: <strong>{scanSummary.matches}</strong> meczów · zapisano/odświeżono: <strong>{scanSummary.predictions}</strong> typów · wybrane przez model: <strong>{scanSummary.selected}</strong> · partie: {scanSummary.batches}</p>}
        {scanError && <p className="mt-1 text-destructive">{scanError}</p>}
        <p className="mt-2 text-xs text-muted-foreground">Przycisk analizuje mecze już pobrane do bazy. Feed FootyNomad odświeża się osobno co 15 minut. Nie stawia zakładów ani nie tworzy kuponów automatycznie.</p>
      </section>}
      {summaryQuery.isError && (
        <div className="mb-4 rounded-xl border border-destructive/40 bg-card p-3 text-sm">
          <p className="font-semibold text-destructive">Nie udało się pobrać statystyk panelu</p>
          <p className="mt-1 text-muted-foreground">Panel jest dostępny, ale podsumowanie z bazy wymaga ponowienia. {summaryQuery.error instanceof Error ? summaryQuery.error.message : ""}</p>
          <Button className="mt-2" size="sm" variant="outline" onClick={() => void summaryQuery.refetch()}>Ponów statystyki</Button>
        </div>
      )}
      <FinanceDashboard finance={financeQuery.data} loading={financeQuery.isLoading} error={financeQuery.isError} retry={() => void financeQuery.refetch()} />
      <section className="mb-5 rounded-xl border border-primary/25 bg-card p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-bold uppercase">Dzisiejsze wybrane typy</h2>
            <p className="text-xs text-muted-foreground">Zatwierdzone typy aktywnego modelu · stawka analityczna 4 € na singiel</p>
          </div>
          <Badge variant="success">{selectedPicks.length} wybranych</Badge>
        </div>
        {selectedQuery.isLoading ? (
          <p className="rounded-lg bg-secondary/30 p-3 text-sm text-muted-foreground">Wczytywanie dzisiejszych typów…</p>
        ) : selectedQuery.isError ? (
          <div className="rounded-lg bg-secondary/30 p-3 text-sm">
            <p className="text-destructive">Nie udało się pobrać wybranych typów.</p>
            <Button className="mt-2" size="sm" variant="outline" onClick={() => void selectedQuery.refetch()}>Ponów typy</Button>
          </div>
        ) : selectedPicks.length ? (
          <div className="grid gap-2">
            {selectedPicks.map(({ prediction, match, result }) => {
              if (!match) return null;
              const market = prediction.market === "DOUBLE_CHANCE" ? "Double Chance" : prediction.market === "GOALS" ? "Gole" : "1X2";
              const score = result && result.home_score != null && result.away_score != null
                ? `${result.home_score} : ${result.away_score}`
                : null;
              const settlement = prediction.settlement_status === "won" ? "WYGRANY"
                : prediction.settlement_status === "lost" ? "PRZEGRANY"
                : prediction.settlement_status === "void" ? "ZWROT" : "OCZEKUJE";
              return (
                <article key={prediction.id} className="rounded-xl border border-primary/25 bg-secondary/15 p-3 sm:p-4">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <Badge variant="success">TYP WYBRANY PRZEZ MODEL</Badge>
                    <Badge variant={settlement === "WYGRANY" ? "success" : settlement === "PRZEGRANY" ? "danger" : settlement === "ZWROT" ? "muted" : "warning"}>{settlement}</Badge>
                  </div>
                  <h3 className="break-words text-base font-bold leading-snug">{match.home_team} – {match.away_team}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{match.competition ?? match.league ?? "Rozgrywki niepodane"} · {match.kickoff_at ? new Date(match.kickoff_at).toLocaleString("pl-BE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : match.kickoff_date ?? "Termin nieznany"}</p>
                  <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">Dokładnie wybrany typ</p>
                    <p className="mt-1 text-xl font-extrabold">{market} · {prediction.selection}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {prediction.market === "1X2" ? (prediction.selection === "1" ? "Zwycięstwo gospodarzy" : prediction.selection === "X" ? "Remis" : "Zwycięstwo gości")
                        : prediction.market === "DOUBLE_CHANCE" ? (prediction.selection === "1X" ? "Gospodarze wygrają lub będzie remis" : prediction.selection === "X2" ? "Remis lub zwycięstwo gości" : "Nie będzie remisu")
                        : ({ BTTS_YES: "Obie drużyny strzelą gola", BTTS_NO: "Nie obie drużyny strzelą gola", "OVER_1.5": "Powyżej 1,5 gola", "UNDER_1.5": "Poniżej 1,5 gola", "OVER_2.5": "Powyżej 2,5 gola", "UNDER_2.5": "Poniżej 2,5 gola", "OVER_3.5": "Powyżej 3,5 gola", "UNDER_3.5": "Poniżej 3,5 gola" } as Record<string,string>)[prediction.selection] ?? prediction.selection}
                    </p>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-border bg-card/60 p-2"><p className="text-xs text-muted-foreground">Prawdopodobieństwo modelu</p><p className="num text-lg font-bold">{prediction.probability == null ? "—" : `${Number(prediction.probability).toFixed(1)}%`}</p></div>
                    <div className="rounded-lg border border-border bg-card/60 p-2"><p className="text-xs text-muted-foreground">Kurs zapisany przy typie</p><p className="num text-lg font-bold">{fmtOdds(prediction.odds)}</p></div>
                    <div className="rounded-lg border border-border bg-card/60 p-2"><p className="text-xs text-muted-foreground">Pokrycie danych (0–100)</p><p className="text-base font-bold">{prediction.confidence ?? "Nie zapisana"}</p></div>
                    <div className="rounded-lg border border-border bg-card/60 p-2"><p className="text-xs text-muted-foreground">Wynik meczu</p><p className="text-base font-bold">{score ?? (match.status === "finished" ? "Brak wyniku" : "Oczekuje")}</p></div>
                  </div>
                  <div className="mt-3 rounded-lg border border-primary/35 bg-primary/5 p-3">
                    <p className="text-sm font-bold text-primary">DLACZEGO MODEL WYBRAŁ TEN TYP?</p>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
                      {prediction.rationale?.trim() || "Model nie zapisał opisowego uzasadnienia. Poniżej pokazujemy wyłącznie kryteria i dane, które faktycznie zostały zapisane."}
                    </p>
                    <div className="mt-3 border-t border-primary/20 pt-3">
                      <p className="text-xs font-bold uppercase tracking-wide text-primary">Warunki zatwierdzenia typu</p>
                      <div className="mt-2 grid gap-2 text-sm">
                        <div className="flex items-center justify-between gap-3"><span>Prawdopodobieństwo powyżej 75%</span><strong className={Number(prediction.probability)>75?"text-success":"text-warning"}>{prediction.probability == null ? "Brak danych" : Number(prediction.probability).toFixed(1)+"%"}</strong></div>
                        <div className="flex items-center justify-between gap-3"><span>Pokrycie danych modelu (min. 55%)</span><strong className={Number(prediction.confidence)>=55?"text-success":"text-warning"}>{prediction.confidence == null ? "Nie podano" : prediction.confidence+"%"}</strong></div>
                        <div className="flex items-center justify-between gap-3"><span>Kurs dla wybranego rynku</span><strong className={prediction.odds && Number(prediction.odds)>1?"text-success":"text-warning"}>{fmtOdds(prediction.odds)}</strong></div>
                        <div className="flex items-center justify-between gap-3"><span>Decyzja modelu</span><strong className="text-success">WYBRANY</strong></div>
                      </div>
                    </div>
                  </div>
                  {prediction.data_coverage && Object.keys(prediction.data_coverage).length > 0 && (() => {
                    const data = prediction.data_coverage as Record<string, any>;
                    const formLine = (form: any) => {
                      if (!form) return "Brak potwierdzonej formy";
                      const w = Number(form.w ?? 0), d = Number(form.d ?? 0), l = Number(form.l ?? 0);
                      const matches = Number(form.matches ?? form.last10?.length ?? (w+d+l));
                      const goals = form.goals_for != null && form.goals_against != null ? " · gole "+form.goals_for+":"+form.goals_against : "";
                      return matches ? `${w}W · ${d}R · ${l}P z ${matches}${goals}` : "Dane formy bez bilansu W/R/P";
                    };
                    const rows: [string,string][] = [
                      ["Źródło modelu", String(data["model_source"] ?? data["history_source"] ?? "Nie zapisano")],
                      ["Źródło kursu", [data["odds_source"], data["odds_bookmaker"]].filter(Boolean).join(" · ") || "Nie zapisano"],
                      ["Ostatnie mecze gospodarzy", formLine(data["home_form"])],
                      ["Ostatnie mecze gości", formLine(data["away_form"])],
                      ["Liczba meczów w historii gospodarzy / gości", `${data["home_history_matches"] ?? data["home_form"]?.matches ?? "—"} / ${data["away_history_matches"] ?? data["away_form"]?.matches ?? "—"}`],
                      ["xG wykorzystane w modelu", data["historical_xg_used"] ? "Tak" : "Nie — brak wymaganych świeżych danych"],
                      ["Próbka xG · gospodarze / goście", `${data["historical_xg_home_matches"] ?? 0} / ${data["historical_xg_away_matches"] ?? 0} meczów`],
                      ["Źródła xG faktycznie użyte", Array.isArray(data["historical_xg_sources"]) && data["historical_xg_sources"].length ? data["historical_xg_sources"].join(", ") : "Brak"],
                      ["Aktualizacja zbiorów xG", [data["openplay_xg_generated_at"] ? "OpenPlay " + String(data["openplay_xg_generated_at"]).slice(0,10) : null, data["statsbomb_xg_generated_at"] ? "StatsBomb " + String(data["statsbomb_xg_generated_at"]).slice(0,10) : null, data["asa_xg_generated_at"] ? "ASA " + String(data["asa_xg_generated_at"]).slice(0,10) : null].filter(Boolean).join(" · ") || "Brak metadanych"],
                      ["Kalibracja prawdopodobieństwa", data["calibration_method"] ?? "Nie podano"],
                      ["Rating Elo gospodarzy / gości", data["elo_used"] ? `${data["home_elo"] ?? "—"} / ${data["away_elo"] ?? "—"} (różnica ${data["elo_diff"] ?? "—"})` : "Nie wykorzystano"],
                      ["Składy i kontuzje", data["squad_note"] ?? "Brak potwierdzonej informacji o składzie meczowym."],
                      ["Kontuzje gospodarzy / gości", `${data["home_injuries_available"] ? (data["home_injury_count"] ?? "potwierdzone") : "brak danych"} / ${data["away_injuries_available"] ? (data["away_injury_count"] ?? "potwierdzone") : "brak danych"}`],
                    ];
                    return <div className="mt-2 rounded-lg border border-border bg-card/50 p-3">
                      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Szczegóły analizy i dane źródłowe</p>
                      <div className="mt-2 grid gap-2">
                        {rows.map(([label,value]) => <div key={label} className="grid grid-cols-1 gap-0.5 border-b border-border/60 pb-2 last:border-0"><span className="text-xs text-muted-foreground">{label}</span><span className="break-words text-sm font-medium">{value}</span></div>)}
                      </div>
                    </div>;
                  })()}
                </article>
              );
            })}
          </div>
        ) : (
          <p className="rounded-lg bg-secondary/30 p-3 text-sm text-muted-foreground">Nie ma jeszcze zatwierdzonych typów na dziś. Otwórz terminarz i uruchom skan oraz analizę.</p>
        )}
        <div className="mt-3 flex justify-end">
          <Link to="/kupony" className="text-sm font-semibold text-primary">Przejdź do kuponów i singli <ChevronRight className="inline size-4" /></Link>
        </div>
      </section>
      <p className="mb-3 text-sm text-muted-foreground">Najważniejsze typy są na górze, a niżej znajdziesz statystyki i pozostałe sekcje.</p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <DashboardTile to="/mecze" label="Mecze dziś" value={summary.matches_today} icon={CalendarDays} />
        <DashboardTile to="/statystyki" label="Skuteczność 1X2" value={fmtPct(hr1.rate)} hint={`${hr1.won}/${hr1.settled} · historia modelu`} icon={Trophy} />
        <DashboardTile to="/statystyki" label="Skuteczność DC" value={fmtPct(hrDc.rate)} hint={`${hrDc.won}/${hrDc.settled} · historia modelu`} icon={Trophy} />
        <DashboardTile to="/statystyki" label="Skuteczność goli" value={fmtPct(hrGoals?.rate ?? null)} hint={`${hrGoals?.won ?? 0}/${hrGoals?.settled ?? 0} · historia modelu`} icon={Trophy} />
        <DashboardTile to="/kupony" label="Kupony w grze" value={summary.coupons_in_play} icon={Ticket} />
        <DashboardTile to="/kupony" label="Kandydaci >75%" value={summary.candidates} hint="dzisiejsze mecze · powyżej 75%" icon={Trophy} />
        <DashboardTile to="/historia" label="Do rozliczenia" value={summary.to_settle} hint="wyniki i rozliczenia" icon={CalendarDays} tone={summary.to_settle ? "warning" : "default"} />
      </div>
      {summary.matches_today === 0 && (
        <div className="mt-6">
          <EmptyState icon={CalendarDays} title="Brak meczów" description="Zaimportuj skan CSV lub dodaj pierwszy mecz w Terminarzu." />
        </div>
      )}
      <NoGuarantee className="mt-6" />
    </div>
  );
}
