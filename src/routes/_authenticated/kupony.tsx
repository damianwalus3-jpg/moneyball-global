import { createFileRoute } from "@tanstack/react-router";
import { Banknote, Pencil, Sparkles, Ticket } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ConfirmDelete,
  DataError,
  EmptyState,
  Field,
  NoGuarantee,
  PageHeader,
  PageLoader,
  SettlementBadge,
  StatCard,
  TypeBadge,
} from "@/components/app/ui-bits";
import { saveCouponBatch } from "@/lib/coupons";
import { deleteRow, insertRow, updateRow } from "@/lib/db";
import {
  buildCouponBatch,
  CANDIDATE_MIN_PROBABILITY,
  combinedProbability,
  couponPayout,
  isCouponCandidate,
  totalOdds,
  validateCoupon,
} from "@/lib/domain";
import { fmtMoney, fmtOdds, fmtPct, matchLabel, parseDecimal } from "@/lib/format";
import { ensureTables, useAction, useTable } from "@/lib/queries";
import { fmtDateTime } from "@/lib/time";
import type { Coupon, Prediction, Settlement } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/kupony")({
  head: () => ({
    meta: [
      { title: "Kupony — MONEYBALL GLOBAL 2.0" },
      { name: "description", content: "Kupony z dokładnie 3 różnymi meczami, tylko kandydaci powyżej 75%." },
      { property: "og:title", content: "Kupony — MONEYBALL GLOBAL 2.0" },
      { property: "og:description", content: "Kupony 3-meczowe z kandydatów powyżej 75%." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) =>
    ensureTables(context.queryClient, ["matches", "predictions", "coupons", "coupon_legs", "bankroll_transactions"]),
  pendingComponent: PageLoader,
  errorComponent: DataError,
  component: Kupony,
});

type Market = "all" | "1X2" | "DC";

function Kupony() {
  const matches = useTable("matches");
  const preds = useTable("predictions");
  const coupons = useTable("coupons");
  const legs = useTable("coupon_legs");
  const txs = useTable("bankroll_transactions");
  const byId = useMemo(() => new Map(matches.map((m) => [m.id, m])), [matches]);

  const [market, setMarket] = useState<Market>("all");
  const [count, setCount] = useState("3");
  const [stake, setStake] = useState("");
  const [recordStake, setRecordStake] = useState(true);
  const [excludeActive, setExcludeActive] = useState(true);
  const [prefix, setPrefix] = useState("Kupon");
  const [manual, setManual] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | Settlement>("all");
  const [edit, setEdit] = useState<Coupon | null>(null);

  const activeMatchIds = useMemo(() => {
    const pending = new Set(coupons.filter((c) => (c.status ?? "pending") === "pending").map((c) => c.id));
    return new Set(legs.filter((l) => pending.has(l.coupon_id)).map((l) => l.match_id));
  }, [coupons, legs]);

  const now = Date.now();
  const candidates = preds
    .filter((p) => isCouponCandidate(p, byId.get(p.match_id), now))
    .filter((p) => market === "all" || p.prediction_type === market)
    .filter((p) => !excludeActive || !activeMatchIds.has(p.match_id))
    .sort((a, b) => Number(b.probability) - Number(a.probability));

  const nCount = Math.max(1, Math.min(20, Math.floor(Number(count) || 1)));
  const preview = buildCouponBatch(candidates, nCount);
  const stakeNum = parseDecimal(stake);
  const stakeError = stake.trim() && (stakeNum == null || stakeNum <= 0) ? "Stawka musi być > 0." : "";
  const distinctMatches = new Set(candidates.map((c) => c.match_id)).size;

  const saveBatch = useAction(
    (batch: Prediction[][]) =>
      saveCouponBatch(batch, { namePrefix: prefix.trim() || "Kupon", stake: stakeNum, recordStake }),
    {
      success: (n) => `Zapisano ${n} kupon(y)`,
      onDone: () => setManual([]),
    },
  );

  const manualLegs = manual.map((id) => preds.find((p) => p.id === id)!).filter(Boolean);
  const manualErrors = manual.length ? validateCoupon(manualLegs) : [];

  function toggleManual(p: Prediction) {
    setManual((cur) => {
      if (cur.includes(p.id)) return cur.filter((x) => x !== p.id);
      const sameMatch = cur.find((id) => preds.find((x) => x.id === id)?.match_id === p.match_id);
      const next = sameMatch ? cur.filter((x) => x !== sameMatch) : cur;
      return next.length >= 3 ? next : [...next, p.id];
    });
  }

  const delCoupon = useAction(
    async (c: Coupon) => {
      for (const l of legs.filter((x) => x.coupon_id === c.id)) await deleteRow("coupon_legs", l.id);
      await deleteRow("coupons", c.id);
    },
    { success: "Usunięto kupon" },
  );

  const bookPayout = useAction(
    async ({ coupon, amount }: { coupon: Coupon; amount: number }) => {
      await insertRow("bankroll_transactions", {
        occurred_at: new Date().toISOString(),
        type: "payout",
        transaction_type: "return",
        amount,
        coupon_id: coupon.id,
        note: `Wygrana: ${coupon.name ?? "kupon"}`,
      });
    },
    { success: "Zaksięgowano wygraną w bankrollu" },
  );

  const list = [...coupons]
    .filter((c) => statusFilter === "all" || (c.status ?? "pending") === statusFilter)
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));

  const counts = { pending: 0, won: 0, lost: 0, void: 0 } as Record<Settlement, number>;
  for (const c of coupons) counts[(c.status ?? "pending") as Settlement]++;

  return (
    <div>
      <PageHeader
        eyebrow={`3 mecze · tylko > ${CANDIDATE_MIN_PROBABILITY}%`}
        title="Kupony"
        description="Każdy kupon to dokładnie 3 różne mecze. W jednej partii żaden mecz nie powtarza się między kuponami."
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="W grze" value={counts.pending} />
        <StatCard label="Wygrane" value={counts.won} />
        <StatCard label="Przegrane" value={counts.lost} />
        <StatCard label="Kandydaci (mecze)" value={distinctMatches} hint={`> ${CANDIDATE_MIN_PROBABILITY}%, nierozegrane`} tone="primary" />
      </div>

      {/* Generator */}
      <section className="surface-card mb-6 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="size-5 text-primary" />
          <h2 className="text-xl font-semibold uppercase">Generator partii</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Rynek">
            <div className="flex gap-1">
              {(["all", "1X2", "DC"] as const).map((m) => (
                <Button key={m} type="button" size="sm" variant={market === m ? "default" : "outline"} onClick={() => setMarket(m)}>
                  {m === "all" ? "Oba" : m}
                </Button>
              ))}
            </div>
          </Field>
          <Field label="Liczba kuponów" hint={`Maks. ${Math.floor(distinctMatches / 3)} z dostępnych meczów`}>
            <Input inputMode="numeric" className="num" value={count} onChange={(e) => setCount(e.target.value)} />
          </Field>
          <Field label="Stawka na kupon (opcjonalnie)" error={stakeError}>
            <Input inputMode="decimal" className="num" value={stake} onChange={(e) => setStake(e.target.value)} placeholder="np. 10" />
          </Field>
          <Field label="Nazwa">
            <Input value={prefix} onChange={(e) => setPrefix(e.target.value)} />
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <Checkbox checked={excludeActive} onCheckedChange={(v) => setExcludeActive(v === true)} />
            Pomiń mecze z kuponów w grze
          </label>
          <label className="flex items-center gap-2">
            <Checkbox checked={recordStake} onCheckedChange={(v) => setRecordStake(v === true)} />
            Zapisz stawkę w bankrollu
          </label>
        </div>

        {preview.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Za mało kandydatów: potrzeba co najmniej 3 różnych, nierozegranych meczów z prognozą WYBRANY powyżej{" "}
            {CANDIDATE_MIN_PROBABILITY}%.
          </p>
        ) : (
          <>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {preview.map((c, i) => (
                <div key={i} className="rounded-lg border border-border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-semibold">
                      {prefix || "Kupon"} #{i + 1}
                    </span>
                    <span className="num text-xs text-muted-foreground">
                      kurs {fmtOdds(totalOdds(c.map((l) => l.odds)))} · model {fmtPct(combinedProbability(c.map((l) => l.probability)))}
                    </span>
                  </div>
                  {c.map((l) => (
                    <LegRow key={l.id} label={matchLabel(byId.get(l.match_id))} type={l.prediction_type} pick={l.pick} prob={l.probability} odds={l.odds} />
                  ))}
                </div>
              ))}
            </div>
            <Button className="mt-4" disabled={!!stakeError || saveBatch.isPending} onClick={() => saveBatch.mutate(preview)}>
              {saveBatch.isPending ? "Zapisywanie…" : `Zapisz partię (${preview.length})`}
            </Button>
          </>
        )}
      </section>

      {/* Manual builder */}
      {candidates.length > 0 && (
        <section className="surface-card mb-6 p-4">
          <h2 className="mb-1 text-xl font-semibold uppercase">Kupon ręczny</h2>
          <p className="mb-3 text-xs text-muted-foreground">Zaznacz 3 kandydatów z różnych meczów ({manual.length}/3).</p>
          <div className="grid max-h-80 gap-1 overflow-y-auto">
            {candidates.map((p) => (
              <label key={p.id} className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-secondary">
                <Checkbox checked={manual.includes(p.id)} onCheckedChange={() => toggleManual(p)} />
                <div className="min-w-0 flex-1">
                  <LegRow label={matchLabel(byId.get(p.match_id))} type={p.prediction_type} pick={p.pick} prob={p.probability} odds={p.odds} sub={fmtDateTime(byId.get(p.match_id)?.kickoff_at)} />
                </div>
              </label>
            ))}
          </div>
          {manual.length === 3 && manualErrors.length > 0 && <p className="mt-2 text-xs text-destructive">{manualErrors.join(" ")}</p>}
          <Button
            className="mt-3"
            variant="outline"
            disabled={manual.length !== 3 || manualErrors.length > 0 || !!stakeError || saveBatch.isPending}
            onClick={() => saveBatch.mutate([manualLegs])}
          >
            <Ticket /> Utwórz kupon z zaznaczonych
          </Button>
        </section>
      )}

      {/* List */}
      <div className="mb-3 flex flex-wrap gap-2">
        {(["all", "pending", "won", "lost", "void"] as const).map((s) => (
          <Button key={s} size="sm" variant={statusFilter === s ? "default" : "outline"} onClick={() => setStatusFilter(s)}>
            {{ all: "Wszystkie", pending: "W grze", won: "Wygrane", lost: "Przegrane", void: "Zwrot" }[s]}
          </Button>
        ))}
      </div>
      {list.length === 0 ? (
        <EmptyState icon={Ticket} title="Brak kuponów" description="Wygeneruj partię powyżej lub utwórz kupon ręcznie." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((c) => {
            const cl = legs.filter((l) => l.coupon_id === c.id);
            const payout = couponPayout(c.stake, cl);
            const paid = txs.some((t) => t.coupon_id === c.id && t.type === "payout");
            return (
              <div key={c.id} className="surface-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{c.name ?? "Kupon"}</div>
                    <div className="text-xs text-muted-foreground">{fmtDateTime(c.created_at)}</div>
                  </div>
                  <SettlementBadge status={c.status} />
                </div>
                <div className="mt-3 grid gap-1">
                  {cl.map((l) => (
                    <div key={l.id} className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <LegRow label={matchLabel(byId.get(l.match_id))} type={l.prediction_type} pick={l.pick} prob={l.probability} odds={l.odds} />
                      </div>
                      <SettlementBadge status={l.result_status} />
                    </div>
                  ))}
                  {cl.length !== 3 && <p className="text-xs text-warning">Uwaga: kupon ma {cl.length} zdarzeń zamiast 3.</p>}
                </div>
                <div className="num mt-3 grid grid-cols-3 gap-2 border-t border-border pt-3 text-sm">
                  <div>
                    <div className="eyebrow">Stawka</div>
                    {fmtMoney(c.stake)}
                  </div>
                  <div>
                    <div className="eyebrow">Kurs</div>
                    {fmtOdds(c.total_odds)}
                  </div>
                  <div>
                    <div className="eyebrow">{c.status === "won" || c.status === "void" ? "Wypłata" : "Model"}</div>
                    {c.status === "won" || c.status === "void" ? fmtMoney(payout) : fmtPct(c.combined_probability)}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-end gap-1">
                  {(c.status === "won" || c.status === "void") && payout != null && payout > 0 && !paid && (
                    <Button size="sm" variant="outline" onClick={() => bookPayout.mutate({ coupon: c, amount: payout })}>
                      <Banknote /> Zaksięguj {fmtMoney(payout)}
                    </Button>
                  )}
                  {paid && <span className="text-xs text-muted-foreground">Wypłata zaksięgowana</span>}
                  <Button variant="ghost" size="icon" aria-label="Edytuj kupon" onClick={() => setEdit(c)}>
                    <Pencil />
                  </Button>
                  <ConfirmDelete title="Usunąć kupon?" description="Usunięte zostaną kupon i jego zdarzenia. Transakcje bankrolla pozostaną." onConfirm={() => delCoupon.mutate(c)} />
                </div>
              </div>
            );
          })}
        </div>
      )}
      <NoGuarantee className="mt-6" />
      <CouponEditDialog coupon={edit} onClose={() => setEdit(null)} />
    </div>
  );
}

