import { createFileRoute } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";
import { useMemo } from "react";
import { DataError, EmptyState, NoGuarantee, PageHeader, PageLoader, StatCard } from "@/components/app/ui-bits";
import { couponPayout, groupHitRates, hitRate, isActivePredictionVersion, type HitRate } from "@/lib/domain";
import { fmtMoney, fmtPct } from "@/lib/format";
import { ensureTables, useTable } from "@/lib/queries";
import type { Market, Prediction } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/statystyki")({
  head: () => ({
    meta: [
      { title: "Statystyki — MONEYBALL GLOBAL 2.0" },
      { name: "description", content: "Skuteczność 1X2 i Double Chance osobno, według lig, przedziałów prawdopodobieństwa i kuponów." },
      { property: "og:title", content: "Statystyki — MONEYBALL GLOBAL 2.0" },
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
  const byId = useMemo(() => new Map(matches.map((m) => [m.id, m])), [matches]);

  const settledCoupons = coupons.filter((c) => c.status && c.status !== "pending");
  const staked = settledCoupons.filter((c) => c.stake != null);
  const stakeSum = staked.reduce((s, c) => s + Number(c.stake), 0);
  const payoutSum = staked.reduce(
    (s, c) => s + (couponPayout(c.stake, legs.filter((l) => l.coupon_id === c.id)) ?? 0),
    0,
  );
  const profit = Math.round((payoutSum - stakeSum) * 100) / 100;
  const roi = stakeSum > 0 ? Math.round((profit / stakeSum) * 1000) / 10 : null;
  const chr = hitRate(coupons.map((c) => c.status));

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
        eyebrow="Aktywny model 3.8 · 1X2 i DC osobno"
        title="Statystyki"
        description="Statystyki pokazują aktywny model i wpisy ręczne; stare wersje pozostają w historii. Skuteczność = wygrane / (wygrane + przegrane)."
      />

      <div className="grid gap-6">
        {(["1X2", "DOUBLE_CHANCE"] as Market[]).map((t) => (
          <MarketBlock key={t} type={t} preds={activePreds.filter((prediction) => prediction.market === t)} leagueOf={(p) => byId.get(p.match_id)?.competition ?? "—"} />
        ))}

        <section>
          <h2 className="mb-3 text-2xl font-semibold uppercase">Kupony</h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Skuteczność kuponów" value={fmtPct(chr.rate)} hint={`${chr.won}/${chr.settled}`} tone="primary" />
            <StatCard label="Postawiono (rozliczone)" value={staked.length ? fmtMoney(stakeSum) : "brak danych"} />
            <StatCard label="Wynik" value={staked.length ? fmtMoney(profit) : "brak danych"} tone={profit < 0 ? "danger" : "default"} />
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
  const hrSel = hitRate(sel.map((prediction) => prediction.settlement_status));
  const hrRej = hitRate(rej.map((prediction) => prediction.settlement_status));
  const byBucket = groupHitRates(sel, (p) => bucketOf(p.probability), (prediction) => prediction.settlement_status).sort(
    (a, b) => BUCKETS.findIndex((x) => x.key === a.key) - BUCKETS.findIndex((x) => x.key === b.key),
  );
  const byLeague = groupHitRates(sel, leagueOf, (p) => p.result_status).slice(0, 12);
  const avgProb = (key: string) => {
    const ps = sel.filter((p) => bucketOf(p.probability) === key && (p.settlement_status === "won" || p.settlement_status === "lost"));
    return ps.length ? ps.reduce((s, p) => s + Number(p.probability), 0) / ps.length : null;
  };

  return (
    <section>
      <h2 className="mb-3 text-2xl font-semibold uppercase">{type === "DOUBLE_CHANCE" ? "Double Chance" : "1X2"}</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Skuteczność WYBRANE" value={fmtPct(hrSel.rate)} hint={`${hrSel.won}/${hrSel.settled}`} tone="primary" />
        <StatCard label="Skuteczność ODRZUCONE" value={fmtPct(hrRej.rate)} hint={`${hrRej.won}/${hrRej.settled} — kontrola filtra`} />
        <StatCard label="Prognozy" value={preds.length} hint={`${sel.length} wybranych · ${rej.length} odrzuconych`} />
        <StatCard label="Oczekujące" value={hrSel.pending + hrRej.pending} />
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
