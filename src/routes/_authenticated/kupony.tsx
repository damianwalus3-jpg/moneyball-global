import { createFileRoute } from "@tanstack/react-router";
import { Banknote, Sparkles, Ticket } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, Field, NoGuarantee, PageHeader, PageLoader, SettlementBadge, StatCard } from "@/components/app/ui-bits";
import { saveCouponBatch } from "@/lib/coupons";
import { deleteRow, fetchAll, insertRow, updateRow } from "@/lib/db";
import { ACTIVE_MODEL_VERSION, buildCouponBatch, couponPayout, effectiveOdds, isCouponCandidate, MARKET_LABELS, signedAmount } from "@/lib/domain";
import { fmtMoney, fmtOdds, fmtPct, matchLabel, parseDecimal } from "@/lib/format";
import { ensureTables, useAction, useTable } from "@/lib/queries";
import { fmtDateTime } from "@/lib/time";
import type { Coupon, CouponStatus, CouponType, Prediction } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/kupony")({
  head: () => ({ meta: [{ title: "Kupony — MONEYBALL GLOBAL 2.0" }] }),
  loader: ({ context }) =>
    ensureTables(context.queryClient, ["matches", "predictions", "coupons", "coupon_legs", "bankroll_transactions"]),
  pendingComponent: PageLoader,
  component: Kupony,
});

const COUPON_TYPES: CouponType[] = ["TEST", "MAIN", "MEGA", "EXTRA"];
const STATUS_FILTERS: ("all" | CouponStatus)[] = ["all", "pending", "won", "lost", "void", "cancelled"];

function statusLabel(status: CouponStatus) {
  return ({ pending: "W grze", won: "Wygrany", lost: "Przegrany", void: "Zwrot", cancelled: "Anulowany" })[status];
}

function CouponStatusBadge({ status }: { status: CouponStatus }) {
  const variant = status === "won" ? "success" : status === "lost" ? "danger" : status === "pending" ? "warning" : "muted";
  return <Badge variant={variant}>{statusLabel(status)}</Badge>;
}

