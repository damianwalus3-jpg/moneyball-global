import { createFileRoute } from "@tanstack/react-router";
import { Sparkles, Ticket } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, Field, NoGuarantee, PageHeader, PageLoader, SettlementBadge, StatCard } from "@/components/app/ui-bits";
import { cancelCoupon, saveCouponBatch } from "@/lib/coupons";
import { buildCouponBatch, couponPayout, effectiveOdds, hasFreshConfirmedOdds, isActivePredictionVersion, isCouponCandidate, isKickoffToday, MARKET_LABELS } from "@/lib/domain";
import { fmtMoney, fmtOdds, fmtPct, matchLabel } from "@/lib/format";
import { couponPageDataQuery, latestScanRunQuery, useAction } from "@/lib/queries";
import { useQuery } from "@tanstack/react-query";
import { fmtDateTime } from "@/lib/time";
import type { Coupon, CouponStatus, Prediction } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/kupony")({
  head: () => ({ meta: [{ title: "Kupony — MONEYBALL GLOBAL 2.0" }, { name: "description", content: "Generator kuponów z dzisiejszych meczów: 3 różne spotkania, prawdopodobieństwo powyżej 75%." }, { property: "og:title", content: "Kupony — MONEYBALL GLOBAL 2.0" }, { property: "og:description", content: "Generuj i zapisuj kupony z dzisiejszych meczów." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  loader: ({ context }) =>
    Promise.all([context.queryClient.ensureQueryData(couponPageDataQuery()), context.queryClient.ensureQueryData(latestScanRunQuery())]),
  pendingComponent: PageLoader,
  component: Kupony,
});

const COUPON_TYPES = ["MEGA", "EXTRA"] as const;
type CouponGeneratorType = (typeof COUPON_TYPES)[number];
const STATUS_FILTERS: ("all" | CouponStatus)[] = ["all", "pending", "won", "lost", "void", "cancelled"];

function statusLabel(status: CouponStatus) {
  return ({ pending: "W grze", won: "Wygrany", lost: "Przegrany", void: "Zwrot", cancelled: "Anulowany" })[status];
}

function CouponStatusBadge({ status }: { status: CouponStatus }) {
  const variant = status === "won" ? "success" : status === "lost" ? "danger" : status === "pending" ? "warning" : "muted";
  return <Badge variant={variant}>{statusLabel(status)}</Badge>;
}

function Kupony() {
  const pageDataQuery = useQuery(couponPageDataQuery());
  const matches = pageDataQuery.data?.matches ?? [];
  const predictions = pageDataQuery.data?.predictions ?? [];
  const coupons = pageDataQuery.data?.coupons ?? [];
  const legs = pageDataQuery.data?.legs ?? [];
  const results = pageDataQuery.data?.results ?? [];
  const latestScanQuery = useQuery(latestScanRunQuery());
  const matchById = useMemo(() => new Map(matches.map((match) => [match.id, match])), [matches]);
  const predictionById = useMemo(() => new Map(predictions.map((prediction) => [prediction.id, prediction])), [predictions]);
  const resultByMatch = useMemo(() => new Map(results.map((result) => [result.match_id, result])), [results]);

  const [couponCount, setCouponCount] = useState("2");
  const couponSize = 3 as const;
  const recordStake = true;
  const [couponType, setCouponType] = useState<CouponGeneratorType>("MEGA");
  const [namePrefix, setNamePrefix] = useState("MONEYBALL");
  const [excludeActive, setExcludeActive] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"all" | CouponStatus>("all");
  const [generated, setGenerated] = useState<Prediction[][]>([]);
  const [detailsCouponId, setDetailsCouponId] = useState<string | null>(null);

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
    .filter((prediction) => isActivePredictionVersion(prediction.model_version))
    .filter((prediction) => isCouponCandidate(prediction, matchById.get(prediction.match_id), Date.now()))
    .filter((prediction) => isKickoffToday(matchById.get(prediction.match_id)?.kickoff_at, Date.now()))
    .filter((prediction) => !excludeActive || !activeMatchIds.has(prediction.match_id))
    .sort((a, b) => Number(b.probability) - Number(a.probability));

  const detailsCoupon = coupons.find((coupon) => coupon.id === detailsCouponId) ?? null;
  const detailsLegs = detailsCoupon ? legs.filter((leg) => leg.coupon_id === detailsCoupon.id) : [];
  const displayDetail = (value: unknown) => {
    if (value == null || value === "") return "—";
    if (Array.isArray(value)) return value.map((item) => String(item)).join(", ");
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };
  const requestedCount = Math.max(1, Math.min(20, Math.floor(Number(couponCount) || 1)));
  const stakeValue = 4;
  const preview = generated;
  const previewMissingOdds = preview.some((coupon) => coupon.some((prediction) => !hasFreshConfirmedOdds(prediction, Date.now())));
  const uniqueCandidateMatches = new Set(candidates.map((prediction) => prediction.match_id)).size;

  const saveBatch = useAction(
    (batch: Prediction[][]) => saveCouponBatch(batch, {
      namePrefix: namePrefix.trim() || "MONEYBALL",
      couponType,
      scanRunId: latestScanQuery.data?.id ?? null,
      stake: stakeValue,
      targetLegs: 3,
      recordStake,
    }),
    { success: (count) => `Zapisano ${count} kuponów po 3 zdarzenia`, onDone: () => setGenerated([]) },
  );

  const removeCoupon = useAction(async (coupon: Coupon) => {
    await cancelCoupon(coupon.id);
  }, { success: "Kupon anulowany, stawka zwrócona, historia zachowana" });



  const list = coupons
    .filter((coupon) => statusFilter === "all" || coupon.status === statusFilter)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const counts = {
    pending: coupons.filter((coupon) => coupon.status === "pending").length,
    won: coupons.filter((coupon) => coupon.status === "won").length,
    lost: coupons.filter((coupon) => coupon.status === "lost").length,
    void: coupons.filter((coupon) => coupon.status === "void").length,
  };
  const settledCoupons = coupons.filter((coupon) => ["won", "lost", "void"].includes(coupon.status));
  const settledStake = settledCoupons.reduce((sum, coupon) => sum + Number(coupon.stake ?? 0), 0);
  const payoutRows = settledCoupons.map((coupon) => {
    const couponLegs = legs
      .filter((leg) => leg.coupon_id === coupon.id)
      .map((leg) => ({
        ...leg,
        // Recover the exact odds saved with the selected prediction when the
        // coupon leg's own odds column was not populated.
        odds: leg.odds ?? predictionById.get(leg.prediction_id)?.odds ?? null,
      }));
    return couponPayout(coupon.stake, couponLegs);
  });
  const knownPayouts = payoutRows.filter((value): value is number => value != null);
  const payoutIncomplete = knownPayouts.length !== settledCoupons.length;
  const settledReturn = knownPayouts.reduce((sum, value) => sum + value, 0);
  const settledNet = payoutIncomplete ? null : Math.round((settledReturn - settledStake) * 100) / 100;
  const pendingStake = coupons.filter((coupon) => coupon.status === "pending").reduce((sum, coupon) => sum + Number(coupon.stake ?? 0), 0);
  const settledRoi = settledStake > 0 && settledNet != null ? Math.round((settledNet / settledStake) * 1000) / 10 : null;

  function buildBatch() {
    return buildCouponBatch(candidates, requestedCount);
  }
  function generate() {
    setGenerated(buildBatch());
  }
  function generateAndSave() {
    if (previewMissingOdds) return;
    if (preview.length > 0) {
      saveBatch.mutate(preview);
      return;
    }
    const batch = buildBatch();
    setGenerated(batch);
    if (batch.length > 0) saveBatch.mutate(batch);
  }
  const saveDisabled =
    saveBatch.isPending ||
    candidates.length < couponSize ||
    preview.some((coupon) => coupon.length !== 3) ||
    previewMissingOdds;

  return (
    <div>
      <PageHeader
        eyebrow="Dzisiejsze mecze · dokładnie 3 różne spotkania · prawdopodobieństwo >75%"
        title="Kupony"
        description="Każdy kupon zawiera trzy różne mecze. W jednej wygenerowanej partii żaden mecz nie powtarza się w kolejnym kuponie."
      />
      <section className="mb-5">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">Wynik kuponów · rozliczone</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard label="Rozliczone" value={settledCoupons.length} hint={`${counts.won} wygrane · ${counts.lost} przegrane · ${counts.void} zwroty`} />
          <StatCard label="Postawiono" value={settledCoupons.length ? fmtMoney(settledStake) : "—"} />
          <StatCard label="Zwrot brutto" value={settledCoupons.length && !payoutIncomplete ? fmtMoney(settledReturn) : "—"} hint={payoutIncomplete ? "Brak kursu dla części rozliczonych kuponów" : undefined} />
          <StatCard label="Zysk / strata netto" value={settledNet != null ? fmtMoney(settledNet) : "—"} hint={payoutIncomplete ? "Niepełne dane kursowe — wynik nie jest zgadywany" : undefined} tone={settledNet != null && settledNet < 0 ? "danger" : "primary"} />
          <StatCard label="ROI" value={fmtPct(settledRoi)} hint="netto / postawione" />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard label="Kupony w grze" value={counts.pending} hint={`Zamrożone stawki: ${fmtMoney(pendingStake)}`} tone="warning" />
          <StatCard label="Dostępne mecze" value={uniqueCandidateMatches} hint="Dziś · WYBRANY · powyżej 75%" tone="primary" />
          <StatCard label="Anulowane" value={coupons.filter((coupon) => coupon.status === "cancelled").length} hint="Stawka zwrócona do wirtualnego salda" />
        </div>
      </section>

      <section className="surface-card mb-6 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="size-5 text-primary" />
          <h2 className="text-xl font-semibold uppercase">GENERATOR KUPONÓW</h2>
        </div>
        <p className="mb-4 rounded-md border border-primary/40 bg-primary/10 p-3 text-sm text-foreground">
          Skan aktualizuje prognozy automatycznie. Kupon zapisujesz przyciskiem poniżej. AKO zawiera dokładnie 3 różne mecze, a każdy nowy kupon ma stałą stawkę 4 €. Wynik finansowy aktualizuje się po potwierdzeniu wyników spotkań.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Liczba kuponów">
            <Input inputMode="numeric" className="num" value={couponCount} onChange={(event) => { setCouponCount(event.target.value); setGenerated([]); }} />
          </Field>
          <Field label="Typ kuponu">
            <Select value={couponType} onValueChange={(value) => { setCouponType(value as CouponGeneratorType); setGenerated([]); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{COUPON_TYPES.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Nazwa partii">
            <Input value={namePrefix} onChange={(event) => setNamePrefix(event.target.value)} />
          </Field>
          <Field label="Stała stawka na kupon">
            <div className="flex h-10 items-center rounded-md border border-border bg-secondary/40 px-3 font-semibold tabular-nums">4,00 € <span className="ml-2 text-xs font-normal text-muted-foreground">automatycznie</span></div>
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <Checkbox checked={excludeActive} onCheckedChange={(value) => { setExcludeActive(value === true); setGenerated([]); }} />
            Pomiń mecze z aktywnych kuponów
          </label>
          <label className="flex items-center gap-2">
            <Checkbox checked={recordStake} disabled />
            Zapisz stawkę każdego kuponu w bankrollu
          </label>

        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={generate} disabled={candidates.length < couponSize}>
            <Sparkles /> Generuj kupony
          </Button>
          <Button variant="outline" onClick={() => setGenerated([])}>Wyczyść podgląd</Button>
        </div>
        {preview.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Dostępne kwalifikujące się mecze: {uniqueCandidateMatches}. Do kuponu potrzeba minimum 3 różnych spotkań z WYBRANY i prawdopodobieństwem powyżej 75%. Jeśli liczba jest mniejsza, sprawdź powody odrzucenia w Terminarzu. Nie tworzymy kuponów MAIN/MEGA/EXTRA bez wystarczających danych i potwierdzonych kursów.
          </p>
        ) : (
          <>
            {previewMissingOdds && (
              <p className="mt-4 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
                Brak potwierdzonych kursów dla części typów. Kupon nie zostanie zapisany bez rzeczywistych, świeżych kursów bukmacherskich. Uzupełnij kurs w Terminarzu albo poczekaj na synchronizację.
              </p>
            )}
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {preview.map((couponPredictions, index) => {
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
          </>
        )}
        <Button
          size="lg"
          className="mt-5 h-14 w-full text-base font-extrabold uppercase tracking-wider shadow-lg sm:text-lg"
          disabled={saveDisabled}
          onClick={generateAndSave}
        >
          <Ticket className="size-5" />
          {saveBatch.isPending
            ? "Zapisywanie…"
            : previewMissingOdds
              ? "Brak kursów — nie można zapisać"
              : "GENERUJ I ZAPISZ KUPONY"}
        </Button>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          `Stała stawka 4,00 € · zapis do wirtualnego bankrolla${preview.length ? ` · ${preview.length} kuponów w podglądzie` : ""}`
        </p>
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
            const payoutLegs = couponLegs.map((leg) => ({ ...leg, odds: leg.odds ?? predictionById.get(leg.prediction_id)?.odds ?? null }));
            const payout = couponPayout(coupon.stake, payoutLegs);
            const settledNet = payout == null || coupon.stake == null ? null : Math.round((payout - Number(coupon.stake)) * 100) / 100;
            const potentialOdds = effectiveOdds(payoutLegs.map((leg) => ({ odds: leg.odds, status: "pending" as const })));
            const potentialReturn = coupon.stake != null && potentialOdds != null && payoutLegs.length === coupon.target_legs
              ? Math.round(Number(coupon.stake) * potentialOdds * 100) / 100
              : null;
            const potentialNet = potentialReturn == null || coupon.stake == null
              ? null
              : Math.round((potentialReturn - Number(coupon.stake)) * 100) / 100;
            const displayNet = coupon.status === "pending" ? potentialNet : settledNet;
            const netLabel = coupon.status === "pending" ? "Możliwy zysk" : "Zysk / strata";
            return (
              <div key={coupon.id} className="surface-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{coupon.name}</div>
                    <div className="text-xs text-muted-foreground">{coupon.coupon_type} · {coupon.target_legs === 1 ? "pojedynczy" : "AKO · 3 mecze"} · {fmtDateTime(coupon.created_at)}</div>
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
                          <div className="text-xs text-muted-foreground">
                            {prediction ? MARKET_LABELS[prediction.market] : "Brak powiązanej prognozy"}
                            {prediction?.probability != null ? ` · ${fmtPct(prediction.probability)}` : ""}
                            {match?.kickoff_at ? ` · ${fmtDateTime(match.kickoff_at)}` : ""}
                          </div>
                          {match && resultByMatch.get(match.id)?.home_score != null && resultByMatch.get(match.id)?.away_score != null && (
                            <div className="num text-xs font-semibold text-primary">Wynik: {resultByMatch.get(match.id)?.home_score} : {resultByMatch.get(match.id)?.away_score}</div>
                          )}
                        </div>
                        <span className="num text-xs">{fmtOdds(leg.odds ?? prediction?.odds ?? null)}</span>
                        <SettlementBadge status={leg.status} />
                      </div>
                    );
                  })}
                  {couponLegs.length !== coupon.target_legs && <p className="text-xs text-destructive">Kupon ma {couponLegs.length} zdarzeń zamiast {coupon.target_legs}.</p>}
                  {couponLegs.some((leg) => { const odds = leg.odds ?? predictionById.get(leg.prediction_id)?.odds; return odds == null || Number(odds) <= 1; }) && (
                    <p className="text-xs text-amber-300">Brak potwierdzonych kursów — kupon służy do testowania skuteczności, nie jest potwierdzonym kuponem bukmacherskim.</p>
                  )}
                </div>
                <div className="num mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3 text-sm sm:grid-cols-4">
                  <div><div className="eyebrow">Stawka</div>{fmtMoney(coupon.stake)}</div>
                  <div><div className="eyebrow">Kurs</div>{fmtOdds(coupon.combined_odds)}</div>
                  <div><div className="eyebrow">{coupon.status === "pending" ? "Możliwy zwrot" : "Zwrot brutto"}</div>{fmtMoney(coupon.status === "pending" ? potentialReturn : payout)}</div>
                  <div className="rounded-md border border-border bg-secondary/40 p-2">
                    <div className="eyebrow">{netLabel}</div>
                    <div className={`mt-1 inline-flex min-h-8 items-center rounded-md border px-2 font-bold ${displayNet == null ? "border-amber-500/40 bg-amber-500/10 text-amber-300" : displayNet > 0 ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400" : displayNet < 0 ? "border-red-500/40 bg-red-500/10 text-red-400" : "border-border text-muted-foreground"}`}>
                      {displayNet == null ? "Brak kursu / danych" : <>{displayNet > 0 ? "+" : ""}{fmtMoney(displayNet)}</>}
                    </div>
                    {coupon.status === "pending" && <div className="mt-1 text-[10px] text-muted-foreground">Szacunek — nie wynik rozliczony</div>}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => setDetailsCouponId(coupon.id)}>Szczegóły</Button>
                  {coupon.status === "pending" && (
                    <Button size="sm" variant="ghost" onClick={() => removeCoupon.mutate(coupon)} disabled={removeCoupon.isPending}>Anuluj kupon</Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <Dialog open={!!detailsCoupon} onOpenChange={(open) => { if (!open) setDetailsCouponId(null); }}>
        <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detailsCoupon?.name ?? "Szczegóły kuponu"}</DialogTitle>
            <DialogDescription>Pełne dane kuponu, każdego zdarzenia, uzasadnienia modelu i źródła kursu. Dane historyczne pozostają bez zmian.</DialogDescription>
          </DialogHeader>
          {detailsCoupon && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-secondary/20 p-3 sm:grid-cols-4">
                <div><div className="eyebrow">Typ / status</div><div className="font-semibold">{detailsCoupon.coupon_type} · {statusLabel(detailsCoupon.status)}</div></div>
                <div><div className="eyebrow">Zdarzenia</div><div className="font-semibold">{detailsLegs.length}/{detailsCoupon.target_legs}</div></div>
                <div><div className="eyebrow">Stawka</div><div className="num font-semibold">{fmtMoney(detailsCoupon.stake)}</div></div>
                <div><div className="eyebrow">Kurs łączny</div><div className="num font-semibold">{fmtOdds(detailsCoupon.combined_odds)}</div></div>
                <div><div className="eyebrow">Możliwy / zapisany zwrot</div><div className="num font-semibold">{fmtMoney(detailsCoupon.potential_return)}</div></div>
                <div><div className="eyebrow">Utworzono</div><div className="text-sm font-semibold">{fmtDateTime(detailsCoupon.created_at)}</div></div>
                <div><div className="eyebrow">Rozliczono</div><div className="text-sm font-semibold">{fmtDateTime(detailsCoupon.settled_at)}</div></div>
                <div><div className="eyebrow">Notatka</div><div className="break-words text-sm">{detailsCoupon.notes || "—"}</div></div>
              </div>
              {detailsLegs.map((leg, index) => {
                const prediction = predictionById.get(leg.prediction_id);
                const match = prediction ? matchById.get(prediction.match_id) : matches.find((item) => item.id === leg.match_id);
                const coverage = (prediction?.data_coverage ?? {}) as Record<string, unknown>;
                const result = match ? resultByMatch.get(match.id) : undefined;
                const sourceUrl = coverage["odds_source_url"];
                return (
                  <section key={leg.id} className="rounded-lg border border-border p-3">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-semibold">{index + 1}. {matchLabel(match)}</h3>
                      <SettlementBadge status={leg.status} />
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                      <div><div className="eyebrow">Rynek / typ</div><div className="font-semibold">{prediction ? MARKET_LABELS[prediction.market] + " · " + prediction.selection : "Brak prognozy"}</div></div>
                      <div><div className="eyebrow">Prawdopodobieństwo</div><div className="num font-semibold">{prediction?.probability == null ? "—" : fmtPct(prediction.probability)}</div></div>
                      <div><div className="eyebrow">Kurs nogi</div><div className="num font-semibold">{fmtOdds(leg.odds ?? prediction?.odds ?? null)}</div></div>
                      <div><div className="eyebrow">Wynik</div><div className="num font-semibold">{result?.home_score != null && result?.away_score != null ? result.home_score + " : " + result.away_score : "—"}</div></div>
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div className="rounded-md bg-secondary/25 p-3">
                        <div className="eyebrow">Dane modelu</div>
                        <dl className="mt-2 grid gap-2 text-sm">
                          <div><dt className="text-muted-foreground">Źródło danych</dt><dd className="break-words font-medium">{prediction?.data_source || "—"}</dd></div>
                          <div><dt className="text-muted-foreground">Typ źródła modelu / pokrycie</dt><dd className="break-words font-medium">{displayDetail(coverage["model_source_type"])} · {displayDetail(coverage["model_coverage"])}</dd></div>
                          <div><dt className="text-muted-foreground">Historia gospodarzy / gości</dt><dd className="font-medium">{displayDetail(coverage["home_history_matches"])} / {displayDetail(coverage["away_history_matches"])} meczów</dd></div>
                          <div><dt className="text-muted-foreground">xG rzeczywiście użyte</dt><dd className="font-medium">{displayDetail(coverage["historical_xg_used"] ?? coverage["xg_used"])}</dd></div>
                          <div><dt className="text-muted-foreground">Źródła / próbka xG</dt><dd className="break-words font-medium">{displayDetail(coverage["historical_xg_sources"] ?? coverage["xg_sources"])} · {displayDetail(coverage["historical_xg_home_matches"])} / {displayDetail(coverage["historical_xg_away_matches"])}</dd></div>
                          <div><dt className="text-muted-foreground">Decyzja / powód odrzucenia</dt><dd className="break-words font-medium">{displayDetail(prediction?.verdict)} · {displayDetail(prediction?.rejection_reason)}</dd></div>
                        </dl>
                      </div>
                      <div className="rounded-md bg-secondary/25 p-3">
                        <div className="eyebrow">Źródło kursu</div>
                        <dl className="mt-2 grid gap-2 text-sm">
                          <div><dt className="text-muted-foreground">Bukmacher / źródło</dt><dd className="break-words font-medium">{displayDetail(coverage["odds_bookmaker"])} · {displayDetail(coverage["odds_source"])}</dd></div>
                          <div><dt className="text-muted-foreground">Status / faza / zawieszenie</dt><dd className="break-words font-medium">{displayDetail(coverage["odds_status"])} · {displayDetail(coverage["odds_phase"])} · {displayDetail(coverage["odds_suspended"])}</dd></div>
                          <div><dt className="text-muted-foreground">Czas pobrania</dt><dd className="font-medium">{displayDetail(coverage["odds_captured_at"])}</dd></div>
                          <div><dt className="text-muted-foreground">Rynek potwierdzony</dt><dd className="font-medium">{displayDetail(coverage["market_odds"])}</dd></div>
                          <div><dt className="text-muted-foreground">URL źródła</dt><dd className="break-all font-medium">{typeof sourceUrl === "string" && /^https?:\/\//i.test(sourceUrl) ? <a className="text-primary underline" href={sourceUrl} target="_blank" rel="noreferrer">Otwórz źródło</a> : "—"}</dd></div>
                        </dl>
                      </div>
                    </div>
                    <div className="mt-3 rounded-md border border-border p-3">
                      <div className="eyebrow">Uzasadnienie prognozy</div>
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed">{prediction?.rationale || "Brak zapisanego uzasadnienia."}</p>
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
      <NoGuarantee className="mt-6" />
    </div>
  );
}
