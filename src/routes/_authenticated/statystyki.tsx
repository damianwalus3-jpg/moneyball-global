import { createFileRoute } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { DataError, EmptyState, NoGuarantee, PageHeader, PageLoader, StatCard } from "@/components/app/ui-bits";
import { ACTIVE_MODEL_VERSION, couponPayout, groupHitRates, hitRate, isActivePredictionVersion, isEuropeanTopTwoLeague, modelHitRate, probabilityQuality, type HitRate } from "@/lib/domain";
import { fmtMoney, fmtPct } from "@/lib/format";
import { ensureTables, useTable } from "@/lib/queries";
import type { Market, Prediction } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/statystyki")({
  head: () => ({
    meta: [
      { title: "Statystyki — MONEYBALL GLOBAL" },
      { name: "description", content: "Skuteczność 1X2, Double Chance i Gole / BTTS osobno, według lig, przedziałów prawdopodobieństwa i kuponów." },
      { property: "og:title", content: "Statystyki — MONEYBALL GLOBAL" },
      { property: "og:description", content: "Skuteczność prognoz i kuponów." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => ensureTables(context.queryClient, ["matches", "predictions", "coupons", "coupon_legs"]),
  pendingComponent: PageLoader,
  errorComponent: DataError,
  component: Statystyki,
});

const BUCKETS: { key: string; min: number; max: number }[] = [
  { key: "≤ 75%", min: -1, max: 75 },
  { key: "75–80%", min: 75, max: 80 },
  { key: "80–85%", min: 80, max: 85 },
  { key: "85–90%", min: 85, max: 90 },
  { key: "> 90%", min: 90, max: 101 },
];
const bucketOf = (p: number | null) => {
  if (p == null) return "brak";
  return BUCKETS.find((b) => p > b.min && p <= b.max)?.key ?? "brak";
};

function Statystyki() {
  const matches = useTable("matches");
  const preds = useTable("predictions");
  const coupons = useTable("coupons");
  const legs = useTable("coupon_legs");
  const scopedMatchIds = new Set(matches
    .filter((match) => isEuropeanTopTwoLeague(match.country, match.competition ?? match.league))
    .map((match) => match.id));
  const activePreds = preds.filter((prediction) =>
    isActivePredictionVersion(prediction.model_version) && scopedMatchIds.has(prediction.match_id),
  );
  const legsByCoupon = new Map<string, typeof legs>();
  for (const leg of legs) {
    const current = legsByCoupon.get(leg.coupon_id) ?? [];
    current.push(leg);
    legsByCoupon.set(leg.coupon_id, current);
  }
  const scopedCoupons = coupons.filter((coupon) => {
    const couponLegRows = legsByCoupon.get(coupon.id) ?? [];
    return couponLegRows.length > 0 && couponLegRows.every((leg) => !!leg.match_id && scopedMatchIds.has(leg.match_id));
  });
  const settledSinglePicks = activePreds.filter((p) => p.verdict === "WYBRANY" && p.verified && (p.settlement_status === "won" || p.settlement_status === "lost" || p.settlement_status === "void"));
  const singlePickProfitRows = settledSinglePicks.map((p) => {
    if (p.profit_loss != null && Number.isFinite(Number(p.profit_loss))) return Number(p.profit_loss);
    const stake = p.stake != null && Number.isFinite(Number(p.stake)) ? Number(p.stake) : 4;
    if (p.settlement_status === "lost") return -stake;
    if (p.settlement_status === "void") return 0;
    if (p.settlement_status === "won" && p.odds != null && Number.isFinite(Number(p.odds)) && Number(p.odds) > 1)
      return stake * (Number(p.odds) - 1);
    return null;
  });
  const knownSingleProfitRows = singlePickProfitRows.filter((value): value is number => value != null);
  const singlePickProfit = knownSingleProfitRows.reduce((sum, value) => sum + value, 0);
  const singleProfitIncomplete = knownSingleProfitRows.length !== settledSinglePicks.length;
  const singleStakeSum = settledSinglePicks.reduce((sum, p) => sum + (Number(p.stake ?? 4) || 0), 0);
  const singlePayoutSum = singleStakeSum + singlePickProfit;
  const singleRoi = singleStakeSum > 0 && !singleProfitIncomplete ? Math.round((singlePickProfit / singleStakeSum) * 1000) / 10 : null;
  const byId = useMemo(() => new Map(matches.map((m) => [m.id, m])), [matches]);

  const settledCoupons = scopedCoupons.filter((c) => c.status === "won" || c.status === "lost" || c.status === "void");
  const staked = settledCoupons.filter((c) => c.stake != null);
  const stakeSum = staked.reduce((s, c) => s + Number(c.stake), 0);
  const couponPayoutRows = staked.map((coupon) => couponPayout(coupon.stake, legsByCoupon.get(coupon.id) ?? []));
  const knownCouponPayouts = couponPayoutRows.filter((value): value is number => value != null);
  const couponPayoutIncomplete = knownCouponPayouts.length !== staked.length;
  const payoutSum = knownCouponPayouts.reduce((sum, value) => sum + value, 0);
  const profit = couponPayoutIncomplete ? null : Math.round((payoutSum - stakeSum) * 100) / 100;
  const roi = stakeSum > 0 && profit != null ? Math.round((profit / stakeSum) * 1000) / 10 : null;
  const chr = hitRate(settledCoupons.map((c) => c.status));

  if (preds.length === 0 && coupons.length === 0)
    return (
      <div>
        <PageHeader title="Statystyki" />
        <EmptyState icon={BarChart3} title="Brak danych" description="Statystyki pojawią się po zapisaniu i rozliczeniu prognoz." />
      </div>
    );

  return (
    <div>
      <PageHeader
        eyebrow="Aktywny model 3.8 · 1X2, DC i gole osobno"
        title="Statystyki"
        description="Statystyki pokazują aktywny model i wpisy ręczne; stare wersje pozostają w historii. Skuteczność = wygrane / (wygrane + przegrane). Double Chance jest obecnie wyliczane z prawdopodobieństw 1X2, a nie trenowane jako niezależny silnik."
      />

      <section className="mb-6">
        <h2 className="mb-3 text-2xl font-semibold uppercase">Pojedyncze typy · stawka analityczna 4 € każdy</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <StatCard label="Rozliczone typy" value={settledSinglePicks.length} />
          <StatCard label="Postawiono" value={settledSinglePicks.length ? fmtMoney(singleStakeSum) : "brak danych"} />
          <StatCard label="Zwroty brutto" value={knownSingleProfitRows.length ? fmtMoney(singlePayoutSum) : "brak danych"} />
          <StatCard label="Zysk / strata netto" value={knownSingleProfitRows.length ? fmtMoney(singlePickProfit) : "brak danych"} tone={singlePickProfit < 0 ? "danger" : "primary"} hint={singleProfitIncomplete ? `wyliczono ${knownSingleProfitRows.length}/${settledSinglePicks.length}; brak kursu lub rozliczenia finansowego` : "po odjęciu wszystkich stawek"} />
          <StatCard label="ROI" value={fmtPct(singleRoi)} hint="zysk netto / stawki" />
        </div>
      </section>
      <div className="grid gap-6">
        {(["1X2", "DOUBLE_CHANCE", "GOALS"] as Market[]).map((t) => (
          <MarketBlock key={t} type={t} preds={activePreds.filter((prediction) => prediction.market === t)} leagueOf={(p) => byId.get(p.match_id)?.competition ?? "—"} matchOf={(id) => byId.get(id)} />
        ))}

        <section>
          <h2 className="mb-3 text-2xl font-semibold uppercase">Kupony</h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <StatCard label="Skuteczność kuponów" value={fmtPct(chr.rate)} hint={`${chr.won}/${chr.settled}`} tone="primary" />
            <StatCard label="Postawiono (rozliczone)" value={staked.length ? fmtMoney(stakeSum) : "brak danych"} />
            <StatCard label="Zwrot brutto" value={staked.length && !couponPayoutIncomplete ? fmtMoney(payoutSum) : "brak danych"} />
            <StatCard label="Zysk / strata netto" value={profit != null ? fmtMoney(profit) : "brak danych"} hint={couponPayoutIncomplete ? "Brak kursu w części kuponów — wynik nie jest zgadywany" : "po odjęciu stawek"} tone={profit != null && profit < 0 ? "danger" : "default"} />
            <StatCard label="ROI" value={fmtPct(roi)} hint="tylko kupony ze stawką" />
          </div>
        </section>
      </div>
      <NoGuarantee className="mt-6" />
    </div>
  );
}

function MarketBlock({ type, preds, leagueOf, matchOf }: { type: Market; preds: Prediction[]; leagueOf: (p: Prediction) => string; matchOf: (id: string) => any }) {
  const [detailFilter, setDetailFilter] = useState<"model" | "selected" | "rejected" | "settled" | "pending" | null>(null);
  const sel = preds.filter((prediction) => prediction.verdict === "WYBRANY");
  const rej = preds.filter((prediction) => prediction.verdict === "ODRZUCONY");
  const verifiedSettled = sel.filter((prediction) => prediction.verified && (prediction.settlement_status === "won" || prediction.settlement_status === "lost"));
  const hrSel = hitRate(verifiedSettled.map((prediction) => prediction.settlement_status));
  const hrModel = type === "GOALS" ? null : modelHitRate(preds, type);
  const quality = probabilityQuality(preds.filter((prediction) => prediction.model_version === ACTIVE_MODEL_VERSION));
  const byBucket = groupHitRates(verifiedSettled, (p) => bucketOf(p.probability), (prediction) => prediction.settlement_status).sort(
    (a, b) => BUCKETS.findIndex((x) => x.key === a.key) - BUCKETS.findIndex((x) => x.key === b.key),
  );
  const byLeague = groupHitRates(verifiedSettled, leagueOf, (prediction) => prediction.settlement_status).slice(0, 12);
  const avgProb = (key: string) => {
    const ps = verifiedSettled.filter((p) => bucketOf(p.probability) === key);
    return ps.length ? ps.reduce((s, p) => s + Number(p.probability), 0) / ps.length : null;
  };

  return (
    <section>
      <h2 className="mb-3 text-2xl font-semibold uppercase">{type === "DOUBLE_CHANCE" ? "Double Chance" : type === "GOALS" ? "Gole / BTTS" : "1X2"}</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {hrModel && <button type="button" aria-pressed={detailFilter === "model"} onClick={() => setDetailFilter(detailFilter === "model" ? null : "model")} className="min-w-0 rounded-xl text-left outline-none transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-primary"><StatCard label="Skuteczność modelu" value={fmtPct(hrModel.rate)} hint={`${hrModel.won}/${hrModel.settled} · model ogółem · szczegóły ↗`} tone="primary" className={detailFilter === "model" ? "ring-2 ring-primary" : ""} /></button>}
        <button type="button" aria-pressed={detailFilter === "selected"} onClick={() => setDetailFilter(detailFilter === "selected" ? null : "selected")} className="min-w-0 rounded-xl text-left outline-none transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-primary"><StatCard label="Skuteczność WYBRANE" value={fmtPct(hrSel.rate)} hint={`${hrSel.won}/${hrSel.settled} · szczegóły ↗`} tone="primary" className={detailFilter === "selected" ? "ring-2 ring-primary" : ""} /></button>
        <button type="button" aria-pressed={detailFilter === "rejected"} onClick={() => setDetailFilter(detailFilter === "rejected" ? null : "rejected")} className="min-w-0 rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-primary"><StatCard label="Prognozy" value={preds.length} hint={`${sel.length} wybranych · ${rej.length} odrzuconych · szczegóły ↗`} className={detailFilter === "rejected" ? "ring-2 ring-primary" : ""} /></button>
        <button type="button" aria-pressed={detailFilter === "settled"} onClick={() => setDetailFilter(detailFilter === "settled" ? null : "settled")} className="min-w-0 rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-primary"><StatCard label="Zweryfikowane rozliczenia" value={hrSel.settled} hint="lista rozliczonych ↗" className={detailFilter === "settled" ? "ring-2 ring-primary" : ""} /></button>
        <button type="button" aria-pressed={detailFilter === "pending"} onClick={() => setDetailFilter(detailFilter === "pending" ? null : "pending")} className="min-w-0 rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-primary"><StatCard label="Oczekujące" value={sel.filter((prediction) => prediction.settlement_status === "pending").length} hint="lista oczekujących ↗" className={detailFilter === "pending" ? "ring-2 ring-primary" : ""} /></button>
      </div>
      {detailFilter && (() => {
        const rows = detailFilter === "model" ? preds
          : detailFilter === "selected" ? sel
          : detailFilter === "rejected" ? rej
          : detailFilter === "settled" ? verifiedSettled
          : sel.filter((prediction) => prediction.settlement_status === "pending");
        const title = detailFilter === "model" ? "Wszystkie prognozy modelu"
          : detailFilter === "selected" ? "Wybrane typy"
          : detailFilter === "rejected" ? "Odrzucone prognozy"
          : detailFilter === "settled" ? "Zweryfikowane rozliczenia"
          : "Oczekujące typy";
        return <section className="mt-3 rounded-xl border border-primary/30 bg-card p-3 sm:p-4" aria-live="polite">
          <div className="mb-3 flex items-center justify-between gap-2"><div><h3 className="font-display text-lg font-bold uppercase">{title}</h3><p className="text-xs text-muted-foreground">{rows.length} rekordów · kliknij kafelek ponownie, aby zamknąć</p></div><Button size="sm" variant="outline" onClick={() => setDetailFilter(null)}>Zamknij</Button></div>
          {rows.length ? <div className="grid gap-2">{rows.map((p) => {
            const match = matchOf(p.match_id);
            const status = p.settlement_status === "won" ? "WYGRANY" : p.settlement_status === "lost" ? "PRZEGRANY" : p.settlement_status === "void" ? "ZWROT" : "OCZEKUJE";
            return <article key={p.id} className="rounded-lg border border-border bg-secondary/15 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><h4 className="break-words font-semibold">{match ? `${match.home_team} – ${match.away_team}` : `Mecz ${p.match_id}`}</h4><p className="text-xs text-muted-foreground">{match?.competition ?? "Liga nieznana"}{match?.kickoff_at ? ` · ${new Date(match.kickoff_at).toLocaleString("pl-BE", {day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}` : ""}</p></div><div className="flex flex-wrap gap-1"><span className={p.verdict === "WYBRANY" ? "rounded-full bg-primary/15 px-2 py-1 text-xs font-semibold text-primary" : "rounded-full bg-muted px-2 py-1 text-xs"}>{p.verdict ?? "BEZ DECYZJI"}</span><span className="rounded-full bg-secondary px-2 py-1 text-xs">{status}</span></div></div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4"><div><span className="block text-xs text-muted-foreground">Typ</span><strong>{p.selection ?? "—"}</strong></div><div><span className="block text-xs text-muted-foreground">Prawdopodobieństwo</span><strong>{p.probability == null ? "—" : fmtPct(Number(p.probability))}</strong></div><div><span className="block text-xs text-muted-foreground">Kurs</span><strong>{p.odds == null ? "—" : Number(p.odds).toFixed(2)}</strong></div><div><span className="block text-xs text-muted-foreground">Wynik</span><strong>{match?.home_score != null && match?.away_score != null ? `${match.home_score} : ${match.away_score}` : "—"}</strong></div></div>
              {p.rationale && <p className="mt-2 whitespace-pre-wrap break-words border-t border-border pt-2 text-sm text-muted-foreground">{p.rationale}</p>}
            </article>;
          })}</div> : <p className="rounded-lg bg-secondary/30 p-3 text-sm text-muted-foreground">Brak rekordów w tej kategorii.</p>}
        </section>;
      })()}
      <div className="mt-3 rounded-xl border border-border bg-card p-3 sm:p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="font-display font-bold uppercase">Jakość prawdopodobieństw · model {ACTIVE_MODEL_VERSION}</h3>
          <span className="text-xs text-muted-foreground">próba: {quality.sample}</span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatCard label="Brier Score ↓" value={quality.brier == null ? "—" : quality.brier.toFixed(3)} hint="0 = idealnie" />
          <StatCard label="Log Loss ↓" value={quality.logLoss == null ? "—" : quality.logLoss.toFixed(3)} hint="niżej = lepiej" />
          <StatCard label="Śr. prognoza" value={fmtPct(quality.averageProbability == null ? null : quality.averageProbability * 100)} />
          <StatCard label="Rzeczywista skuteczność" value={fmtPct(quality.observedRate == null ? null : quality.observedRate * 100)} hint={quality.calibrationGap == null ? "brak próby" : `różnica ${fmtPct(quality.calibrationGap * 100)}`} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Wynik liczony dla zweryfikowanych, rozliczonych zdarzeń binarnych (wygrana/przegrana), również odrzuconych przez filtr kuponu.
          To nie jest pełny wieloklasowy Brier dla wektora 1X2. Double Chance jest pochodną 1X2, więc nie stanowi niezależnego modelu.
        </p>
      </div>
      {hrSel.settled > 0 && (
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <Table
            title="Przedziały prawdopodobieństwa (WYBRANE)"
            rows={byBucket}
            extra={(r) => `model śr. ${fmtPct(avgProb(r.key))}`}
          />
          <Table title="Ligi (WYBRANE)" rows={byLeague} />
        </div>
      )}
    </section>
  );
}

function Table({ title, rows, extra }: { title: string; rows: (HitRate & { key: string })[]; extra?: (r: HitRate & { key: string }) => string }) {
  return (
    <div className="surface-card p-3">
      <div className="eyebrow mb-2">{title}</div>
      <div className="grid gap-1.5">
        {rows.map((r) => (
          <div key={r.key} className="grid grid-cols-[1fr_auto] items-center gap-2 text-sm">
            <div className="min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate">{r.key}</span>
                <span className="num text-xs text-muted-foreground">
                  {r.won}/{r.settled}
                  {extra ? ` · ${extra(r)}` : ""}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-primary" style={{ width: `${r.rate ?? 0}%` }} />
              </div>
            </div>
            <span className="num w-14 text-right font-semibold">{fmtPct(r.rate)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
