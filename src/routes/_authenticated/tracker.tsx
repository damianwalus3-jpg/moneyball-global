import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Activity, Archive, BarChart3, CalendarDays, CircleDollarSign, ClipboardList,
  History, Layers3, ShieldCheck, Ticket, Trophy
} from "lucide-react";
import { DataError, EmptyState, NoGuarantee, PageHeader, PageLoader, StatCard } from "@/components/app/ui-bits";
import { fmtMoney, fmtPct } from "@/lib/format";
import {
  couponFinanceQuery, dashboardSelectedPicksQuery, dashboardSummaryQuery, latestScanRunQuery
} from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/tracker")({
  head: () => ({
    meta: [
      { title: "Tracker — MONEYBALL GLOBAL" },
      { name: "description", content: "Centralny rejestr typów, kuponów, wyników i finansów MONEYBALL GLOBAL." },
    ],
  }),
  component: TrackerPage,
});

const MODULES = [
  { title: "Typy i selekcje", description: "Rynki 1X2, Double Chance i gole; decyzje oraz rozliczenia.", to: "/prognozy-1x2", icon: ClipboardList },
  { title: "Kupony", description: "Kupony, nogi, kurs łączny i status rozliczenia.", to: "/kupony", icon: Ticket },
  { title: "Wyniki", description: "Weryfikacja rezultatów i rozliczenia meczów.", to: "/wyniki", icon: Trophy },
  { title: "Historia", description: "Pełna historia z paginacją i filtrowaniem.", to: "/historia", icon: History },
  { title: "Intelligence", description: "Skuteczność, ROI, kalibracja i wyniki według rynku.", to: "/statystyki", icon: BarChart3 },
  { title: "Bankroll", description: "Saldo wirtualne i audytowalny rejestr transakcji.", to: "/bankroll", icon: CircleDollarSign },
  { title: "Dane i kopie", description: "Diagnostyka połączenia, import/eksport i kopie danych.", to: "/ustawienia", icon: Archive },
] as const;

function dateLabel(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pl-BE", {
    timeZone: "Europe/Brussels", day: "2-digit", month: "2-digit",
    year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(date);
}

function marketLabel(value: string) {
  if (value === "DOUBLE_CHANCE") return "DOUBLE CHANCE";
  if (value === "GOALS") return "GOLE / BTTS";
  return "1X2";
}

