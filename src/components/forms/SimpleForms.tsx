import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/app/ui-bits";
import { MatchPicker } from "@/components/app/MatchPicker";
import { insertRow, updateRow } from "@/lib/db";
import { TX_LABELS } from "@/lib/domain";
import { matchLabel, parseDecimal } from "@/lib/format";
import { useAction } from "@/lib/queries";
import { brusselsInputToISO, isoToBrusselsInput, nowBrusselsInput } from "@/lib/time";
import type { BankrollTransaction, Match, MatchResult, OddsSnapshot, ScanRun, TxType } from "@/lib/types";

function FormDialog({
  open,
  onOpenChange,
  title,
  onSubmit,
  pending,
  children,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  onSubmit: () => void;
  pending: boolean;
  children: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto bg-card">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl uppercase">{title}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
          className="grid gap-4"
        >
          {children}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Anuluj
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Zapisywanie…" : "Zapisz"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Scan runs ---------------- */
export function ScanRunForm({ open, onOpenChange, scan }: { open: boolean; onOpenChange: (o: boolean) => void; scan?: ScanRun | null }) {
  const [f, setF] = useState({ started: "", source: "", notes: "" });
  const [err, setErr] = useState("");
  useEffect(() => {
    if (open) {
      setErr("");
      setF({ started: isoToBrusselsInput(scan?.started_at) || nowBrusselsInput(), source: scan?.source ?? "", notes: scan?.notes ?? "" });
    }
  }, [open, scan]);
  const save = useAction(
    async () => {
      const row = { started_at: brusselsInputToISO(f.started), source: f.source.trim() || null, notes: f.notes.trim() || null };
      if (scan) await updateRow("scan_runs", scan.id, row);
      else await insertRow("scan_runs", row);
    },
    { success: "Zapisano skan", onDone: () => onOpenChange(false) },
  );
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={scan ? "Edytuj skan" : "Nowy skan"}
      pending={save.isPending}
      onSubmit={() => {
        if (!brusselsInputToISO(f.started)) return setErr("Podaj datę skanu.");
        save.mutate(undefined);
      }}
    >
      <Field label="Data skanu (Bruksela)" error={err}>
        <Input type="datetime-local" value={f.started} onChange={(e) => setF({ ...f, started: e.target.value })} />
      </Field>
      <Field label="Źródło / model">
        <Input value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} placeholder="np. model v2" />
      </Field>
      <Field label="Notatki">
        <Textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
      </Field>
    </FormDialog>
  );
}

/* ---------------- Odds snapshots ---------------- */
const ODDS_KEYS = [
  ["odds_1", "1"],
  ["odds_x", "X"],
  ["odds_2", "2"],
  ["odds_1x", "1X"],
  ["odds_x2", "X2"],
  ["odds_12", "12"],
] as const;

export function OddsForm({
  open,
  onOpenChange,
  snapshot,
  matches,
  defaultMatchId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  snapshot?: OddsSnapshot | null;
  matches: Match[];
  defaultMatchId?: string | undefined;
}) {
  const [f, setF] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!open) return;
    setErrors({});
    const o: Record<string, string> = {
      match_id: snapshot?.match_id ?? defaultMatchId ?? "",
      bookmaker: snapshot?.bookmaker ?? "",
      captured: isoToBrusselsInput(snapshot?.captured_at) || nowBrusselsInput(),
    };
    for (const [k] of ODDS_KEYS) o[k] = snapshot?.[k] != null ? String(snapshot[k]) : "";
    setF(o);
  }, [open, snapshot, defaultMatchId]);
  const save = useAction(
    async () => {
      const row: Record<string, unknown> = {
        match_id: f["match_id"],
        bookmaker: (f["bookmaker"] ?? "").trim() || null,
        captured_at: brusselsInputToISO(f["captured"] ?? ""),
      };
      for (const [k] of ODDS_KEYS) row[k] = parseDecimal(f[k] ?? "");
      if (snapshot) await updateRow("odds_snapshots", snapshot.id, row);
      else await insertRow("odds_snapshots", row);
    },
    { success: "Zapisano kursy", onDone: () => onOpenChange(false) },
  );
  function submit() {
    const e: Record<string, string> = {};
    if (!f["match_id"]) e["match_id"] = "Wybierz mecz.";
    if (!brusselsInputToISO(f["captured"] ?? "")) e["captured"] = "Podaj czas.";
    let any = false;
    for (const [k] of ODDS_KEYS) {
      if (!f[k]?.trim()) continue;
      any = true;
      const v = parseDecimal(f[k]);
      if (v == null || v <= 1) e[k] = "> 1,00";
    }
    if (!any) e["odds_1"] = "Podaj co najmniej jeden kurs.";
    setErrors(e);
    if (Object.keys(e).length === 0) save.mutate(undefined);
  }
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={snapshot ? "Edytuj kursy" : "Nowy snapshot kursów"} pending={save.isPending} onSubmit={submit}>
      <Field label="Mecz" error={errors["match_id"]}>
        <MatchPicker matches={matches} value={f["match_id"] ?? ""} onChange={(id) => setF({ ...f, match_id: id })} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Bukmacher">
          <Input value={f["bookmaker"] ?? ""} onChange={(e) => setF({ ...f, bookmaker: e.target.value })} />
        </Field>
        <Field label="Czas (Bruksela)" error={errors["captured"]}>
          <Input type="datetime-local" value={f["captured"] ?? ""} onChange={(e) => setF({ ...f, captured: e.target.value })} />
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {ODDS_KEYS.map(([k, label]) => (
          <Field key={k} label={label} error={errors[k]}>
            <Input inputMode="decimal" className="num" value={f[k] ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
          </Field>
        ))}
      </div>
    </FormDialog>
  );
}

