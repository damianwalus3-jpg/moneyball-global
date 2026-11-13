import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/app/ui-bits";
import { insertRow, updateRow, fetchAll } from "@/lib/db";
import { signedAmount, TX_LABELS } from "@/lib/domain";
import { matchLabel, parseDecimal } from "@/lib/format";
import { useAction } from "@/lib/queries";
import { brusselsInputToISO, isoToBrusselsInput, nowBrusselsInput } from "@/lib/time";
import type { BankrollTransaction, Coupon, Match, MatchResult, OddsSnapshot, Prediction, ScanRun, TransactionType } from "@/lib/types";

const NONE = "__none__";

function FormDialog({
  open,
  onOpenChange,
  title,
  onSubmit,
  pending,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  onSubmit: () => void;
  pending: boolean;
  children: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto bg-card">
        <DialogHeader><DialogTitle className="font-display text-2xl uppercase">{title}</DialogTitle></DialogHeader>
        <form onSubmit={(event) => { event.preventDefault(); onSubmit(); }} className="grid gap-4">
          {children}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Anuluj</Button>
            <Button type="submit" disabled={pending}>{pending ? "Zapisywanie…" : "Zapisz"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Scan runs ---------------- */
export function ScanRunForm({ open, onOpenChange, scan }: { open: boolean; onOpenChange: (open: boolean) => void; scan?: ScanRun | null }) {
  const [form, setForm] = useState({ started: "", source: "", status: "completed", matches_found: "0", notes: "" });
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    setError("");
    setForm({
      started: isoToBrusselsInput(scan?.started_at) || nowBrusselsInput(),
      source: scan?.source ?? "",
      status: scan?.status ?? "completed",
      matches_found: String(scan?.matches_found ?? 0),
      notes: scan?.notes ?? "",
    });
  }, [open, scan]);
  const save = useAction(async () => {
    const startedAt = brusselsInputToISO(form.started);
    const row = {
      scan_date: form.started.slice(0, 10),
      source: form.source.trim() || "manual",
      started_at: startedAt,
      completed_at: form.status === "started" ? null : (scan?.completed_at ?? new Date().toISOString()),
      status: form.status,
      matches_found: Math.max(0, Math.floor(Number(form.matches_found) || 0)),
      notes: form.notes.trim() || null,
    };
    if (scan) await updateRow("scan_runs", scan.id, row);
    else await insertRow("scan_runs", row);
  }, { success: "Zapisano skan", onDone: () => onOpenChange(false) });
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={scan ? "Edytuj skan" : "Nowy skan"} pending={save.isPending} onSubmit={() => {
      if (!brusselsInputToISO(form.started)) return setError("Podaj datę skanu.");
      setError("");
      save.mutate(undefined);
    }}>
      <Field label="Data skanu (Bruksela)" error={error}><Input type="datetime-local" value={form.started} onChange={(event) => setForm({ ...form, started: event.target.value })} /></Field>
      <Field label="Źródło"><Input value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value })} placeholder="np. FootyNomad + źródła publiczne" /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Status">
          <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="started">started</SelectItem>
              <SelectItem value="completed">completed</SelectItem>
              <SelectItem value="partial">partial</SelectItem>
              <SelectItem value="failed">failed</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Liczba znalezionych meczów"><Input inputMode="numeric" value={form.matches_found} onChange={(event) => setForm({ ...form, matches_found: event.target.value })} /></Field>
      </div>
      <Field label="Notatki"><Textarea rows={2} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></Field>
    </FormDialog>
  );
}

