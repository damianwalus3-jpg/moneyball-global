import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CalendarDays, ChevronRight, ScanLine, Ticket, Trophy, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fmtMoney, fmtOdds } from "@/lib/format";
import { couponFinanceQuery, dashboardSelectedPicksQuery, dashboardSummaryQuery } from "@/lib/queries";
import { EmptyState, NoGuarantee, PageHeader, StatCard } from "@/components/app/ui-bits";
import { fmtPct } from "@/lib/format";
import { fmtDateTime } from "@/lib/time";

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
  finance?: import("@/lib/db").CouponFinanceSummary;
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
        <div className="mb-2 flex items-center justify-between"><h3 className="font-display font-bold">WYNIKI SEKCJI</h3><span className="text-xs text-muted-foreground">wszystkie rozliczone</span></div>
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
            <Button asChild><Link to="/mecze"><ScanLine /> Terminarz i skan</Link></Button>
            <Button variant="outline" asChild><Link to="/kupony"><Ticket /> Kupony</Link></Button>
          </>
        }
      />
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
                <div key={prediction.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-secondary/20 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{match.home_team} – {match.away_team}</div>
                    <div className="text-xs text-muted-foreground">{match.competition ?? match.league ?? "Liga Narodów"} · {match.kickoff_at ? new Date(match.kickoff_at).toLocaleString("pl-BE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : match.kickoff_date ?? "Termin nieznany"}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold">{market}: {prediction.selection}</div>
                    <div className="text-xs text-muted-foreground">Prawdopodobieństwo: {prediction.probability == null ? "—" : `${Number(prediction.probability).toFixed(1)}%`} · Kurs: {fmtOdds(prediction.odds)}</div>
                  </div>
                  <div className="flex min-w-[86px] flex-col items-end gap-1">
                    {score ? <span className="num text-base font-bold">{score}</span> : <span className="text-xs text-muted-foreground">{match.status === "finished" ? "Brak wyniku" : "Bez wyniku"}</span>}
                    <Badge variant={settlement === "WYGRANY" ? "success" : settlement === "PRZEGRANY" ? "danger" : settlement === "ZWROT" ? "muted" : "warning"}>{settlement}</Badge>
                  </div>
                  <div className="w-full border-t border-border pt-2">
                    <p className="text-xs font-semibold text-primary">Dlaczego model wybrał ten typ?</p>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {prediction.rationale?.trim() || "Model wskazał ten wariant na podstawie dostępnych danych przedmeczowych. Szczegółowe uzasadnienie nie zostało zapisane."}
                    </p>
                  </div>
                </div>
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