/* ---------------- Bankroll transactions ---------------- */
export function TransactionForm({
  open,
  onOpenChange,
  tx,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  tx?: BankrollTransaction | null;
}) {
  const [f, setF] = useState({ when: "", type: "deposit" as TxType, amount: "", note: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!open) return;
    setErrors({});
    setF({
      when: isoToBrusselsInput(tx?.occurred_at) || nowBrusselsInput(),
      type: tx?.type ?? "deposit",
      amount: tx ? String(tx.amount) : "",
      note: tx?.note ?? "",
    });
  }, [open, tx]);
  const amount = parseDecimal(f.amount);
  const save = useAction(
    async () => {
      const row = {
        occurred_at: brusselsInputToISO(f.when),
        type: f.type,
        amount: f.type === "adjustment" ? amount : Math.abs(amount ?? 0),
        note: f.note.trim() || null,
      };
      if (tx) await updateRow("bankroll_transactions", tx.id, row);
      else await insertRow("bankroll_transactions", row);
    },
    { success: "Zapisano transakcję", onDone: () => onOpenChange(false) },
  );
  function submit() {
    const e: Record<string, string> = {};
    if (!brusselsInputToISO(f.when)) e["when"] = "Podaj datę.";
    if (amount == null || amount === 0) e["amount"] = "Podaj kwotę różną od zera.";
    else if (f.type !== "adjustment" && amount < 0) e["amount"] = "Kwota dodatnia — kierunek wynika z typu.";
    setErrors(e);
    if (Object.keys(e).length === 0) save.mutate(undefined);
  }
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={tx ? "Edytuj transakcję" : "Nowa transakcja"} pending={save.isPending} onSubmit={submit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Typ">
          <Select value={f.type} onValueChange={(v) => setF({ ...f, type: v as TxType })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TX_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Kwota" error={errors["amount"]} hint={f.type === "adjustment" ? "Może być ujemna" : undefined}>
          <Input inputMode="decimal" className="num" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
        </Field>
      </div>
      <Field label="Data (Bruksela)" error={errors["when"]}>
        <Input type="datetime-local" value={f.when} onChange={(e) => setF({ ...f, when: e.target.value })} />
      </Field>
      <Field label="Notatka">
        <Input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
      </Field>
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
  onOpenChange: (o: boolean) => void;
  match: Match | null;
  result?: MatchResult | undefined;
  onSave: (v: { kind: "score"; home: number; away: number } | { kind: "void"; status: "cancelled" | "postponed" }) => void;
  pending: boolean;
}) {
  const [home, setHome] = useState("");
  const [away, setAway] = useState("");
  const [isVoid, setVoid] = useState(false);
  const [voidStatus, setVoidStatus] = useState<"cancelled" | "postponed">("cancelled");
  const [err, setErr] = useState("");
  useEffect(() => {
    if (!open) return;
    setErr("");
    setHome(result?.home_goals != null ? String(result.home_goals) : "");
    setAway(result?.away_goals != null ? String(result.away_goals) : "");
    setVoid(false);
  }, [open, result]);
  function submit() {
    if (isVoid) return onSave({ kind: "void", status: voidStatus });
    const h = Number(home);
    const a = Number(away);
    if (home === "" || away === "" || !Number.isInteger(h) || !Number.isInteger(a) || h < 0 || a < 0)
      return setErr("Podaj wynik jako liczby całkowite ≥ 0.");
    onSave({ kind: "score", home: h, away: a });
  }
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title="Wynik i rozliczenie" pending={pending} onSubmit={submit}>
      <div className="text-sm text-muted-foreground">{matchLabel(match)}</div>
      {!isVoid && (
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
          <Field label={match?.home_team ?? "Gospodarze"}>
            <Input inputMode="numeric" className="num text-center text-2xl" value={home} onChange={(e) => setHome(e.target.value)} />
          </Field>
          <span className="pb-2 text-2xl text-muted-foreground">:</span>
          <Field label={match?.away_team ?? "Goście"}>
            <Input inputMode="numeric" className="num text-center text-2xl" value={away} onChange={(e) => setAway(e.target.value)} />
          </Field>
        </div>
      )}
      {err && <p className="text-xs text-destructive">{err}</p>}
      <div className="flex items-center gap-2">
        <Checkbox id="void" checked={isVoid} onCheckedChange={(v) => setVoid(v === true)} />
        <Label htmlFor="void">Mecz odwołany / przełożony — rozlicz jako zwrot</Label>
      </div>
      {isVoid && (
        <Select value={voidStatus} onValueChange={(v) => setVoidStatus(v as "cancelled" | "postponed")}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cancelled">Odwołany</SelectItem>
            <SelectItem value="postponed">Przełożony</SelectItem>
          </SelectContent>
        </Select>
      )}
      <p className="text-xs text-muted-foreground">
        Zapis rozlicza automatycznie wszystkie prognozy 1X2 i DC tego meczu oraz powiązane kupony.
      </p>
    </FormDialog>
  );
}
