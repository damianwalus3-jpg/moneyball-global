import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataError, EmptyState, PageHeader, PageLoader, SelectionBadge, SettlementBadge, TypeBadge } from "@/components/app/ui-bits";
import { isActivePredictionVersion } from "@/lib/domain";
import { fmtMoney, fmtOdds, fmtPct, matchLabel } from "@/lib/format";
import { ensureTables, useAction, useTable } from "@/lib/queries";
import { brusselsDayKey, fmtDateTime, fmtTime } from "@/lib/time";
import { getSupabase } from "@/lib/supabase";
import type { Prediction } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/wyniki")({
  head: () => ({ meta: [{ title: "Wyniki · MONEYBALL GLOBAL 2.0" }, { name: "description", content: "Chronologiczna historia wyników meczów i rozliczeń typów." }] }),
  loader: ({ context }) => ensureTables(context.queryClient, ["matches", "predictions", "match_results"]),
  pendingComponent: PageLoader,
  errorComponent: DataError,
  component: Wyniki,
});

type Filter = "all" | "final" | "rejected" | "jackpot";
function resultText(p: Prediction) {
  if (p.settlement_status === "won") return "Trafiony";
  if (p.settlement_status === "lost") return "Nietrafiony";
  if (p.settlement_status === "void") return "Zwrot";
  return "Oczekuje";
}
function profitFor(p: Prediction): number | null {
  if (p.profit_loss != null && Number.isFinite(Number(p.profit_loss))) return Number(p.profit_loss);
  const stake = Number(p.stake ?? 4);
  if (p.settlement_status === "lost") return -stake;
  if (p.settlement_status === "void") return 0;
  if (p.settlement_status === "won" && p.odds != null && Number(p.odds) > 1) return stake * (Number(p.odds) - 1);
  return null;
}
function Wyniki() {
  const matches = useTable("matches");
  const predictions = useTable("predictions");
  const results = useTable("match_results");
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const resultBy = useMemo(() => new Map(results.map(r => [r.match_id, r])), [results]);
  const active = useMemo(() => predictions.filter(p => isActivePredictionVersion(p.model_version)), [predictions]);
  const refresh = useAction(async () => {
    const sb = getSupabase();
    if (!sb) throw new Error("Brak połączenia z bazą.");
    const { data: session, error: sessionError } = await sb.auth.getSession();
    if (sessionError || !session.session?.access_token) throw new Error("Sesja wygasła. Zaloguj się ponownie.");
    const day = brusselsDayKey(new Date());
    const response = await sb.functions.invoke("moneyball-results-sync?date=" + encodeURIComponent(day), { body: {} });
    if (response.error) throw new Error("Aktualizacja wyników nie powiodła się: " + response.error.message);
    if (!response.data || response.data.ok === false) throw new Error(response.data?.error ?? "Nie udało się pobrać wyników.");
    return response.data;
  }, { success: r => "Odświeżono wyniki · dopasowano " + (r.matches_matched ?? 0) + " · rozliczono " + (r.predictions_settled ?? 0) + " typów" });

  const now = Date.now();
  const from = now - 72 * 60 * 60 * 1000;
  const to = now + 24 * 60 * 60 * 1000;
  const rows = matches
    .filter(m => m.kickoff_at && new Date(m.kickoff_at).getTime() >= from && new Date(m.kickoff_at).getTime() <= to)
    .map(match => ({ match, result: resultBy.get(match.id), picks: active.filter(p => p.match_id === match.id) }))
    .filter(({ picks }) => picks.length > 0)
    .filter(({ match, picks }) => {
      if (filter === "final" && !picks.some(p => p.verdict === "WYBRANY")) return false;
      if (filter === "rejected" && !picks.some(p => p.verdict === "ODRZUCONY")) return false;
      if (filter === "jackpot" && !picks.some(p => /jackpot/i.test(p.group_name))) return false;
      return !search || (matchLabel(match) + " " + (match.competition ?? "")).toLowerCase().includes(search.toLowerCase());
    })
    .sort((a,b) => (b.match.kickoff_at ?? "").localeCompare(a.match.kickoff_at ?? ""));
  const totalPicks = rows.reduce((n,r) => n+r.picks.length,0);
  const selectedPicks = rows.reduce((n,r) => n+r.picks.filter(p=>p.verdict==="WYBRANY").length,0);
  const verified = rows.filter(r=>r.result?.verified).length;
  const needsResult = rows.filter(r=>r.match.status==="finished" && !r.result?.verified).length;
  const grouped = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = brusselsDayKey(row.match.kickoff_at!);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(row);
  }
  return <div>
    <PageHeader eyebrow="Tracker · godziny Belgii (CET/CEST)" title="Wyniki · chronologicznie" description="Wyniki meczów oraz rozliczenia typów FINAL, ODRZUCONY i JACKPOT." actions={<Button variant="outline" onClick={()=>refresh.mutate()} disabled={refresh.isPending}><RefreshCw className={refresh.isPending ? "animate-spin" : ""}/>{refresh.isPending ? "Aktualizuję…" : "Odśwież"}</Button>} />
    <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
      <div className="surface-card p-3"><div className="text-xs text-muted-foreground">Mecze z typami</div><div className="num text-xl font-bold">{rows.length}</div></div>
      <div className="surface-card p-3"><div className="text-xs text-muted-foreground">Liczba typów</div><div className="num text-xl font-bold">{totalPicks}</div><div className="text-xs text-muted-foreground">{selectedPicks} wybranych</div></div>
      <div className="surface-card p-3"><div className="text-xs text-muted-foreground">Wyniki potwierdzone</div><div className="num text-xl font-bold text-success">{verified}/{rows.length}</div></div>
      <div className="surface-card p-3"><div className="text-xs text-muted-foreground">Do uzupełnienia</div><div className="num text-xl font-bold text-warning">{needsResult}</div></div>
    </div>
    <div className="mb-4 flex flex-wrap gap-2">
      {([["all","Wszystkie"],["final","FINAL"],["rejected","Odrzucone"],["jackpot","JACKPOT"]] as [Filter,string][]).map(([key,label])=><Button key={key} size="sm" variant={filter===key?"default":"outline"} onClick={()=>setFilter(key)}>{label}</Button>)}
      <div className="relative min-w-0 flex-1"><Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground"/><Input className="pl-8" placeholder="Szukaj meczu lub ligi…" value={search} onChange={e=>setSearch(e.target.value)}/></div>
    </div>
    <div className="mb-4 flex flex-wrap gap-2 text-xs">
      <span className="rounded-full border border-border px-3 py-2">● {verified} / {rows.length} z potwierdzonym wynikiem</span>
      <span className="rounded-full border border-warning/40 px-3 py-2 text-warning">{needsResult} wyników do sprawdzenia</span>
      <span className="rounded-full border border-border px-3 py-2">Godziny: Belgia (CET/CEST)</span>
    </div>
    {rows.length === 0 ? <EmptyState icon={CheckCircle2} title="Brak meczów z typami w tym okresie" description="Historia pozostaje zapisana w bazie. Ta lista pokazuje ostatnie 72 godziny i najbliższe 24 godziny."/> :
      <div className="grid gap-6">{Array.from(grouped.entries()).map(([day,items])=><section key={day}>
        <div className="mb-2 flex items-center justify-between border-b border-border pb-2"><div className="font-semibold">{day === brusselsDayKey(new Date()) ? "Dzisiaj" : "Historia · " + day}</div><Badge variant="muted">{items.length} meczów</Badge></div>
        <div className="grid gap-2">{items.map(({match,result,picks})=><article key={match.id} className="surface-card p-3 sm:p-4">
          <div className="flex items-start gap-3">
            <div className="w-14 shrink-0"><div className="num text-sm font-bold">{fmtTime(match.kickoff_at)}</div><div className="text-xs text-muted-foreground">{day.slice(5)}</div></div>
            <div className="min-w-0 flex-1"><div className="font-semibold leading-snug">{matchLabel(match)}</div><div className="mt-1 text-xs text-muted-foreground">{match.competition ?? match.league ?? "—"}</div></div>
            <div className="shrink-0 text-right">{result && result.home_score != null && result.away_score != null ? <><div className="num text-xl font-extrabold">{result.home_score} : {result.away_score}</div><div className="text-xs text-muted-foreground">{result.verified ? "Koniec · potwierdzony" : "Wynik niepotwierdzony"}</div></> : <><div className="text-sm font-semibold">{match.status === "live" ? "LIVE" : match.status === "finished" ? "Brak wyniku" : "—"}</div><div className="text-xs text-muted-foreground">{match.status}</div></>}</div>
          </div>
          <div className="mt-3 grid gap-2 border-t border-border pt-3">{picks.map(p=><div key={p.id} className="rounded-lg bg-secondary/25 p-2.5">
            <div className="flex flex-wrap items-center gap-2"><TypeBadge type={p.market}/><span className="font-semibold">{p.selection}</span><span className="text-xs text-muted-foreground">{fmtPct(p.probability)}</span><SelectionBadge status={p.verdict}/><span className="flex-1"/>{p.verdict==="WYBRANY" ? <SettlementBadge status={p.settlement_status}/> : <span className="text-xs text-muted-foreground">Nieobstawiony</span>}</div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground"><span>{p.group_name}</span>{p.verdict==="WYBRANY" && <><span>Kurs {fmtOdds(p.odds)}</span><span>Stawka {fmtMoney(p.stake ?? 4)}</span><span>Możliwy zwrot {fmtMoney(p.potential_return ?? (p.odds ? Number(p.stake ?? 4)*Number(p.odds) : null))}</span>{p.verified && <strong className={profitFor(p)==null ? "" : profitFor(p)!>=0 ? "text-success" : "text-destructive"}>Netto {fmtMoney(profitFor(p))}</strong>}</>}</div>
            {p.rationale && <p className="mt-1 text-xs text-muted-foreground">{p.rationale}</p>}
          </div>)}</div>
        </article>)}</div>
      </section>)}</div>}
  </div>;
}