function LegRow({
  label,
  type,
  pick,
  prob,
  odds,
  sub,
}: {
  label: string;
  type: string;
  pick: string;
  prob: number | null;
  odds: number | null;
  sub?: string;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <TypeBadge type={type} />
      <span className="num w-7 font-semibold text-primary">{pick}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate">{label}</div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </div>
      <span className="num text-xs text-muted-foreground">
        {fmtPct(prob)} · {fmtOdds(odds)}
      </span>
    </div>
  );
}

function CouponEditDialog({ coupon, onClose }: { coupon: Coupon | null; onClose: () => void }) {
  const [f, setF] = useState({ name: "", stake: "", notes: "" });
  const [err, setErr] = useState("");
  useEffect(() => {
    if (coupon) {
      setErr("");
      setF({ name: coupon.name ?? "", stake: coupon.stake != null ? String(coupon.stake) : "", notes: coupon.notes ?? "" });
    }
  }, [coupon]);
  const save = useAction(
    () =>
      updateRow("coupons", coupon!.id, {
        name: f.name.trim() || null,
        stake: parseDecimal(f.stake),
        notes: f.notes.trim() || null,
      }),
    { success: "Zapisano kupon", onDone: onClose },
  );
  return (
    <Dialog open={coupon != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-card">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl uppercase">Edytuj kupon</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const s = parseDecimal(f.stake);
            if (f.stake.trim() && (s == null || s <= 0)) return setErr("Stawka musi być > 0.");
            save.mutate(undefined);
          }}
        >
          <Field label="Nazwa">
            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </Field>
          <Field label="Stawka" error={err} hint="Zmiana stawki nie zmienia transakcji w bankrollu.">
            <Input inputMode="decimal" className="num" value={f.stake} onChange={(e) => setF({ ...f, stake: e.target.value })} />
          </Field>
          <div className="grid gap-1.5">
            <Label className="text-xs uppercase text-muted-foreground">Notatki</Label>
            <Textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Anuluj
            </Button>
            <Button type="submit" disabled={save.isPending}>
              Zapisz
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