function TrackerPage() {
  const summary = useQuery(dashboardSummaryQuery());
  const picks = useQuery(dashboardSelectedPicksQuery());
  const finance = useQuery(couponFinanceQuery());
  const scan = useQuery(latestScanRunQuery());

  if (summary.isPending && picks.isPending && finance.isPending && scan.isPending) {
    return <><PageHeader eyebrow="CENTRUM KONTROLI" title="Tracker" /><PageLoader /></>;
  }
  const firstError = summary.error ?? picks.error ?? finance.error ?? scan.error;
  if (firstError && !summary.data && !picks.data && !finance.data) {
    return <DataError error={firstError} reset={() => {
      void Promise.all([summary.refetch(), picks.refetch(), finance.refetch(), scan.refetch()]);
    }} />;
  }

  const s = summary.data;
  const f = finance.data;
  const p = picks.data ?? [];
  const scanRow = scan.data;
  const financeTypes = f?.by_type ?? {};
  const financeRows = Object.entries(financeTypes).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="CENTRUM KONTROLI · MAIN"
        title="MONEYBALL TRACKER"
        description="Jeden widok do kontroli selekcji, kuponów, wyników i finansów. Dane pochodzą z istniejącej bazy produkcyjnej; historia pozostaje nienaruszona."
        actions={<Link to="/panel" className="inline-flex items-center rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-secondary">Panel główny</Link>}
      />

      <section>
        <div className="mb-3 flex items-center gap-2">
          <Activity className="size-4 text-primary" />
          <h2 className="font-display text-xl font-bold uppercase">Stan operacyjny</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatCard label="Mecze dzisiaj" value={s?.matches_today ?? "—"} icon={CalendarDays} />
          <StatCard label="Kupony w grze" value={s?.coupons_in_play ?? "—"} icon={Ticket} />
          <StatCard label="Kandydaci" value={s?.candidates ?? "—"} hint="dzisiejszy zbiór modelu" icon={Layers3} />
          <StatCard label="Do rozliczenia" value={s?.to_settle ?? "—"} hint="typy i wyniki oczekujące" icon={ShieldCheck} tone={s?.to_settle ? "warning" : "default"} />
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <CircleDollarSign className="size-4 text-primary" />
          <h2 className="font-display text-xl font-bold uppercase">Finanse · kupony</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
          <StatCard label="Bankroll modelu" value={s?.bankroll == null ? "—" : fmtMoney(Number(s.bankroll))} hint="saldo z istniejącego rejestru" tone="primary" />
          <StatCard label="Wynik dzisiaj" value={f?.day.net == null ? "—" : fmtMoney(f.day.net)} hint={f ? `${f.day.count} rozliczonych kuponów` : "brak danych"} />
          <StatCard label="Wynik tygodnia" value={f?.week.net == null ? "—" : fmtMoney(f.week.net)} hint={f ? `${f.week.count} rozliczonych kuponów` : "brak danych"} />
          <StatCard label="Wynik miesiąca" value={f?.month.net == null ? "—" : fmtMoney(f.month.net)} hint={f ? `${f.month.count} rozliczonych kuponów` : "brak danych"} />
          <StatCard label="Wynik łącznie" value={f?.all.net == null ? "—" : fmtMoney(f.all.net)} hint={f ? `${f.all.count} rozliczonych kuponów` : "brak danych"} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">To zestawienie dotyczy istniejących rozliczeń kuponów. Nie dodaje stawek typów pojedynczych drugi raz do bankrolla.</p>
      </section>

      <section className="surface-card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-xl font-bold uppercase">Rejestr kategorii</h2>
            <p className="text-xs text-muted-foreground">Obecne typy kuponów odczytane z istniejącego podsumowania finansowego</p>
          </div>
          <span className="rounded-full border border-border px-2 py-1 text-xs text-muted-foreground">bez migracji danych</span>
        </div>
        {financeRows.length ? (
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {financeRows.map(([name, row]) => (
              <div key={name} className="rounded-lg border border-border bg-background/50 p-3">
                <p className="text-xs font-semibold uppercase text-muted-foreground">{name}</p>
                <p className="num mt-1 text-xl font-semibold">{row.count}</p>
                <p className="text-xs text-muted-foreground">{row.won} wygr. · {row.lost} przegr. · {row.void} zwrot</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Brak rozliczonych kategorii kuponów w podsumowaniu.</p>
        )}
        <div className="mt-3 rounded-lg border border-dashed border-border p-3">
          <div className="flex items-center gap-2 font-semibold"><Trophy className="size-4 text-primary" /> JACKPOT</div>
          <p className="mt-1 text-sm text-muted-foreground">Dedykowany rejestr z niezmienną numeracją #001, #002… wymaga jeszcze bezpiecznej, dodatkowej tabeli. Nie udaję, że jest już aktywny — najpierw sprawdzę zależności i przygotuję migrację bez naruszania starych kuponów.</p>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-display text-xl font-bold uppercase">Dzisiejsze wybrane typy</h2>
          <Link to="/prognozy-1x2" className="text-sm font-semibold text-primary">Otwórz prognozy ↗</Link>
        </div>
        {p.length ? (
          <div className="grid gap-2">
            {p.slice(0, 12).map((pick) => (
              <article key={pick.prediction_id} className="rounded-xl border border-border bg-card p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="break-words font-semibold">{pick.home_team} – {pick.away_team}</h3>
                    <p className="text-xs text-muted-foreground">{pick.competition ?? pick.league ?? "Liga nieznana"} · {dateLabel(pick.kickoff_at ?? pick.kickoff_date)}</p>
                  </div>
                  <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">{marketLabel(pick.market)}</span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                  <div><span className="block text-xs text-muted-foreground">Typ</span><strong>{pick.selection}</strong></div>
                  <div><span className="block text-xs text-muted-foreground">Prawdopodobieństwo</span><strong>{pick.probability == null ? "—" : fmtPct(Number(pick.probability))}</strong></div>
                  <div><span className="block text-xs text-muted-foreground">Kurs</span><strong>{pick.odds == null ? "—" : Number(pick.odds).toFixed(2)}</strong></div>
                  <div><span className="block text-xs text-muted-foreground">Rozliczenie</span><strong>{pick.settlement_status.toUpperCase()}</strong></div>
                </div>
                {pick.rationale && <p className="mt-2 border-t border-border pt-2 text-sm text-muted-foreground">{pick.rationale}</p>}
              </article>
            ))}
            {p.length > 12 && <p className="text-xs text-muted-foreground">Pokazano 12 z {p.length} typów. Pełny rejestr znajduje się w sekcji prognoz i historii.</p>}
          </div>
        ) : (
          <EmptyState icon={ClipboardList} title="Brak wybranych typów na dziś" description="Tracker nie tworzy przykładowych rekordów. Wszystkie mecze i prognozy pozostają w swoich rejestrach." action={<Link to="/mecze" className="text-sm font-semibold text-primary">Otwórz terminarz</Link>} />
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-display text-xl font-bold uppercase">Moduły Trackera</h2>
          <span className="text-xs text-muted-foreground">nawigacja do istniejących rejestrów</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {MODULES.map((module) => (
            <Link key={module.title} to={module.to} className="group rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-secondary/30">
              <div className="flex items-center gap-2 font-semibold"><module.icon className="size-4 text-primary" />{module.title}</div>
              <p className="mt-1 text-sm text-muted-foreground">{module.description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="font-display text-lg font-bold uppercase">Ostatni skan</h2>
        {scanRow ? (
          <div className="mt-2 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div><span className="block text-xs text-muted-foreground">Źródło</span><strong>{scanRow.source}</strong></div>
            <div><span className="block text-xs text-muted-foreground">Data skanu</span><strong>{scanRow.scan_date}</strong></div>
            <div><span className="block text-xs text-muted-foreground">Mecze znalezione</span><strong>{scanRow.matches_found}</strong></div>
            <div><span className="block text-xs text-muted-foreground">Status / start</span><strong>{scanRow.status.toUpperCase()} · {dateLabel(scanRow.started_at)}</strong></div>
          </div>
        ) : <p className="mt-2 text-sm text-muted-foreground">Brak zapisanego przebiegu skanu.</p>}
      </section>

      <NoGuarantee />
    </div>
  );
}