/* ---------------- Odds snapshots ---------------- */
export function OddsForm({
  open,
  onOpenChange,
  snapshot,
  predictions,
  matches,
  defaultPredictionId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  snapshot?: OddsSnapshot | null;
  predictions: Prediction[];
  matches: Match[];
  defaultPredictionId?: string | undefined;
}) {
  const [form, setForm] = useState({ prediction_id: "", bookmaker: "", odds: "", captured: "", source_url: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const matchById = new Map(matches.map((match) => [match.id, match]));
  useEffect(() => {
    if (!open) return;
    setErrors({});
    setForm({
      prediction_id: snapshot?.prediction_id ?? defaultPredictionId ?? "",
      bookmaker: snapshot?.bookmaker ?? "",
      odds: snapshot?.odds != null ? String(snapshot.odds) : "",
      captured: isoToBrusselsInput(snapshot?.captured_at) || nowBrusselsInput(),
      source_url: snapshot?.source_url ?? "",
    });
  }, [open, snapshot, defaultPredictionId]);
  const save = useAction(async () => {
    const row = {
      prediction_id: form.prediction_id,
      bookmaker: form.bookmaker.trim(),
      odds: parseDecimal(form.odds),
      captured_at: brusselsInputToISO(form.captured),
      source_url: form.source_url.trim() || null,
    };
    if (snapshot) await updateRow("odds_snapshots", snapshot.id, row);
    else await insertRow("odds_snapshots", row);
    const prediction = predictions.find((item) => item.id === row.prediction_id);
    if (!prediction) throw new Error("Nie znaleziono prognozy, do której zapisujesz kurs.");
    await updateRow("predictions", prediction.id, {
      odds: row.odds,
      data_source: row.bookmaker,
      data_coverage: {
        ...(prediction.data_coverage ?? {}),
        odds_source: "manual",
        odds_bookmaker: row.bookmaker,
        odds_captured_at: row.captured_at,
        odds_suspended: false,
      },
    });
  }, { success: "Zapisano kurs i przypisano go do wybranego typu", onDone: () => onOpenChange(false) });
  function submit() {
    const next: Record<string, string> = {};
    if (!form.prediction_id) next["prediction_id"] = "Wybierz prognozę.";
    if (!form.bookmaker.trim()) next["bookmaker"] = "Podaj bukmachera.";
    const odd = parseDecimal(form.odds);
    if (odd == null || odd <= 1) next["odds"] = "Kurs musi być większy niż 1,00.";
    if (!brusselsInputToISO(form.captured)) next["captured"] = "Podaj czas.";
    setErrors(next);
    if (!Object.keys(next).length) save.mutate(undefined);
  }
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={snapshot ? "Edytuj kurs" : "Nowy snapshot kursu"} pending={save.isPending} onSubmit={submit}>
      <Field label="Prognoza" error={errors["prediction_id"]}>
        <Select value={form.prediction_id} onValueChange={(value) => setForm({ ...form, prediction_id: value })}>
          <SelectTrigger><SelectValue placeholder="Wybierz prognozę" /></SelectTrigger>
          <SelectContent>
            {predictions.map((prediction) => {
              const match = matchById.get(prediction.match_id);
              return <SelectItem key={prediction.id} value={prediction.id}>{matchLabel(match)} · {prediction.market} · {prediction.selection}</SelectItem>;
            })}
          </SelectContent>
        </Select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Bukmacher" error={errors["bookmaker"]}><Input value={form.bookmaker} onChange={(event) => setForm({ ...form, bookmaker: event.target.value })} /></Field>
        <Field label="Kurs" error={errors["odds"]}><Input inputMode="decimal" className="num" value={form.odds} onChange={(event) => setForm({ ...form, odds: event.target.value })} /></Field>
        <Field label="Czas (Bruksela)" error={errors["captured"]}><Input type="datetime-local" value={form.captured} onChange={(event) => setForm({ ...form, captured: event.target.value })} /></Field>
        <Field label="URL źródła"><Input value={form.source_url} onChange={(event) => setForm({ ...form, source_url: event.target.value })} placeholder="https://…" /></Field>
      </div>
    </FormDialog>
  );
}

/* ---------------- Bankroll transactions ---------------- */
export async function rebuildBalances() {
  const transactions = await fetchAll("bankroll_transactions");
  let balance = 0;
  const ordered = [...transactions].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
  for (const transaction of ordered) {
    balance = Math.round((balance + signedAmount(transaction)) * 100) / 100;
    if (transaction.balance_after !== balance)
      await updateRow("bankroll_transactions", transaction.id, { balance_after: balance });
  }
}

export function TransactionForm({ open, onOpenChange, tx, coupons = [] }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tx?: BankrollTransaction | null;
  coupons?: Coupon[];
}) {
  const [form, setForm] = useState({ when: "", transaction_type: "deposit" as TransactionType, amount: "", note: "", coupon_id: NONE });
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!open) return;
    setErrors({});
    setForm({
      when: isoToBrusselsInput(tx?.occurred_at) || nowBrusselsInput(),
      transaction_type: tx?.transaction_type ?? "deposit",
      amount: tx ? String(tx.amount) : "",
      note: tx?.note ?? "",
      coupon_id: tx?.coupon_id ?? NONE,
    });
  }, [open, tx]);
  const amount = parseDecimal(form.amount);
  const save = useAction(async () => {
    const row = {
      occurred_at: brusselsInputToISO(form.when),
      transaction_type: form.transaction_type,
      amount: form.transaction_type === "adjustment" ? amount : Math.abs(amount ?? 0),
      balance_after: null,
      coupon_id: form.coupon_id === NONE ? null : form.coupon_id,
      note: form.note.trim() || null,
    };
    if (tx) await updateRow("bankroll_transactions", tx.id, row);
    else await insertRow("bankroll_transactions", row);
    await rebuildBalances();
  }, { success: "Zapisano transakcję i przeliczono saldo", onDone: () => onOpenChange(false) });
  function submit() {
    const next: Record<string, string> = {};
    if (!brusselsInputToISO(form.when)) next["when"] = "Podaj datę.";
    if (amount == null || amount === 0) next["amount"] = "Podaj kwotę różną od zera.";
    else if (form.transaction_type !== "adjustment" && amount < 0) next["amount"] = "Kwota dodatnia — kierunek wynika z typu.";
    setErrors(next);
    if (!Object.keys(next).length) save.mutate(undefined);
  }
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={tx ? "Edytuj transakcję" : "Nowa transakcja"} pending={save.isPending} onSubmit={submit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Typ">
          <Select value={form.transaction_type} onValueChange={(value) => setForm({ ...form, transaction_type: value as TransactionType })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(TX_LABELS).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Kwota" error={errors["amount"]} hint={form.transaction_type === "adjustment" ? "Może być ujemna" : "Wpisz kwotę dodatnią"}>
          <Input inputMode="decimal" className="num" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
        </Field>
        <Field label="Data (Bruksela)" error={errors["when"]}><Input type="datetime-local" value={form.when} onChange={(event) => setForm({ ...form, when: event.target.value })} /></Field>
        <Field label="Powiązany kupon">
          <Select value={form.coupon_id} onValueChange={(value) => setForm({ ...form, coupon_id: value })}>
            <SelectTrigger><SelectValue placeholder="Bez kuponu" /></SelectTrigger>
            <SelectContent><SelectItem value={NONE}>Bez kuponu</SelectItem>{coupons.map((coupon) => <SelectItem key={coupon.id} value={coupon.id}>{coupon.name}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
      </div>
      <Field label="Notatka"><Input value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} /></Field>
    </FormDialog>
  );
}

/* ---------------- Match result ---------------- */
export function ResultForm({
  open,
  onOpenChange,
  match,
  result,
  onSave,
  pending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  match: Match | null;
  result?: MatchResult | undefined;
  onSave: (
    value:
      | { kind: "score"; home: number; away: number; source: string; verified: boolean }
      | { kind: "void"; status: "cancelled" | "postponed"; source: string; verified: boolean },
  ) => void;
  pending: boolean;
}) {
  const [home, setHome] = useState("");
  const [away, setAway] = useState("");
  const [isVoid, setVoid] = useState(false);
  const [voidStatus, setVoidStatus] = useState<"cancelled" | "postponed">("cancelled");
  const [source, setSource] = useState("ręcznie");
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    setError("");
    setHome(result?.home_score != null ? String(result.home_score) : "");
    setAway(result?.away_score != null ? String(result.away_score) : "");
    const matchIsVoid = match?.status === "postponed" || match?.status === "cancelled";
    setVoid(result ? result.home_score == null && result.away_score == null : matchIsVoid);
    setVoidStatus(match?.status === "postponed" ? "postponed" : "cancelled");
    setSource(result?.source ?? (matchIsVoid ? "FootyNomad" : "ręcznie"));
    setVerified(result?.verified ?? matchIsVoid);
  }, [open, result, match]);
  function submit() {
    if (isVoid) return onSave({ kind: "void", status: voidStatus, source, verified });
    const homeScore = Number(home);
    const awayScore = Number(away);
    if (home === "" || away === "" || !Number.isInteger(homeScore) || !Number.isInteger(awayScore) || homeScore < 0 || awayScore < 0)
      return setError("Podaj wynik jako liczby całkowite ≥ 0.");
    onSave({ kind: "score", home: homeScore, away: awayScore, source, verified });
  }
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={isVoid ? "Zwrot za mecz przełożony / odwołany" : "Wynik i weryfikacja"} pending={pending} onSubmit={submit}>
      <div className="text-sm text-muted-foreground">{matchLabel(match)}</div>
      {!isVoid && (
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
          <Field label={match?.home_team ?? "Gospodarze"}><Input inputMode="numeric" className="num text-center text-2xl" value={home} onChange={(event) => setHome(event.target.value)} /></Field>
          <span className="pb-2 text-2xl text-muted-foreground">:</span>
          <Field label={match?.away_team ?? "Goście"}><Input inputMode="numeric" className="num text-center text-2xl" value={away} onChange={(event) => setAway(event.target.value)} /></Field>
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Field label="Źródło wyniku"><Input value={source} onChange={(event) => setSource(event.target.value)} /></Field>
      <div className="flex items-center gap-2">
        <Checkbox id="result-void" checked={isVoid} onCheckedChange={(value) => setVoid(value === true)} />
        <Label htmlFor="result-void">Mecz odwołany / przełożony — zwrot</Label>
      </div>
      {isVoid && (
        <Select value={voidStatus} onValueChange={(value) => setVoidStatus(value as "cancelled" | "postponed")}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="cancelled">Odwołany</SelectItem><SelectItem value="postponed">Przełożony</SelectItem></SelectContent>
        </Select>
      )}
      <div className="flex items-start gap-2 rounded-lg border border-border p-3">
        <Checkbox id="result-verified" checked={verified} onCheckedChange={(value) => setVerified(value === true)} />
        <div className="grid gap-1">
          <Label htmlFor="result-verified">Weryfikuję wynik</Label>
          <p className="text-xs text-muted-foreground">Rozliczenie prognoz i kuponów nastąpi wyłącznie po zaznaczeniu tej opcji.</p>
        </div>
      </div>
    </FormDialog>
  );
}