function Kupony() {
  const matches = useTable("matches");
  const predictions = useTable("predictions");
  const coupons = useTable("coupons");
  const legs = useTable("coupon_legs");
  const transactions = useTable("bankroll_transactions");
  const matchById = useMemo(() => new Map(matches.map((match) => [match.id, match])), [matches]);
  const predictionById = useMemo(() => new Map(predictions.map((prediction) => [prediction.id, prediction])), [predictions]);

  const [couponCount, setCouponCount] = useState("2");
  const [stake, setStake] = useState("");
  const [recordStake, setRecordStake] = useState(true);
  const [couponType, setCouponType] = useState<CouponType>("TEST");
  const [namePrefix, setNamePrefix] = useState("MONEYBALL");
  const [excludeActive, setExcludeActive] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"all" | CouponStatus>("all");
  const [generated, setGenerated] = useState<Prediction[][]>([]);

  const activeCouponIds = useMemo(
    () => new Set(coupons.filter((coupon) => coupon.status === "pending").map((coupon) => coupon.id)),
    [coupons],
  );
  const activeMatchIds = useMemo(() => {
    const used = new Set<string>();
    for (const leg of legs) {
      if (!activeCouponIds.has(leg.coupon_id)) continue;
      const prediction = predictionById.get(leg.prediction_id);
      if (prediction) used.add(prediction.match_id);
    }
    return used;
  }, [legs, activeCouponIds, predictionById]);

  const candidates = predictions
    .filter((prediction) => prediction.model_version === ACTIVE_MODEL_VERSION || prediction.model_version === "MANUAL")
    .filter((prediction) => isCouponCandidate(prediction, matchById.get(prediction.match_id), Date.now()))
    .filter((prediction) => !excludeActive || !activeMatchIds.has(prediction.match_id))
    .sort((a, b) => Number(b.probability) - Number(a.probability));

  const requestedCount = Math.max(1, Math.min(20, Math.floor(Number(couponCount) || 1)));
  const stakeValue = parseDecimal(stake);
  const stakeError = recordStake && stake.trim() && (stakeValue == null || stakeValue <= 0)
    ? "Stawka musi być większa od zera."
    : recordStake && !stake.trim()
      ? "Podaj stawkę albo wyłącz zapis w bankrollu."
      : "";
  const preview = generated.length ? generated : buildCouponBatch(candidates, requestedCount);
  const uniqueCandidateMatches = new Set(candidates.map((prediction) => prediction.match_id)).size;

  const saveBatch = useAction(
    (batch: Prediction[][]) => saveCouponBatch(batch, {
      namePrefix: namePrefix.trim() || "MONEYBALL",
      couponType,
      stake: stakeValue,
      recordStake,
    }),
    { success: (count) => `Zapisano ${count} kuponów po 3 zdarzenia`, onDone: () => setGenerated([]) },
  );

  const removeCoupon = useAction(async (coupon: Coupon) => {
    const relatedTransactions = transactions.filter((transaction) => transaction.coupon_id === coupon.id);
    if (relatedTransactions.length) {
      await updateRow("coupons", coupon.id, {
        status: "cancelled",
        notes: [coupon.notes, "Anulowano w aplikacji; transakcje bankrolla zachowano."].filter(Boolean).join(" "),
      });
      return;
    }
    for (const leg of legs.filter((item) => item.coupon_id === coupon.id)) await deleteRow("coupon_legs", leg.id);
    await deleteRow("coupons", coupon.id);
  }, { success: "Kupon usunięty lub bezpiecznie anulowany" });

  const bookPayout = useAction(async ({ coupon, amount }: { coupon: Coupon; amount: number }) => {
    if (transactions.some((transaction) => transaction.coupon_id === coupon.id && transaction.transaction_type === "return"))
      throw new Error("Zwrot lub wygrana dla tego kuponu jest już zaksięgowana.");
    const currentBalance = (await fetchAll("bankroll_transactions")).reduce((latest, transaction) => {
      if (transaction.balance_after != null) return Math.max(latest, transaction.balance_after);
      return latest;
    }, Number.NEGATIVE_INFINITY);
    const knownBalance = Number.isFinite(currentBalance) ? currentBalance : null;
    await insertRow("bankroll_transactions", {
      transaction_type: "return",
      amount,
      balance_after: knownBalance == null ? null : Math.round((knownBalance + signedAmount({ transaction_type: "return", amount })) * 100) / 100,
      coupon_id: coupon.id,
      occurred_at: new Date().toISOString(),
      note: `Rozliczenie kuponu: ${coupon.name}`,
    });
  }, { success: "Zaksięgowano zwrot / wygraną" });

  const list = coupons
    .filter((coupon) => statusFilter === "all" || coupon.status === statusFilter)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const counts = {
    pending: coupons.filter((coupon) => coupon.status === "pending").length,
    won: coupons.filter((coupon) => coupon.status === "won").length,
    lost: coupons.filter((coupon) => coupon.status === "lost").length,
    void: coupons.filter((coupon) => coupon.status === "void").length,
  };

  function generate() {
    setGenerated(buildCouponBatch(candidates, requestedCount));
  }

  return (
    <div>
      <PageHeader
        eyebrow="Dokładnie 3 mecze · prawdopodobieństwo >75%"
        title="Kupony"
        description="Każdy kupon zawiera trzy różne mecze. W jednej wygenerowanej partii żaden mecz nie powtarza się w kolejnym kuponie."
      />
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="W grze" value={counts.pending} />
        <StatCard label="Wygrane" value={counts.won} />
        <StatCard label="Przegrane" value={counts.lost} />
        <StatCard label="Dostępne mecze" value={uniqueCandidateMatches} hint="WYBRANY · >75% · przed startem" tone="primary" />
      </div>

      <section className="surface-card mb-6 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="size-5 text-primary" />
          <h2 className="text-xl font-semibold uppercase">Generator kuponów</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Liczba kuponów">
            <Input inputMode="numeric" className="num" value={couponCount} onChange={(event) => { setCouponCount(event.target.value); setGenerated([]); }} />
          </Field>
          <Field label="Typ kuponu">
            <Select value={couponType} onValueChange={(value) => { setCouponType(value as CouponType); setGenerated([]); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{COUPON_TYPES.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Nazwa partii">
            <Input value={namePrefix} onChange={(event) => setNamePrefix(event.target.value)} />
          </Field>
          <Field label="Stawka na kupon" error={stakeError} hint="Opcjonalna; bez stawki nie zapisuje transakcji bankrolla">
            <Input inputMode="decimal" className="num" value={stake} onChange={(event) => setStake(event.target.value)} placeholder="np. 2,00" />
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <Checkbox checked={excludeActive} onCheckedChange={(value) => { setExcludeActive(value === true); setGenerated([]); }} />
            Pomiń mecze z aktywnych kuponów
          </label>
          <label className="flex items-center gap-2">
            <Checkbox checked={recordStake} onCheckedChange={(value) => setRecordStake(value === true)} />
            Zapisz stawkę w bankrollu
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={generate} disabled={candidates.length < 3}>
            <Sparkles /> Generuj kupony
          </Button>
          <Button variant="outline" onClick={() => setGenerated([])}>Wyczyść podgląd</Button>
        </div>
        {preview.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Brak wystarczającej liczby kandydatów. Potrzeba minimum 3 różnych meczów z WYBRANY i prawdopodobieństwem ściśle powyżej 75%.
          </p>
        ) : (
          <>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {preview.map((couponPredictions, index) => {
                const odds = couponPredictions.map((prediction) => prediction.odds);
                const combined = effectiveOdds(couponPredictions.map((prediction) => ({ odds: prediction.odds, status: "pending" as const })));
                return (
                  <div key={index} className="rounded-lg border border-border p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="font-semibold">{namePrefix || "MONEYBALL"} #{index + 1}</span>
                      <span className="num text-xs text-muted-foreground">Kurs {fmtOdds(combined)}</span>
                    </div>
                    {couponPredictions.map((prediction) => {
                      const match = matchById.get(prediction.match_id);
                      return (
                        <div key={prediction.id} className="flex items-center gap-2 border-t border-border py-2 text-sm">
                          <span className="num w-8 font-semibold text-primary">{prediction.selection}</span>
                          <div className="min-w-0 flex-1">
                            <div className="truncate">{matchLabel(match)}</div>
                            <div className="text-xs text-muted-foreground">{match?.competition ?? "—"} · {MARKET_LABELS[prediction.market]}</div>
                          </div>
                          <div className="num text-right text-xs">
                            <div>{fmtPct(prediction.probability)}</div>
                            <div className="text-muted-foreground">{fmtOdds(prediction.odds)}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
            <Button className="mt-4" disabled={!!stakeError || saveBatch.isPending || preview.some((coupon) => coupon.length !== 3)} onClick={() => saveBatch.mutate(preview)}>
              <Ticket /> {saveBatch.isPending ? "Zapisywanie…" : `Zapisz ${preview.length} kuponów`}
            </Button>
          </>
        )}
      </section>

      <div className="mb-3 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((status) => (
          <Button key={status} size="sm" variant={statusFilter === status ? "default" : "outline"} onClick={() => setStatusFilter(status)}>
            {status === "all" ? "Wszystkie" : statusLabel(status)}
          </Button>
        ))}
      </div>
      {list.length === 0 ? (
        <EmptyState icon={Ticket} title="Brak kuponów" description="Wygeneruj kupon z kandydatów powyżej 75%." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((coupon) => {
            const couponLegs = legs.filter((leg) => leg.coupon_id === coupon.id);
            const legPredictions = couponLegs.map((leg) => predictionById.get(leg.prediction_id)).filter((prediction): prediction is Prediction => !!prediction);
            const payout = couponPayout(coupon.stake, couponLegs);
            const hasReturn = transactions.some((transaction) => transaction.coupon_id === coupon.id && transaction.transaction_type === "return");
            return (
              <div key={coupon.id} className="surface-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{coupon.name}</div>
                    <div className="text-xs text-muted-foreground">{coupon.coupon_type} · {fmtDateTime(coupon.created_at)}</div>
                  </div>
                  <CouponStatusBadge status={coupon.status} />
                </div>
                <div className="mt-3 grid gap-2">
                  {couponLegs.map((leg) => {
                    const prediction = predictionById.get(leg.prediction_id);
                    const match = prediction ? matchById.get(prediction.match_id) : undefined;
                    return (
                      <div key={leg.id} className="flex items-center gap-2 border-t border-border pt-2">
                        <div className="num w-8 text-sm font-semibold text-primary">{prediction?.selection ?? "—"}</div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm">{matchLabel(match)}</div>
                          <div className="text-xs text-muted-foreground">{prediction ? MARKET_LABELS[prediction.market] : "Brak powiązanej prognozy"}</div>
                        </div>
                        <span className="num text-xs">{fmtOdds(leg.odds)}</span>
                        <SettlementBadge status={leg.status} />
                      </div>
                    );
                  })}
                  {couponLegs.length !== 3 && <p className="text-xs text-destructive">Kupon ma {couponLegs.length} nóg zamiast 3.</p>}
                </div>
                <div className="num mt-3 grid grid-cols-3 gap-2 border-t border-border pt-3 text-sm">
                  <div><div className="eyebrow">Stawka</div>{fmtMoney(coupon.stake)}</div>
                  <div><div className="eyebrow">Kurs</div>{fmtOdds(coupon.combined_odds)}</div>
                  <div><div className="eyebrow">Zwrot</div>{fmtMoney(payout)}</div>
                </div>
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  {(coupon.status === "won" || coupon.status === "void") && payout != null && payout > 0 && !hasReturn && (
                    <Button size="sm" variant="outline" disabled={bookPayout.isPending} onClick={() => bookPayout.mutate({ coupon, amount: payout })}>
                      <Banknote /> Zaksięguj {fmtMoney(payout)}
                    </Button>
                  )}
                  {hasReturn && <span className="self-center text-xs text-muted-foreground">Zwrot zaksięgowany</span>}
                  {coupon.status === "pending" && (
                    <Button size="sm" variant="ghost" onClick={() => removeCoupon.mutate(coupon)} disabled={removeCoupon.isPending}>Anuluj / usuń</Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <NoGuarantee className="mt-6" />
    </div>
  );
}
