import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, CircleDollarSign, FileUp, Flag, Globe, Pencil, Plus, ScanLine } from "lucide-react";
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
import { scanPublicFootball } from "@/lib/public-football";
import { MATCH_STATUS_LABELS } from "@/lib/domain";
import { fmtOdds } from "@/lib/format";
import { ensureTables, useAction, useTable } from "@/lib/queries";
import { brusselsDayKey, fmtDateTime, fmtDayLong, fmtTime } from "@/lib/time";
import type { Match, ScanRun } from "@/lib/types";

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
  const [view, setView] = useState<View>("upcoming");
  const [q, setQ] = useState("");
  const [editMatch, setEditMatch] = useState<Match | null>(null);
  const [matchOpen, setMatchOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [oddsFor, setOddsFor] = useState<string | null>(null);
  const [settle, setSettle] = useState<Match | null>(null);
  const [editScan, setEditScan] = useState<ScanRun | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const publicScan = useAction(scanPublicFootball, {
    success: (r) => `Źródło publiczne: ${r.inserted} nowych meczów, ${r.updated} aktualizacji, ${r.settledResults} rozliczonych wyników; ligi ${r.successfulLeagues}/${r.requestedLeagues}.`,
  });

  const resultBy = useMemo(() => new Map(results.map((r) => [r.match_id, r])), [results]);
  const latestOdds = useMemo(() => {
    const m = new Map<string, (typeof odds)[number]>();
    for (const o of odds) {
      const cur = m.get(o.match_id);
      if (!cur || (o.captured_at ?? "") > (cur.captured_at ?? "")) m.set(o.match_id, o);
    }
    return m;
  }, [odds]);
  const predCount = useMemo(() => {
    const m = new Map<string, { x12: number; dc: number; sel: number }>();
    for (const p of preds) {
      const c = m.get(p.match_id) ?? { x12: 0, dc: 0, sel: 0 };
      if (p.prediction_type === "DC") c.dc++;
      else c.x12++;
      if (p.selection_status === "WYBRANY") c.sel++;
      m.set(p.match_id, c);
    }
    return m;
  }, [preds]);

  const del = useAction((id: string) => deleteRow("matches", id), { success: "Usunięto mecz" });
  const delScan = useAction((id: string) => deleteRow("scan_runs", id), { success: "Usunięto skan" });

  const now = Date.now();
  const filtered = matches
    .filter((m) => {
      const t = m.kickoff_at ? new Date(m.kickoff_at).getTime() : 0;
      if (view === "upcoming") return t >= now - 2 * 3600_000;
      if (view === "past") return t < now;
      return true;
    })
    .filter((m) => !q || `${m.home_team} ${m.away_team} ${m.league} ${m.country}`.toLowerCase().includes(q.toLowerCase()))
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
        description="Wszystkie zeskanowane mecze — także ODRZUCONY. Skan publiczny pobiera terminarze i dostępne wyniki z wybranych lig ESPN; nie jest to pełne pokrycie światowe."
        actions={
          <>
            <Button variant="outline" onClick={() => publicScan.mutate({ daysBack: 3, daysForward: 10 })} disabled={publicScan.isPending}>
              <Globe /> {publicScan.isPending ? "Pobieranie danych…" : "Skan publiczny (bez klucza)"}
            </Button>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <FileUp /> Import skanu
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
                        {s.source ?? "—"} · {s.matches_count ?? n} meczów
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
                          {m.league ?? "—"}
                          {m.country ? ` · ${m.country}` : ""}
                          {c ? ` · 1X2: ${c.x12} · DC: ${c.dc} · wybrane: ${c.sel}` : " · brak prognoz"}
                        </div>
                        {o && (
                          <div className="num text-xs text-muted-foreground">
                            Kursy{o.bookmaker ? ` (${o.bookmaker})` : ""}: 1 {fmtOdds(o.odds_1)} · X {fmtOdds(o.odds_x)} · 2{" "}
                            {fmtOdds(o.odds_2)}
                          </div>
                        )}
                      </div>
                      {r ? (
                        <div className="num rounded-md bg-secondary px-2 py-1 text-lg font-semibold">
                          {r.home_goals}:{r.away_goals}
                        </div>
                      ) : (
                        <Badge variant={m.status === "cancelled" || m.status === "postponed" ? "muted" : "outline"}>
                          {MATCH_STATUS_LABELS[m.status ?? "scheduled"] ?? m.status}
                        </Badge>
                      )}
                      <div className="flex items-center">
                        <Button variant="ghost" size="icon" aria-label="Kursy" title="Dodaj kursy" onClick={() => setOddsFor(m.id)}>
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
                          description="Usunięcie meczu może usunąć też jego prognozy i wynik (zależnie od ustawień bazy). Tej operacji nie można cofnąć."
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

      {publicScan.data?.failedLeagues.length ? (
        <div className="mt-3 rounded-md border border-warning/40 p-3 text-xs text-warning">
          Nie udało się pobrać części lig: {publicScan.data.failedLeagues.join("; ")}
        </div>
      ) : null}
      {publicScan.data?.settlementErrors.length ? (
        <div className="mt-3 rounded-md border border-destructive/40 p-3 text-xs text-destructive">
          Błędy rozliczania wyników: {publicScan.data.settlementErrors.join("; ")}
        </div>
      ) : null}
      <MatchForm open={matchOpen} onOpenChange={setMatchOpen} match={editMatch} scanRuns={scans} />
      <ScanImportDialog open={importOpen} onOpenChange={setImportOpen} />
      <ScanRunForm open={scanOpen} onOpenChange={setScanOpen} scan={editScan} />
      <OddsForm
        open={oddsFor != null}
        onOpenChange={(o) => !o && setOddsFor(null)}
        matches={matches}
        defaultMatchId={oddsFor ?? undefined}
      />
      <SettleMatchDialog match={settle} onClose={() => setSettle(null)} />
    </div>
  );
}
