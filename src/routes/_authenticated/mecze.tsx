import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, CircleDollarSign, FileUp, Flag, Pencil, Plus, ScanLine } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDelete, DataError, EmptyState, PageHeader, PageLoader } from "@/components/app/ui-bits";
import { ScanImportDialog } from "@/components/app/ScanImportDialog";
import { SettleMatchDialog } from "@/components/app/SettleMatchDialog";
import { MatchForm } from "@/components/forms/MatchForm";
import { OddsForm, ScanRunForm } from "@/components/forms/SimpleForms";
import { deleteRow } from "@/lib/db";
import { isActivePredictionVersion, MATCH_STATUS_LABELS } from "@/lib/domain";
import { fmtOdds } from "@/lib/format";
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

function Mecze() {
  const matches = useTable("matches");
  const scans = useTable("scan_runs");
  const preds = useTable("predictions");
  const results = useTable("match_results");
  const odds = useTable("odds_snapshots");
  const couponLegs = useTable("coupon_legs");
  const [view, setView] = useState<View>("upcoming");
  const [q, setQ] = useState("");
  const [editMatch, setEditMatch] = useState<Match | null>(null);
  const [matchOpen, setMatchOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [oddsFor, setOddsFor] = useState<string | null>(null);
  const [settle, setSettle] = useState<Match | null>(null);
  const [editScan, setEditScan] = useState<ScanRun | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanDate, setScanDate] = useState(() => brusselsDayKey(new Date()));

  const runEngine = useAction(async (date: string) => {
    const sb = getSupabase();
    if (!sb) throw new Error("Brak połączenia z Supabase. Sprawdź Ustawienia → Połączenie z bazą.");
    const { data: sessionData, error: sessionError } = await sb.auth.getSession();
    if (sessionError || !sessionData.session?.access_token)
      throw new Error("Sesja logowania wygasła. Zaloguj się ponownie.");

    const sync = await sb.functions.invoke("footynomad-sync", { body: { date } });
    if (sync.error) throw new Error("Skan terminarza nie powiódł się: " + sync.error.message);
    if (sync.data?.error || sync.data?.ok === false)
      throw new Error("Skan terminarza nie powiódł się: " + (sync.data?.error ?? "Nieznany błąd źródła."));

    const prediction = await sb.functions.invoke("moneyball-predict", { body: { date } });
    if (prediction.error) throw new Error("Prognozowanie nie powiodło się: " + prediction.error.message);
    if (prediction.data?.ok === false)
      throw new Error("Prognozowanie nie powiodło się: " + (prediction.data?.error ?? "Nieznany błąd silnika."));

    return { sync: sync.data, prediction: prediction.data };
  }, {
    success: (r) => "Skan: " + (r.sync?.combined_count ?? r.sync?.total_found ?? 0) +
      " meczów; prognozy: " + (r.prediction?.predictions ?? 0) +
      "; wybrane: " + (r.prediction?.selected ?? 0) +
      "; pełne dane: " + (r.prediction?.covered ?? 0) +
      "; braki danych: " + (r.prediction?.missing ?? 0) +
      "; forma FootyNomad/GitHub: " + (r.prediction?.footy_form_matches ?? 0) + "/" + (r.prediction?.github_form_matches ?? 0) +
      "; kupon 3/3: " + (r.prediction?.couponCreated ? "utworzony" : "brak kwalifikujących się typów") +
      "; wyniki: " + (r.sync?.result_sync?.ok ? "zsynchronizowane" : "wymagają kontroli") + ".",
  });

  const resultBy = useMemo(() => new Map(results.map((result) => [result.match_id, result])), [results]);
  const predictionById = useMemo(() => new Map(preds.map((prediction) => [prediction.id, prediction])), [preds]);
  const latestOdds = useMemo(() => {
    const byMatch = new Map<string, { snapshot: (typeof odds)[number]; prediction: Prediction }>();
    for (const snapshot of odds) {
      if (!snapshot.prediction_id) continue;
      const prediction = predictionById.get(snapshot.prediction_id);
      if (!prediction) continue;
      const current = byMatch.get(prediction.match_id);
      if (!current || snapshot.captured_at > current.snapshot.captured_at)
        byMatch.set(prediction.match_id, { snapshot, prediction });
    }
    return byMatch;
  }, [odds, predictionById]);
  const predCount = useMemo(() => {
    const counts = new Map<string, { x12: number; dc: number; sel: number }>();
    for (const prediction of preds.filter((item) => isActivePredictionVersion(item.model_version))) {
      const count = counts.get(prediction.match_id) ?? { x12: 0, dc: 0, sel: 0 };
      if (prediction.market === "DOUBLE_CHANCE") count.dc++;
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
  const filtered = matches
    .filter((m) => {
      const t = m.kickoff_at ? new Date(m.kickoff_at).getTime() : 0;
      if (view === "upcoming") return t >= now - 2 * 3600_000;
      if (view === "past") return t < now;
      return true;
    })
    .filter((m) => !q || `${m.home_team} ${m.away_team} ${m.competition} ${m.country}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) =>
      view === "upcoming"
        ? (a.kickoff_at ?? "").localeCompare(b.kickoff_at ?? "")
        : (b.kickoff_at ?? "").localeCompare(a.kickoff_at ?? ""),
    );

  const groups = new Map<string, Match[]>();
  for (const m of filtered) {
    const k = m.kickoff_at ? brusselsDayKey(m.kickoff_at) : "brak-daty";
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(m);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Europe/Brussels"
        title="Terminarz / Mecze"
        description="Wszystkie zeskanowane mecze — także te z prognozami ODRZUCONY."
        actions={
          <>
            <Input
              type="date"
              aria-label="Data skanu"
              value={scanDate}
              onChange={(e) => setScanDate(e.target.value)}
              className="h-9 w-40"
            />
            <Button onClick={() => runEngine.mutate(scanDate)} disabled={!scanDate || runEngine.isPending}>
              <ScanLine /> {runEngine.isPending ? "Skanowanie i analiza…" : "Skanuj i analizuj"}
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
              <h2 className="eyebrow mb-2 capitalize">{day === "brak-daty" ? "Bez daty" : fmtDayLong(list[0]?.kickoff_at ?? null)}</h2>
              <div className="grid gap-2">
                {list.map((m) => {
                  const r = resultBy.get(m.id);
                  const c = predCount.get(m.id);
                  const o = latestOdds.get(m.id);
                  const started = m.kickoff_at ? new Date(m.kickoff_at).getTime() < now : false;
                  return (
                    <div key={m.id} className="surface-card flex flex-wrap items-center gap-3 p-3">
                      <div className="num w-12 text-center text-sm font-semibold text-primary">{fmtTime(m.kickoff_at)}</div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">
                          {m.home_team} – {m.away_team}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {m.competition ?? "—"}
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
                        <Button variant="ghost" size="icon" aria-label="Kursy" title="Dodaj kursy" disabled={!preds.some((prediction) => prediction.match_id === m.id)} onClick={() => setOddsFor(m.id)}>
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
        predictions={preds.filter((prediction) => prediction.match_id === oddsFor)}
        matches={matches}
        defaultPredictionId={preds.find((prediction) => prediction.match_id === oddsFor)?.id}
      />
      <SettleMatchDialog match={settle} onClose={() => setSettle(null)} />
    </div>
  );
}
