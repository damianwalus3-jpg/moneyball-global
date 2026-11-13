import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, ChevronDown, ChevronUp, CircleDollarSign, FileUp, Flag, Pencil, Plus, ScanLine } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ConfirmDelete, DataError, EmptyState, PageHeader, PageLoader } from "@/components/app/ui-bits";
import { ScanImportDialog } from "@/components/app/ScanImportDialog";
import { SettleMatchDialog } from "@/components/app/SettleMatchDialog";
import { MatchForm } from "@/components/forms/MatchForm";
import { OddsForm, ScanRunForm } from "@/components/forms/SimpleForms";
import { deleteRow } from "@/lib/db";
import { saveCouponBatch } from "@/lib/coupons";
import { isActivePredictionVersion, MATCH_STATUS_LABELS } from "@/lib/domain";
import { fmtMoney, fmtOdds, matchLabel, parseDecimal } from "@/lib/format";
import { ensureTables, useAction, useTable } from "@/lib/queries";
import { brusselsDayKey, fmtDateTime, fmtDayLong, fmtTime } from "@/lib/time";
import { getSupabase } from "@/lib/supabase";
import type { Match, Prediction, ScanRun } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/mecze")({
  head: () => ({
    meta: [
      { title: "Terminarz i mecze — MONEYBALL GLOBAL 2.0" },
      { name: "description", content: "Wszystkie zeskanowane mecze, import skanów CSV, kursy i wyniki." },
      { property: "og:title", content: "Terminarz — MONEYBALL GLOBAL 2.0" },
      { property: "og:description", content: "Zeskanowane mecze, kursy i wyniki." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) =>
    ensureTables(context.queryClient, [
      "matches",
      "scan_runs",
      "predictions",
      "match_results",
      "odds_snapshots",
      "coupons",
      "coupon_legs",
    ]),
  pendingComponent: PageLoader,
  errorComponent: DataError,
  component: Mecze,
});

type View = "upcoming" | "past" | "all" | "scans";

type RecentGame = { date?: string; result?: string; opponent?: string; goals_for?: number; goals_against?: number };
type TeamForm = { w?: number; d?: number; l?: number; matches?: number; goals_for?: number; goals_against?: number; last5?: RecentGame[]; last10?: RecentGame[] };

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function asTeamForm(value: unknown): TeamForm | null {
  const form = asObject(value);
  if (!Object.keys(form).length) return null;
  return form as TeamForm;
}
function recentGames(form: TeamForm | null): RecentGame[] {
  const games = Array.isArray(form?.last5) ? form.last5 : Array.isArray(form?.last10) ? form.last10 : [];
  return games.slice(0, 5);
}
function averageGoals(form: TeamForm | null, key: "goals_for" | "goals_against"): string | null {
  const games = recentGames(form);
  const values = games.map((game) => game[key] == null ? Number.NaN : Number(game[key])).filter(Number.isFinite);
  if (!values.length) return null;
  return (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1);
}
function formSummary(form: TeamForm | null): string | null {
  if (!form) return null;
  const w = Number(form.w ?? 0), d = Number(form.d ?? 0), l = Number(form.l ?? 0);
  if (![w, d, l].every(Number.isFinite) || w + d + l === 0) return null;
  return `${w} zwycięstw · ${d} remisów · ${l} porażek`;
}
function friendlyDate(value?: string): string {
  if (!value) return "—";
  const date = new Date(value + (value.length === 10 ? "T12:00:00" : ""));
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("pl-BE", { day: "2-digit", month: "2-digit" });
}
function resultLabel(value?: string): string {
  return value === "W" ? "W" : value === "D" ? "R" : value === "L" ? "P" : "—";
}
function readableReason(p: Prediction, home: TeamForm | null, away: TeamForm | null, coverage: Record<string, unknown>): string {
  const selection = String(p.selection);
  const total = Number(coverage.expected_total_goals);
  const homeExpected = Number(coverage.expected_home_goals);
  const awayExpected = Number(coverage.expected_away_goals);
  const parts: string[] = [];
  if (p.market === "GOALS" && coverage.expected_total_goals != null && coverage.expected_home_goals != null && coverage.expected_away_goals != null && Number.isFinite(total) && Number.isFinite(homeExpected) && Number.isFinite(awayExpected)) {
    parts.push(`Model przewiduje średnio około ${total.toFixed(2).replace(".", ",")} gola łącznie: ${homeExpected.toFixed(2).replace(".", ",")} dla gospodarzy i ${awayExpected.toFixed(2).replace(".", ",")} dla gości.`);
  }
  const homeScored = averageGoals(home, "goals_for"), homeConceded = averageGoals(home, "goals_against");
  const awayScored = averageGoals(away, "goals_for"), awayConceded = averageGoals(away, "goals_against");
  if (selection.startsWith("OVER") && Number.isFinite(total)) {
    const line = Number(selection.replace("OVER_", "").replace("_", "."));
    parts.push(`Przewidywana liczba goli jest ${total > line ? "powyżej" : "poniżej"} granicy ${line.toFixed(1).replace(".", ",")}.`);
  } else if (selection.startsWith("UNDER") && Number.isFinite(total)) {
    const line = Number(selection.replace("UNDER_", "").replace("_", "."));
    parts.push(`Przewidywana liczba goli jest ${total < line ? "poniżej" : "powyżej"} granicy ${line.toFixed(1).replace(".", ",")}.`);
  } else if (selection === "BTTS_YES" && homeScored && awayScored) {
    parts.push(`Obie drużyny regularnie zdobywają bramki: gospodarze średnio ${homeScored}, goście ${awayScored} gola na mecz w pokazanej serii.`);
  } else if (selection === "BTTS_NO" && (homeConceded || awayConceded)) {
    parts.push("Model ocenia, że co najmniej jedna z drużyn może mieć problem ze zdobyciem bramki; sprawdź jej ostatnie wyniki poniżej.");
  }
  const hs = formSummary(home), as = formSummary(away);
  if (hs) parts.push(`Forma gospodarzy: ${hs}.`);
  if (as) parts.push(`Forma gości: ${as}.`);
  if (parts.length) return parts.join(" ");
  const rationale = (p.rationale ?? "").toLowerCase();
  if (rationale.includes("brak wymaganych danych") || rationale.includes("nie została wyliczona"))
    return "Model nie miał wystarczających danych, aby wiarygodnie obliczyć tę prognozę. Dlatego typ został odrzucony.";
  if (rationale.includes("poiss")) return "Typ opiera się na przewidywanej liczbie bramek i wynikach ostatnich spotkań obu drużyn.";
  return p.rationale || "Brak wystarczających danych, aby wyjaśnić tę prognozę.";
}
function RecentFormCard({ title, form }: { title: string; form: TeamForm | null }) {
  const games = recentGames(form);
  return (
    <div className="rounded-lg border border-border bg-secondary/30 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">{title}</span>
        {formSummary(form) && <span className="text-[11px] text-muted-foreground">{formSummary(form)}</span>}
      </div>
      {games.length ? (
        <div className="grid gap-1.5">
          {games.map((game, index) => (
            <div key={`${game.date ?? "date"}-${game.opponent ?? "team"}-${index}`} className="flex items-center gap-2 text-xs">
              <span className="w-10 shrink-0 text-muted-foreground">{friendlyDate(game.date)}</span>
              <Badge variant={game.result === "W" ? "success" : game.result === "L" ? "danger" : "muted"}>{resultLabel(game.result)}</Badge>
              <span className="min-w-0 flex-1 truncate">{game.opponent ?? "Rywal nieznany"}</span>
              <strong className="num shrink-0">{Number.isFinite(Number(game.goals_for)) && Number.isFinite(Number(game.goals_against)) ? `${game.goals_for}:${game.goals_against}` : "—"}</strong>
            </div>
          ))}
        </div>
      ) : <p className="text-xs text-muted-foreground">Brak potwierdzonych ostatnich wyników.</p>}
      {form && <p className="mt-2 text-[11px] text-muted-foreground">Średnio zdobyte / stracone w pokazanej serii: {averageGoals(form, "goals_for") ?? "—"} / {averageGoals(form, "goals_against") ?? "—"}</p>}
    </div>
  );
}

function Mecze() {
  const matches = useTable("matches");
  const scans = useTable("scan_runs");
  const preds = useTable("predictions");
  const results = useTable("match_results");
  const odds = useTable("odds_snapshots");
  const couponLegs = useTable("coupon_legs");
  const coupons = useTable("coupons");
  const [view, setView] = useState<View>("upcoming");
  const [q, setQ] = useState("");
  const [editMatch, setEditMatch] = useState<Match | null>(null);
  const [matchOpen, setMatchOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [oddsFor, setOddsFor] = useState<string | null>(null);
  const [settle, setSettle] = useState<Match | null>(null);
  const [editScan, setEditScan] = useState<ScanRun | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [predictionProgress, setPredictionProgress] = useState("");
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);
  const [singleBetPrediction, setSingleBetPrediction] = useState<Prediction | null>(null);
  const [singleBetStake, setSingleBetStake] = useState("2");

  const saveSingleBet = useAction(async () => {
    const prediction = singleBetPrediction;
    const stake = parseDecimal(singleBetStake);
    if (!prediction || prediction.verdict !== "WYBRANY") throw new Error("Wybierz zatwierdzony typ.");
    if (prediction.odds == null || Number(prediction.odds) <= 1) throw new Error("Brak potwierdzonego kursu — nie zapisuję zakładu bez kursu.");
    if (stake == null || stake <= 0) throw new Error("Podaj stawkę większą od zera.");
    const match = matches.find((item) => item.id === prediction.match_id);
    if (!match) throw new Error("Nie znaleziono meczu.");
    await saveCouponBatch([[prediction]], {
      namePrefix: `SINGIEL · ${match.home_team} – ${match.away_team} · ${prediction.selection}`,
      couponType: "MAIN",
      scanRunId: match.scan_run_id,
      stake,
      recordStake: true,
      targetLegs: 1,
    });
  }, { success: "Zapisano pojedynczy zakład i pobrano stawkę z bankrolla", onDone: () => setSingleBetPrediction(null) });

  const delScan = useAction((id: string) => deleteRow("scan_runs", id), {
    success: "Usunięto skan",
  });

  const runEngine = useAction(async (_requestedDate: string) => {
    const date = brusselsDayKey(new Date());
    const sb = getSupabase();
    if (!sb) throw new Error("Brak połączenia z Supabase. Sprawdź Ustawienia → Połączenie z bazą.");
    const { data: sessionData, error: sessionError } = await sb.auth.getSession();
    if (sessionError || !sessionData.session?.access_token)
      throw new Error("Sesja logowania wygasła. Zaloguj się ponownie.");

    try {
      setPredictionProgress("Odświeżam dzisiejszy terminarz…");
      const sync = await sb.functions.invoke("footynomad-sync", { body: { date } });
      if (sync.error) throw new Error("Skan terminarza nie powiódł się: " + sync.error.message);
      if (sync.data?.error || sync.data?.ok === false)
        throw new Error("Skan terminarza nie powiódł się: " + (sync.data?.error ?? "Nieznany błąd źródła."));

      const totals = {
        matches: 0, predictions: 0, created: 0, updated: 0, preserved: 0,
        selected: 0, covered: 0, missing: 0, footy_form_matches: 0,
        github_form_matches: 0, batches: 0,
      };
      let offset = 0;
      let hasMore = true;
      const maxBatches = 100;

      while (hasMore && totals.batches < maxBatches) {
        setPredictionProgress("Analiza partii " + (totals.batches + 1) + " · od meczu " + (offset + 1) + "…");
        const prediction = await sb.functions.invoke("moneyball-predict", { body: { date, offset } });
        if (prediction.error) throw new Error("Prognozowanie partii " + (totals.batches + 1) + " nie powiodło się: " + prediction.error.message);
        if (!prediction.data || prediction.data.ok === false)
          throw new Error("Prognozowanie partii " + (totals.batches + 1) + " nie powiodło się: " + (prediction.data?.error ?? "Nieznany błąd silnika."));

        for (const key of [
          "matches", "predictions", "created", "updated", "preserved", "selected",
          "covered", "missing", "footy_form_matches", "github_form_matches",
        ] as const) {
          totals[key] += Number(prediction.data[key] ?? 0);
        }
        totals.batches += 1;
        hasMore = prediction.data.has_more === true;
        if (hasMore) offset += Math.max(1, Number(prediction.data.batch_size) || 30);
      }

      if (hasMore)
        throw new Error("Skan zatrzymano po " + maxBatches + " partiach. Uruchom go ponownie, aby dokończyć pozostałe mecze.");

      return { sync: sync.data, prediction: totals };
    } finally {
      setPredictionProgress("");
    }
  }, {
    success: (r) => "Skan: " + (r.sync?.combined_count ?? r.sync?.total_found ?? 0) +
      " meczów; prognozy: " + (r.prediction?.predictions ?? 0) +
      "; wybrane: " + (r.prediction?.selected ?? 0) +
      "; pełne dane: " + (r.prediction?.covered ?? 0) +
      "; braki danych: " + (r.prediction?.missing ?? 0) +
      "; forma FootyNomad/GitHub: " + (r.prediction?.footy_form_matches ?? 0) + "/" + (r.prediction?.github_form_matches ?? 0) +
      "; partie: " + (r.prediction?.batches ?? 0) +
      "; kupony pojedyncze i AKO: generator dostępny w zakładce Kupony" +
      "; wyniki: " + (r.sync?.result_sync?.ok ? "zsynchronizowane" : "wymagają kontroli") + ".",
  });

  const resultBy = useMemo(() => new Map(results.map((result) => [result.match_id, result])), [results]);
  const predictionById = useMemo(() => new Map(preds.map((prediction) => [prediction.id, prediction])), [preds]);
  const latestOdds = useMemo(() => {
    const byMatch = new Map<string, { snapshot: (typeof odds)[number]; prediction: Prediction }>();
    for (const snapshot of odds) {
      if (!snapshot.prediction_id) continue;
      const prediction = predictionById.get(snapshot.prediction_id);
      if (!prediction || !isActivePredictionVersion(prediction.model_version)) continue;
      const current = byMatch.get(prediction.match_id);
      if (!current || snapshot.captured_at > current.snapshot.captured_at)
        byMatch.set(prediction.match_id, { snapshot, prediction });
    }
    return byMatch;
  }, [odds, predictionById]);
  const predCount = useMemo(() => {
    const counts = new Map<string, { x12: number; dc: number; goals: number; sel: number }>();
    for (const prediction of preds.filter((item) => isActivePredictionVersion(item.model_version))) {
      const count = counts.get(prediction.match_id) ?? { x12: 0, dc: 0, goals: 0, sel: 0 };
      if (prediction.market === "DOUBLE_CHANCE") count.dc++;
      else if (prediction.market === "GOALS") count.goals++;
      else count.x12++;
      if (prediction.verdict === "WYBRANY") count.sel++;
      counts.set(prediction.match_id, count);
    }
    return counts;
  }, [preds]);

  const del = useAction(async (id: string) => {
    const linkedPredictions = preds.filter((prediction) => prediction.match_id === id);
    const predictionIds = new Set(linkedPredictions.map((prediction) => prediction.id));
    const linkedLegs = couponLegs.filter((leg) => predictionIds.has(leg.prediction_id));
    const hasResult = results.some((result) => result.match_id === id);
    if (linkedPredictions.length || linkedLegs.length || hasResult)
      throw new Error("Nie można usunąć meczu z historią prognoz, kuponów lub wyników. Zmień jego status na cancelled, aby zachować dane.");
    await deleteRow("matches", id);
  }, { success: "Usunięto pusty mecz" });

  const now = Date.now();
  const today = brusselsDayKey(new Date());
  const matchDay = (match: Match) => match.kickoff_at ? brusselsDayKey(match.kickoff_at) : match.kickoff_date ?? null;
  const matchSortKey = (match: Match) => match.kickoff_at ?? (match.kickoff_date ? `${match.kickoff_date}T23:59:59Z` : "");
  const filtered = matches
    .filter((match) => {
      const day = matchDay(match);
      const time = match.kickoff_at ? new Date(match.kickoff_at).getTime() : null;
      if (view === "upcoming") return time != null ? time >= now - 2 * 3600_000 : !!day && day >= today;
      if (view === "past") return time != null ? time < now : !!day && day < today;
      return true;
    })
    .filter((match) => !q || `${match.home_team} ${match.away_team} ${match.competition ?? match.league ?? ""} ${match.country ?? ""}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) =>
      view === "upcoming"
        ? matchSortKey(a).localeCompare(matchSortKey(b))
        : matchSortKey(b).localeCompare(matchSortKey(a)),
    );

  const groups = new Map<string, Match[]>();
  for (const match of filtered) {
    const key = matchDay(match) ?? "brak-daty";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(match);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Europe/Brussels"
        title="Terminarz / Mecze"
        description="Wszystkie zeskanowane mecze — także te z prognozami ODRZUCONY."
        actions={
          <>
            <div className="num flex h-9 items-center rounded-md border border-border px-3 text-sm text-muted-foreground">
              Dzisiaj · {brusselsDayKey(new Date())}
            </div>
            <Button onClick={() => runEngine.mutate(brusselsDayKey(new Date()))} disabled={runEngine.isPending}>
              <ScanLine /> {runEngine.isPending ? predictionProgress || "Skanowanie i analiza…" : "Skanuj i analizuj"}
            </Button>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <FileUp /> Import CSV
            </Button>
            <Button
              onClick={() => {
                setEditMatch(null);
                setMatchOpen(true);
              }}
            >
              <Plus /> Dodaj mecz
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(
          [
            ["upcoming", "Nadchodzące"],
            ["past", "Rozegrane"],
            ["all", "Wszystkie"],
            ["scans", `Skany (${scans.length})`],
          ] as const
        ).map(([v, l]) => (
          <Button key={v} size="sm" variant={view === v ? "default" : "outline"} onClick={() => setView(v)}>
            {l}
          </Button>
        ))}
        {view !== "scans" && (
          <Input placeholder="Szukaj drużyny lub ligi…" value={q} onChange={(e) => setQ(e.target.value)} className="h-8 max-w-xs" />
        )}
      </div>

      {view === "scans" ? (
        scans.length === 0 ? (
          <EmptyState
            icon={ScanLine}
            title="Brak skanów"
            description="Skan powstaje automatycznie przy imporcie CSV. Możesz też dodać go ręcznie."
            action={
              <Button
                onClick={() => {
                  setEditScan(null);
                  setScanOpen(true);
                }}
              >
                <Plus /> Nowy skan
              </Button>
            }
          />
        ) : (
          <div className="grid gap-2">
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditScan(null);
                  setScanOpen(true);
                }}
              >
                <Plus /> Nowy skan
              </Button>
            </div>
            {[...scans]
              .sort((a, b) => (b.started_at ?? "").localeCompare(a.started_at ?? ""))
              .map((s) => {
                const n = matches.filter((m) => m.scan_run_id === s.id).length;
                return (
                  <div key={s.id} className="surface-card flex items-center gap-3 p-3">
                    <ScanLine className="size-5 text-primary" />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{fmtDateTime(s.started_at)}</div>
                      <div className="text-xs text-muted-foreground">
                        {s.source ?? "—"} · {s.matches_found ?? n} meczów
                        {s.notes ? ` · ${s.notes}` : ""}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Edytuj skan"
                      onClick={() => {
                        setEditScan(s);
                        setScanOpen(true);
                      }}
                    >
                      <Pencil />
                    </Button>
                    <ConfirmDelete
                      title="Usunąć skan?"
                      description="Mecze z tego skanu pozostaną w bazie (o ile baza na to pozwala)."
                      onConfirm={() => delScan.mutate(s.id)}
                    />
                  </div>
                );
              })}
          </div>
        )
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={matches.length === 0 ? "Brak meczów" : "Brak meczów w tym widoku"}
          description={
            matches.length === 0
              ? "Zaimportuj skan CSV albo dodaj mecz ręcznie. Aplikacja nie tworzy przykładowych danych."
              : "Zmień filtr lub wyszukiwanie."
          }
          action={
            matches.length === 0 ? (
              <Button onClick={() => setImportOpen(true)}>
                <FileUp /> Import skanu
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-5">
          {[...groups.entries()].map(([day, list]) => (
            <section key={day}>
              <h2 className="eyebrow mb-2 capitalize">{day === "brak-daty" ? "Bez daty" : fmtDayLong(list[0]?.kickoff_at ?? (list[0]?.kickoff_date ? `${list[0].kickoff_date}T12:00:00Z` : null))}</h2>
              <div className="grid gap-2">
                {list.map((m) => {
                  const r = resultBy.get(m.id);
                  const c = predCount.get(m.id);
                  const o = latestOdds.get(m.id);
                  const started = m.status === "live" || m.status === "finished" || (m.kickoff_at ? new Date(m.kickoff_at).getTime() < now : false);
                  return (
                    <>
                    <div key={m.id} className="surface-card flex flex-wrap items-center gap-3 p-3">
                      <div className="num w-12 text-center text-sm font-semibold text-primary">{m.kickoff_at ? fmtTime(m.kickoff_at) : "Godzina nieznana"}</div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">
                          {m.home_team} – {m.away_team}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {m.competition ?? m.league ?? "—"}
                          {m.country ? ` · ${m.country}` : ""}
                          {c ? ` · 1X2: ${c.x12} · DC: ${c.dc} · wybrane: ${c.sel}` : " · brak prognoz"}
                        </div>
                        {o && (
                          <div className="num text-xs text-muted-foreground">
                            Kurs {fmtOdds(o.snapshot.odds)}{o.snapshot.bookmaker ? ` (${o.snapshot.bookmaker})` : ""} · {o.prediction.selection}
                          </div>
                        )}
                      </div>
                      {r ? (
                        <div className="rounded-md bg-secondary px-2 py-1 text-right">
                          <div className="num text-lg font-semibold">
                            {r.home_score == null || r.away_score == null ? "ZWROT" : String(r.home_score) + ":" + String(r.away_score)}
                          </div>
                          <div className="text-[10px] text-muted-foreground">{r.verified ? "zweryfikowano" : "do weryfikacji"}</div>
                        </div>
                      ) : (
                        <Badge variant={m.status === "cancelled" || m.status === "postponed" ? "muted" : "outline"}>
                          {MATCH_STATUS_LABELS[m.status ?? "scheduled"] ?? m.status}
                        </Badge>
                      )}
                      <div className="flex items-center">
                        <Button variant="ghost" size="sm" aria-expanded={expandedMatchId === m.id} onClick={() => setExpandedMatchId(expandedMatchId === m.id ? null : m.id)}>
                          {expandedMatchId === m.id ? <ChevronUp /> : <ChevronDown />} Szczegóły
                        </Button>
                        <Button variant="ghost" size="icon" aria-label="Kursy" title="Dodaj kursy" disabled={!preds.some((prediction) => prediction.match_id === m.id && isActivePredictionVersion(prediction.model_version))} onClick={() => setOddsFor(m.id)}>
                          <CircleDollarSign />
                        </Button>
                        {(started || r) && (
                          <Button variant="ghost" size="icon" aria-label="Wynik" title="Wpisz wynik" onClick={() => setSettle(m)}>
                            <Flag />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Edytuj mecz"
                          onClick={() => {
                            setEditMatch(m);
                            setMatchOpen(true);
                          }}
                        >
                          <Pencil />
                        </Button>
                        <ConfirmDelete
                          title="Usunąć mecz?"
                          description="Można usunąć tylko pusty mecz bez prognoz, wyników i nóg kuponów. Historię zachowujemy."
                          onConfirm={() => del.mutate(m.id)}
                        />
                      </div>
                    </div>
                    {expandedMatchId === m.id && (
                      <div className="surface-card mt-2 border border-primary/20 p-4">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <div className="font-semibold">{m.home_team} – {m.away_team}</div>
                          <Badge variant="outline">{m.competition ?? m.league ?? "Liga nieznana"}{m.country ? " · " + m.country : ""}</Badge>
                        </div>
                        {(() => {
                          const details = preds.filter((p) => p.match_id === m.id && isActivePredictionVersion(p.model_version))
                            .sort((a, b) => (a.market + a.selection).localeCompare(b.market + b.selection));
                          return details.length ? (
                            <div className="grid gap-3 md:grid-cols-2">
                              {details.map((p) => (
                                <div key={p.id} className="rounded-lg border border-border p-3">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="font-semibold">{p.market === "DOUBLE_CHANCE" ? "Double Chance" : p.market === "GOALS" ? "Gole / BTTS" : "1X2"} · {p.selection}</span>
                                    <Badge variant={p.verdict === "WYBRANY" ? "success" : "muted"}>{p.verdict}</Badge>
                                  </div>
                                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                                    <div><div className="text-xs text-muted-foreground">Prawdopodobieństwo</div><strong>{p.probability == null ? "Brak" : Number(p.probability).toFixed(1) + "%"}</strong></div>
                                    <div><div className="text-xs text-muted-foreground">Kurs wybranego typu</div><strong>{fmtOdds(p.odds)}{p.odds != null && asObject(p.data_coverage).odds_bookmaker ? ` · ${String(asObject(p.data_coverage).odds_bookmaker)}` : ""}</strong></div>
                                    <div><div className="text-xs text-muted-foreground">Pewność</div><strong>{p.confidence ?? "—"}</strong></div>
                                    <div><div className="text-xs text-muted-foreground">Rozliczenie</div><strong>{p.settlement_status}</strong></div>
                                  </div>
                                  {(() => {
                                    const linked = couponLegs.filter((leg) => leg.prediction_id === p.id)
                                      .map((leg) => ({ leg, coupon: coupons.find((item) => item.id === leg.coupon_id) }))
                                      .filter((item) => item.coupon);
                                    return linked.length ? (
                                      <div className="mt-3 grid gap-2">
                                        {linked.map(({ leg, coupon }) => {
                                          if (!coupon) return null;
                                          const stake = coupon.stake == null ? null : Number(coupon.stake);
                                          const single = coupon.target_legs === 1;
                                          const realized = coupon.status === "won" && stake != null && coupon.potential_return != null
                                            ? Number(coupon.potential_return) - stake
                                            : coupon.status === "lost" && stake != null ? -stake
                                            : coupon.status === "void" ? 0 : null;
                                          const possible = single && coupon.status === "pending" && stake != null && leg.odds != null
                                            ? stake * (Number(leg.odds) - 1) : null;
                                          return (
                                            <div key={leg.id} className="rounded-md border border-border bg-secondary/30 p-2 text-xs">
                                              <div className="flex flex-wrap items-center justify-between gap-2">
                                                <span className="font-semibold">{single ? "Twój singiel" : "Zakład w kuponie AKO"}</span>
                                                <Badge variant={coupon.status === "won" ? "success" : coupon.status === "lost" ? "danger" : coupon.status === "pending" ? "warning" : "muted"}>{coupon.status === "won" ? "Wygrany" : coupon.status === "lost" ? "Przegrany" : coupon.status === "void" ? "Zwrot" : "W grze"}</Badge>
                                              </div>
                                              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground">
                                                <span>Kurs: <strong className="text-foreground">{fmtOdds(leg.odds ?? p.odds)}</strong></span>
                                                <span>Stawka: <strong className="text-foreground">{stake == null ? "—" : fmtMoney(stake)}</strong></span>
                                                {realized != null && <span>Wynik: <strong className={realized > 0 ? "text-success" : realized < 0 ? "text-destructive" : "text-foreground"}>{realized > 0 ? "+" : ""}{fmtMoney(realized)}</strong></span>}
                                                {possible != null && <span>Możliwy zysk: <strong className="text-success">+{fmtMoney(possible)}</strong></span>}
                                                {single && coupon.status === "pending" && stake != null && <span>Możliwa strata: <strong className="text-destructive">−{fmtMoney(stake)}</strong></span>}
                                                {!single && <span>Wynik finansowy po rozliczeniu całego kuponu</span>}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    ) : null;
                                  })()}
                                  {p.verdict === "WYBRANY" && (
                                    <div className="mt-3">
                                      <Button size="sm" className="w-full" disabled={p.odds == null || Number(p.odds) <= 1} onClick={() => { setSingleBetStake("2"); setSingleBetPrediction(p); }}>
                                        {p.odds == null ? "Brak kursu — zakład niedostępny" : "Zapisz jako pojedynczy zakład"}
                                      </Button>
                                      {p.odds == null && <p className="mt-1 text-[11px] text-muted-foreground">Nie zapisujemy zakładu bez potwierdzonego kursu bukmachera.</p>}
                                    </div>
                                  )}
                                  {(() => {
                                    const coverage = asObject(p.data_coverage);
                                    const homeForm = asTeamForm(coverage.home_form);
                                    const awayForm = asTeamForm(coverage.away_form);
                                    const reason = readableReason(p, homeForm, awayForm, coverage);
                                    const rejected = p.verdict === "ODRZUCONY";
                                    return (
                                      <div className="mt-3 grid gap-3">
                                        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                                          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary">{rejected ? "Dlaczego typ odrzucono" : "Dlaczego model wybrał ten typ"}</div>
                                          <p className="text-sm leading-relaxed">{rejected && p.rationale?.toLowerCase().includes("brak wymaganych danych") ? reason : reason}</p>
                                          {p.market === "GOALS" && coverage.expected_total_goals != null && coverage.expected_home_goals != null && coverage.expected_away_goals != null && Number.isFinite(Number(coverage.expected_total_goals)) && (
                                            <div className="mt-2 flex flex-wrap gap-2 text-xs">
                                              <Badge variant="outline">Oczekiwane gole: {Number(coverage.expected_total_goals).toFixed(2)}</Badge>
                                              <Badge variant="outline">Gospodarze: {Number(coverage.expected_home_goals).toFixed(2)}</Badge>
                                              <Badge variant="outline">Goście: {Number(coverage.expected_away_goals).toFixed(2)}</Badge>
                                            </div>
                                          )}
                                          {coverage.xg_used === false && <p className="mt-2 text-[11px] text-muted-foreground">W tej prognozie nie było dostępnych danych xG — uzasadnienie opiera się na wynikach i formie.</p>}
                                        </div>
                                        <div>
                                          <div className="mb-2 text-sm font-semibold">Ostatnie 5 meczów każdej drużyny</div>
                                          <div className="grid gap-2 md:grid-cols-2">
                                            <RecentFormCard title={m.home_team} form={homeForm} />
                                            <RecentFormCard title={m.away_team} form={awayForm} />
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>
                              ))}
                            </div>
                          ) : <p className="text-sm text-muted-foreground">Dla tego meczu nie ma jeszcze prognoz aktywnego modelu.</p>;
                        })()}
                      </div>
                    )}
                    </>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <MatchForm open={matchOpen} onOpenChange={setMatchOpen} match={editMatch} scanRuns={scans} />
      <ScanImportDialog open={importOpen} onOpenChange={setImportOpen} />
      <ScanRunForm open={scanOpen} onOpenChange={setScanOpen} scan={editScan} />
      <OddsForm
        open={oddsFor != null}
        onOpenChange={(o) => !o && setOddsFor(null)}
        predictions={preds.filter((prediction) => prediction.match_id === oddsFor && isActivePredictionVersion(prediction.model_version))}
        matches={matches}
        defaultPredictionId={preds.find((prediction) => prediction.match_id === oddsFor && isActivePredictionVersion(prediction.model_version))?.id}
      />
      <Dialog open={singleBetPrediction != null} onOpenChange={(open) => { if (!open) setSingleBetPrediction(null); }}>
        <DialogContent className="bg-card">
          <DialogHeader><DialogTitle className="font-display text-xl uppercase">Zapisz pojedynczy zakład</DialogTitle></DialogHeader>
          {singleBetPrediction && (() => {
            const match = matches.find((item) => item.id === singleBetPrediction.match_id);
            const stake = parseDecimal(singleBetStake);
            const oddsValue = Number(singleBetPrediction.odds);
            const potentialReturn = stake != null && stake > 0 ? stake * oddsValue : null;
            return (
              <div className="grid gap-3">
                <div className="rounded-md border border-border bg-secondary/30 p-3">
                  <div className="font-semibold">{match ? matchLabel(match) : "Mecz"}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{singleBetPrediction.market} · {singleBetPrediction.selection}</div>
                  <div className="mt-2 text-sm">Kurs zapisany: <strong className="num">{fmtOdds(singleBetPrediction.odds)}</strong></div>
                </div>
                <label className="grid gap-1 text-sm">
                  <span className="font-medium">Stawka (€)</span>
                  <Input inputMode="decimal" className="num" value={singleBetStake} onChange={(event) => setSingleBetStake(event.target.value)} placeholder="np. 2,00" />
                </label>
                {potentialReturn != null && (
                  <div className="rounded-md bg-secondary/40 p-3 text-sm">
                    <div className="flex justify-between"><span>Potencjalny zwrot</span><strong className="num">{fmtMoney(potentialReturn)}</strong></div>
                    <div className="mt-1 flex justify-between"><span>Potencjalny zysk</span><strong className="num text-success">+{fmtMoney(potentialReturn - stake!)}</strong></div>
                    <div className="mt-1 flex justify-between"><span>Możliwa strata</span><strong className="num text-destructive">−{fmtMoney(stake!)}</strong></div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">Zapis utworzy kupon pojedynczy, zapisze dokładny kurs i odejmie stawkę od bankrolla. Wynik i zysk/strata zostaną rozliczone po potwierdzeniu wyniku meczu.</p>
              </div>
            );
          })()}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setSingleBetPrediction(null)}>Anuluj</Button>
            <Button type="button" disabled={saveSingleBet.isPending || parseDecimal(singleBetStake) == null || Number(parseDecimal(singleBetStake)) <= 0} onClick={() => saveSingleBet.mutate(undefined)}>{saveSingleBet.isPending ? "Zapisywanie…" : "Zapisz zakład"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <SettleMatchDialog match={settle} onClose={() => setSettle(null)} />
    </div>
  );
}
