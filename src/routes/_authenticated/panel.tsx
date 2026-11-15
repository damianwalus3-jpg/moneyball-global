import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { CalendarDays, ChevronRight, ScanLine, Ticket, Trophy, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { isActivePredictionVersion } from "@/lib/domain";
import { fmtOdds } from "@/lib/format";
import { ensureTables, useTable } from "@/lib/queries";
import { DataError, EmptyState, NoGuarantee, PageHeader, PageLoader, StatCard } from "@/components/app/ui-bits";
import { fmtPct } from "@/lib/format";
import { dashboardSummaryQuery } from "@/lib/queries";
import { brusselsDayKey } from "@/lib/time";

export const Route = createFileRoute("/_authenticated/panel")({
  head: () => ({ meta: [{ title: "Panel — MONEYBALL GLOBAL 2.0" }, { name: "description", content: "Podsumowanie prognoz, kuponów i bankrolla." }, { property: "og:title", content: "Panel — MONEYBALL" }, { property: "og:description", content: "Podsumowanie prognoz." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  loader: ({ context }) => Promise.all([context.queryClient.ensureQueryData(dashboardSummaryQuery()), ensureTables(context.queryClient, ["matches", "predictions", "match_results"])]),
  pendingComponent: PageLoader,
  errorComponent: DataError,
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

function Panel() {
  const { data: summary } = useSuspenseQuery(dashboardSummaryQuery());
  const matches = useTable("matches");
  const predictions = useTable("predictions");
  const results = useTable("match_results");
  const matchById = new Map(matches.map((match) => [match.id, match]));
  const resultByMatch = new Map(results.map((result) => [result.match_id, result]));
  const today = brusselsDayKey(new Date());
  const selectedPicks = predictions
    .filter((prediction) => prediction.verdict === "WYBRANY" && isActivePredictionVersion(prediction.model_version))
    .map((prediction) => ({ prediction, match: matchById.get(prediction.match_id), result: resultByMatch.get(prediction.match_id) }))
    .filter((item) => item.match && (item.match.kickoff_at ? brusselsDayKey(item.match.kickoff_at) : item.match.kickoff_date) === today)
    .sort((a, b) => (a.match!.kickoff_at ?? a.match!.kickoff_date ?? "").localeCompare(b.match!.kickoff_at ?? b.match!.kickoff_date ?? ""));
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
      <section className="mb-5 rounded-xl border border-primary/25 bg-card p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-bold uppercase">Dzisiejsze wybrane typy</h2>
            <p className="text-xs text-muted-foreground">Zatwierdzone typy aktywnego modelu · stawka analityczna 5 € na singiel</p>
          </div>
          <Badge variant="success">{selectedPicks.length} wybranych</Badge>
        </div>
        {selectedPicks.length ? (
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
