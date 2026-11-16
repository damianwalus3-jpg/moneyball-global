import { createFileRoute } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";
import { useMemo } from "react";
import { DataError, EmptyState, NoGuarantee, PageHeader, PageLoader, StatCard } from "@/components/app/ui-bits";
import { couponPayout, groupHitRates, hitRate, isActivePredictionVersion, modelHitRate, type HitRate } from "@/lib/domain";
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
  const activePreds = preds.filter((prediction) => isActivePredictionVersion(prediction.model_version));
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

  const settledCoupons = coupons.filter((c) => c.status === "won" || c.status === "lost" || c.status === "void");
  const staked = settledCoupons.filter((c) => c.stake != null);
  const stakeSum = staked.reduce((s, c) => s + Number(c.stake), 0);
  const couponPayoutRows = staked.map((coupon) => couponPayout(coupon.stake, legs.filter((leg) => leg.coupon_id === coupon.id)));
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
        description="Statystyki pokazują aktywny model i wpisy ręczne; stare wersje pozostają w historii. Skuteczność = wygrane / (wygrane + przegrane)."
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
          <MarketBlock key={t} type={t} preds={activePreds.filter((prediction) => prediction.market === t)} leagueOf={(p) => byId.get(p.match_id)?.competition ?? "—"} />
        ))}

        <section>
          <h2 className="mb-3 text-2xl font-semibold uppercase">Kupony</h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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

function MarketBlock({ type, preds, leagueOf }: { type: Market; preds: Prediction[]; leagueOf: (p: Prediction) => string }) {
  const sel = preds.filter((prediction) => prediction.verdict === "WYBRANY");
  const rej = preds.filter((prediction) => prediction.verdict === "ODRZUCONY");
  const verifiedSettled = sel.filter((prediction) => prediction.verified && (prediction.settlement_status === "won" || prediction.settlement_status === "lost"));
  const hrSel = hitRate(verifiedSettled.map((prediction) => prediction.settlement_status));
  const hrModel = type === "GOALS" ? null : modelHitRate(preds, type);
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
        {hrModel && <StatCard label="Skuteczność modelu" value={fmtPct(hrModel.rate)} hint={`${hrModel.won}/${hrModel.settled} · model ogółem`} tone="primary" />}
        <StatCard label="Skuteczność WYBRANE" value={fmtPct(hrSel.rate)} hint={`${hrSel.won}/${hrSel.settled}`} tone="primary" />
        <StatCard label="Prognozy" value={preds.length} hint={`${sel.length} wybranych · ${rej.length} odrzuconych`} />
        <StatCard label="Zweryfikowane rozliczenia" value={hrSel.settled} />
        <StatCard label="Oczekujące" value={sel.filter((prediction) => prediction.settlement_status === "pending").length} />
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
