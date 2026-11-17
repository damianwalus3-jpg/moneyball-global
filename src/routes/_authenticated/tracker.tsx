import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Activity, Archive, BarChart3, CalendarDays, CircleDollarSign, ClipboardList,
  History, Layers3, ShieldCheck, Ticket, Trophy
} from "lucide-react";
import { DataError, EmptyState, NoGuarantee, PageHeader, PageLoader, StatCard } from "@/components/app/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fmtMoney, fmtPct } from "@/lib/format";
import { formatJackpotSequence, makeTrackerCategoryKey } from "@/lib/tracker-domain";
import { insertRow, updateRow } from "@/lib/db";
import {
  couponFinanceQuery, dashboardSelectedPicksQuery, dashboardSummaryQuery, latestScanRunQuery,
  trackerCategoriesQuery, jackpotEntriesQuery, trackerCategorySummaryQuery, tableQuery, useAction
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
  const categories = useQuery(trackerCategoriesQuery());
  const categorySummary = useQuery(trackerCategorySummaryQuery());
  const jackpot = useQuery(jackpotEntriesQuery());
  const coupons = useQuery(tableQuery("coupons"));
  const [jackpotCouponId, setJackpotCouponId] = useState("");
  const [jackpotTitle, setJackpotTitle] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryGroup, setNewCategoryGroup] = useState<"CORE" | "SPORT">("CORE");
  const addJackpot = useAction(
    async (args: { couponId: string; title: string }) => insertRow("moneyball_jackpot_entries", {
      coupon_id: args.couponId,
      title: args.title.trim(),
    }),
    {
      success: "Dodano kupon do rejestru JACKPOT",
      onDone: () => { setJackpotCouponId(""); setJackpotTitle(""); },
    },
  );
  const addCategory = useAction(
    async (args: { name: string; key: string; group: "CORE" | "SPORT"; sortOrder: number }) => insertRow("moneyball_tracker_categories", {
      category_key: args.key,
      display_name: args.name,
      description: null,
      category_group: args.group,
      sort_order: args.sortOrder,
      is_system: false,
      include_in_official_finance: false,
    }),
    {
      success: "Dodano własną kategorię Trackera",
      onDone: () => setNewCategoryName(""),
    },
  );
  const toggleCategory = useAction(
    async (args: { id: string; is_active: boolean }) => updateRow("moneyball_tracker_categories", args.id, { is_active: args.is_active }),
    { success: "Zmieniono status kategorii Trackera" },
  );

  if (summary.isPending && picks.isPending && finance.isPending && scan.isPending && categories.isPending && categorySummary.isPending && jackpot.isPending && coupons.isPending) {
    return <><PageHeader eyebrow="CENTRUM KONTROLI" title="Tracker" /><PageLoader /></>;
  }
  const firstError = summary.error ?? picks.error ?? finance.error ?? scan.error ?? categories.error ?? categorySummary.error ?? jackpot.error ?? coupons.error;
  if (firstError && !summary.data && !picks.data && !finance.data) {
    return <DataError error={firstError} reset={() => {
      void Promise.all([summary.refetch(), picks.refetch(), finance.refetch(), scan.refetch(), categories.refetch(), categorySummary.refetch(), jackpot.refetch(), coupons.refetch()]);
    }} />;
  }

  const s = summary.data;
  const f = finance.data;
  const p = picks.data ?? [];
  const scanRow = scan.data;
  const categoryRows = categories.data ?? [];
  const categoryCounts = new Map((categorySummary.data?.categories ?? []).map((category) => [category.category_key, category]));
  const newCategoryKey = (() => { try { return makeTrackerCategoryKey(newCategoryName); } catch { return ""; } })();
  const categoryKeyExists = categoryRows.some((category) => category.category_key === newCategoryKey);
  const jackpotRows = jackpot.data ?? [];
  const couponRows = coupons.data ?? [];
  const couponById = new Map(couponRows.map((coupon) => [coupon.id, coupon]));
  const financeTypes = f?.by_type ?? {};
  const financeRows = Object.entries(financeTypes).sort(([a], [b]) => a.localeCompare(b));
  const intelligenceGroups = [
    ["Decyzje", categorySummary.data?.decisions ?? []],
    ["Źródła prognoz", categorySummary.data?.prediction_sources ?? []],
    ["Źródła kuponów", categorySummary.data?.coupon_sources ?? []],
    ["Rozliczenia prognoz", categorySummary.data?.prediction_settlements ?? []],
    ["Statusy kuponów", categorySummary.data?.coupon_settlements ?? []],
  ] as const;

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
        <p className="mt-2 text-xs text-muted-foreground">To zestawienie dotyczy istniejących rozliczeń kuponów. Nie dodaje stawek typów pojedynczych drugi raz do bankrolla. Starsze rekordy nie mają jeszcze pełnej klasyfikacji USER / MODEL / PAPER — nie przypisuję jej automatycznie, także na podstawie samej etykiety TEST.</p>
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
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-semibold uppercase">Kategorie z bazy Trackera</h3>
          {categories.error ? (
            <p className="text-sm text-destructive">{categories.error.message}</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
                {categoryRows.map((category) => (
                  <div key={category.id} className="rounded-lg border border-border bg-background/40 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <span className={category.is_active ? "text-sm font-semibold" : "text-sm font-semibold text-muted-foreground"}>{category.display_name}</span>
                      <div className="flex items-center gap-2">
                        <span className={category.is_system ? "text-[10px] font-semibold text-muted-foreground" : category.is_active ? "text-[10px] font-semibold text-success" : "text-[10px] font-semibold text-muted-foreground"}>
                          {category.is_system ? "SYSTEM" : category.is_active ? "WŁASNA" : "ARCHIWALNA"}
                        </span>
                        {!category.is_system && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={toggleCategory.isPending}
                            onClick={() => toggleCategory.mutate({ id: category.id, is_active: !category.is_active })}
                          >
                            {category.is_active ? "Archiwizuj" : "Przywróć"}
                          </Button>
                        )}
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{category.description ?? category.category_key}</p>
                    <p className="mt-2 text-xs font-medium">{categoryCounts.get(category.category_key)?.prediction_count ?? 0} prognoz · {categoryCounts.get(category.category_key)?.coupon_count ?? 0} kuponów</p>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Systemowe kategorie i mapowania historycznych etykiet są tylko do odczytu. Stare MAIN pozostaje oddzielone od MAIN A i MAIN B.</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_140px_auto]">
                <Input value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} placeholder="Nazwa własnej kategorii" maxLength={80} />
                <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={newCategoryGroup} onChange={(event) => setNewCategoryGroup(event.target.value as "CORE" | "SPORT")}>
                  <option value="CORE">CORE</option>
                  <option value="SPORT">SPORT</option>
                </select>
                <Button
                  variant="outline"
                  disabled={!newCategoryName.trim() || !newCategoryKey || categoryKeyExists || addCategory.isPending}
                  onClick={() => {
                    addCategory.mutate({
                      name: newCategoryName.trim(),
                      key: newCategoryKey,
                      group: newCategoryGroup,
                      sortOrder: Math.max(0, ...categoryRows.map((category) => category.sort_order)) + 10,
                    });
                  }}
                >
                  {addCategory.isPending ? "Zapisywanie…" : "Dodaj kategorię"}
                </Button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Własne kategorie są prywatne dla konta i domyślnie wyłączone z oficjalnych finansów. Przypisywanie ich do historycznych rekordów pozostaje jawne — nie zmieniam starych etykiet automatycznie.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {intelligenceGroups.map(([groupTitle, rows]) => (
                  <div key={groupTitle} className="rounded-lg border border-border bg-background/40 p-3">
                    <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{groupTitle}</h4>
                    {rows.length ? (
                      <div className="space-y-1">
                        {rows.map((row) => (
                          <div key={row.label} className="flex items-center justify-between gap-2 text-sm">
                            <span>{row.label}</span>
                            <span className="num font-semibold">{row.count}</span>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-xs text-muted-foreground">Brak danych</p>}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="mt-3 rounded-lg border border-border p-3">
          <div className="flex items-center gap-2 font-semibold"><Trophy className="size-4 text-primary" /> JACKPOT · numeracja stała</div>
          {jackpot.error ? (
            <p className="mt-2 text-sm text-destructive">{jackpot.error.message}</p>
          ) : jackpotRows.length ? (
            <div className="mt-3 space-y-2">
              {jackpotRows.map((entry) => {
                const coupon = couponById.get(entry.coupon_id);
                return (
                  <div key={entry.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-background/40 p-3">
                    <div className="min-w-0">
                      <p className="font-semibold">{formatJackpotSequence(entry.sequence_no)} · {entry.title}</p>
                      <p className="text-xs text-muted-foreground">{coupon?.name ?? "Kupon"}{coupon ? ` · ${coupon.coupon_type} · ${coupon.status.toUpperCase()}` : ""}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{dateLabel(entry.created_at)}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Rejestr jest gotowy, ale nie ma jeszcze wpisów. Nie utworzyłem żadnych fikcyjnych kuponów.</p>
          )}
          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <select
              className="h-10 min-w-0 rounded-md border border-input bg-background px-3 text-sm"
              value={jackpotCouponId}
              onChange={(event) => {
                const id = event.target.value;
                setJackpotCouponId(id);
                const coupon = couponRows.find((row) => row.id === id);
                if (coupon && !jackpotTitle) setJackpotTitle(coupon.name);
              }}
            >
              <option value="">Wybierz istniejący kupon…</option>
              {couponRows.map((coupon) => (
                <option key={coupon.id} value={coupon.id} disabled={jackpotRows.some((entry) => entry.coupon_id === coupon.id)}>
                  {coupon.name} · {coupon.coupon_type} · {coupon.status}
                </option>
              ))}
            </select>
            <Input value={jackpotTitle} onChange={(event) => setJackpotTitle(event.target.value)} placeholder="Nazwa wpisu Jackpot" maxLength={120} />
            <Button
              variant="outline"
              disabled={!jackpotCouponId || !jackpotTitle.trim() || addJackpot.isPending}
              onClick={() => addJackpot.mutate({ couponId: jackpotCouponId, title: jackpotTitle.trim() })}
            >
              {addJackpot.isPending ? "Zapisywanie…" : "Dodaj do Jackpot"}
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Numer #001, #002… nadaje baza. Numeru, właściciela ani powiązanego kuponu nie można zmienić; wpisów nie można usuwać przez aplikację.</p>
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
