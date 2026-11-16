import { createFileRoute } from "@tanstack/react-router";
import { Sparkles, Ticket } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, Field, NoGuarantee, PageHeader, PageLoader, SettlementBadge, StatCard } from "@/components/app/ui-bits";
import { cancelCoupon, saveCouponBatch } from "@/lib/coupons";
import { buildCouponBatch, buildSingleCouponBatch, couponPayout, effectiveOdds, isActivePredictionVersion, isCouponCandidate, isKickoffToday, MARKET_LABELS } from "@/lib/domain";
import { fmtMoney, fmtOdds, fmtPct, matchLabel } from "@/lib/format";
import { ensureTables, useAction, useTable } from "@/lib/queries";
import { fmtDateTime } from "@/lib/time";
import type { Coupon, CouponStatus, CouponType, Prediction } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/kupony")({
  head: () => ({ meta: [{ title: "Kupony — MONEYBALL GLOBAL 2.0" }, { name: "description", content: "Generator kuponów z dzisiejszych meczów: 3 różne spotkania, prawdopodobieństwo powyżej 75%." }, { property: "og:title", content: "Kupony — MONEYBALL GLOBAL 2.0" }, { property: "og:description", content: "Generuj i zapisuj kupony z dzisiejszych meczów." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  loader: ({ context }) =>
    ensureTables(context.queryClient, ["matches", "predictions", "coupons", "coupon_legs", "scan_runs", "bankroll_transactions", "match_results"]),
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
  const results = useTable("match_results");
  const scans = useTable("scan_runs");
  const matchById = useMemo(() => new Map(matches.map((match) => [match.id, match])), [matches]);
  const predictionById = useMemo(() => new Map(predictions.map((prediction) => [prediction.id, prediction])), [predictions]);
  const resultByMatch = useMemo(() => new Map(results.map((result) => [result.match_id, result])), [results]);

  const [couponCount, setCouponCount] = useState("2");
  const [couponSize, setCouponSize] = useState<1 | 3>(3);
  const recordStake = true;
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
    .filter((prediction) => isActivePredictionVersion(prediction.model_version))
    .filter((prediction) => isCouponCandidate(prediction, matchById.get(prediction.match_id), Date.now()))
    .filter((prediction) => isKickoffToday(matchById.get(prediction.match_id)?.kickoff_at, Date.now()))
    .filter((prediction) => !excludeActive || !activeMatchIds.has(prediction.match_id))
    .sort((a, b) => Number(b.probability) - Number(a.probability));

  const requestedCount = Math.max(1, Math.min(20, Math.floor(Number(couponCount) || 1)));
  const stakeValue = 4;
  const preview = generated;
  const previewMissingOdds = preview.some((coupon) => coupon.some((prediction) => prediction.odds == null || Number(prediction.odds) <= 1));
  const uniqueCandidateMatches = new Set(candidates.map((prediction) => prediction.match_id)).size;

  const saveBatch = useAction(
    (batch: Prediction[][]) => saveCouponBatch(batch, {
      namePrefix: namePrefix.trim() || "MONEYBALL",
      couponType,
      scanRunId: [...scans].sort((a, b) => b.started_at.localeCompare(a.started_at))[0]?.id ?? null,
      stake: stakeValue,
      targetLegs: couponSize,
      recordStake,
    }),
    { success: (count) => `Zapisano ${count} ${couponSize === 1 ? "pojedynczych kuponów" : "kuponów po 3 zdarzenia"}`, onDone: () => setGenerated([]) },
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
  const payoutRows = settledCoupons.map((coupon) => couponPayout(coupon.stake, legs.filter((leg) => leg.coupon_id === coupon.id)));
  const knownPayouts = payoutRows.filter((value): value is number => value != null);
  const payoutIncomplete = knownPayouts.length !== settledCoupons.length;
  const settledReturn = knownPayouts.reduce((sum, value) => sum + value, 0);
  const settledNet = payoutIncomplete ? null : Math.round((settledReturn - settledStake) * 100) / 100;
  const pendingStake = coupons.filter((coupon) => coupon.status === "pending").reduce((sum, coupon) => sum + Number(coupon.stake ?? 0), 0);
  const settledRoi = settledStake > 0 && settledNet != null ? Math.round((settledNet / settledStake) * 1000) / 10 : null;

  function buildBatch() {
    return couponSize === 1
      ? buildSingleCouponBatch(candidates, requestedCount)
      : buildCouponBatch(candidates, requestedCount);
  }
  function generate() {
    setGenerated(buildBatch());
  }
  function generateAndSave() {
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
    preview.some((coupon) => coupon.length !== couponSize) ||
    (couponType !== "TEST" && previewMissingOdds);

  return (
    <div>
      <PageHeader
        eyebrow={couponSize === 1 ? "Dzisiejsze mecze · pojedyncze typy · prawdopodobieństwo >75%" : "Dzisiejsze mecze · dokładnie 3 różne spotkania · prawdopodobieństwo >75%"}
        title="Kupony"
        description={couponSize === 1
          ? "Każdy kupon zawiera jeden typ. W partii nie powtarzamy tego samego meczu."
          : "Każdy kupon zawiera trzy różne mecze. W jednej wygenerowanej partii żaden mecz nie powtarza się w kolejnym kuponie."}
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
          <Field label="Rodzaj kuponu">
            <Select value={String(couponSize)} onValueChange={(value) => { setCouponSize(value === "1" ? 1 : 3); setGenerated([]); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Pojedynczy · 1 mecz</SelectItem>
                <SelectItem value="3">AKO · 3 mecze</SelectItem>
              </SelectContent>
            </Select>
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
            Wybierz „Generuj kupony”, aby zobaczyć podgląd, albo od razu „GENERUJ I ZAPISZ KUPONY”. Potrzeba minimum {couponSize} różnych dzisiejszych meczów z WYBRANY i prawdopodobieństwem ściśle powyżej 75%.
          </p>
        ) : (
          <>
            {previewMissingOdds && (
              <p className="mt-4 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
                Brak potwierdzonych kursów dla części typów. Możesz zapisać taki kupon wyłącznie jako TEST do analizy skuteczności — nie jest gotowy do zagrania u bukmachera.
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
            : couponType !== "TEST" && previewMissingOdds
              ? "Brak kursów — wybierz TEST"
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
            const payout = couponPayout(coupon.stake, couponLegs);
            const net = payout == null || coupon.stake == null ? null : Math.round((payout - Number(coupon.stake)) * 100) / 100;
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
                        <span className="num text-xs">{fmtOdds(leg.odds)}</span>
                        <SettlementBadge status={leg.status} />
                      </div>
                    );
                  })}
                  {couponLegs.length !== coupon.target_legs && <p className="text-xs text-destructive">Kupon ma {couponLegs.length} zdarzeń zamiast {coupon.target_legs}.</p>}
                  {couponLegs.some((leg) => leg.odds == null || Number(leg.odds) <= 1) && (
                    <p className="text-xs text-amber-300">Brak potwierdzonych kursów — kupon służy do testowania skuteczności, nie jest potwierdzonym kuponem bukmacherskim.</p>
                  )}
                </div>
                <div className="num mt-3 grid grid-cols-4 gap-2 border-t border-border pt-3 text-sm">
                  <div><div className="eyebrow">Stawka</div>{fmtMoney(coupon.stake)}</div>
                  <div><div className="eyebrow">Kurs</div>{fmtOdds(coupon.combined_odds)}</div>
                  <div><div className="eyebrow">Zwrot brutto</div>{fmtMoney(payout)}</div>
                <div><div className="eyebrow">Zysk / strata</div><span className={net == null ? "" : net > 0 ? "text-success" : net < 0 ? "text-destructive" : ""}>{fmtMoney(net)}</span></div>
                </div>
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  {coupon.status === "pending" && (
                    <Button size="sm" variant="ghost" onClick={() => removeCoupon.mutate(coupon)} disabled={removeCoupon.isPending}>Anuluj kupon</Button>
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
