import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Field } from "@/components/app/ui-bits";
import { MatchPicker } from "@/components/app/MatchPicker";
import { insertRow, updateRow } from "@/lib/db";
import { CANDIDATE_MIN_PROBABILITY, impliedProbability, PICK_LABELS, PICKS, SETTLEMENT_LABELS } from "@/lib/domain";
import { fmtPct, parseDecimal } from "@/lib/format";
import { useAction } from "@/lib/queries";
import type { Match, Prediction, PredictionType } from "@/lib/types";

const NONE = "__none__";

export function PredictionForm({
  open,
  onOpenChange,
  type,
  prediction,
  matches,
  defaultMatchId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  type: PredictionType;
  prediction?: Prediction | null;
  matches: Match[];
  defaultMatchId?: string;
}) {
  const [f, setF] = useState({
    match_id: "",
    pick: "",
    probability: "",
    odds: "",
    confidence: NONE,
    selection_status: "WYBRANY",
    rejection_reason: "",
    result_status: "pending",
    notes: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setF({
      match_id: prediction?.match_id ?? defaultMatchId ?? "",
      pick: prediction?.pick ?? "",
      probability: prediction?.probability != null ? String(prediction.probability) : "",
      odds: prediction?.odds != null ? String(prediction.odds) : "",
      confidence: prediction?.confidence ?? NONE,
      selection_status: prediction?.selection_status ?? "WYBRANY",
      rejection_reason: prediction?.rejection_reason ?? "",
      result_status: prediction?.result_status ?? "pending",
      notes: prediction?.notes ?? "",
    });
  }, [open, prediction, defaultMatchId]);

  const prob = parseDecimal(f.probability);
  const odds = parseDecimal(f.odds);
  const implied = impliedProbability(odds);

  const save = useAction(
    async () => {
      const match = matches.find((m) => m.id === f.match_id);
      const row = {
        match_id: f.match_id,
        scan_run_id: prediction?.scan_run_id ?? match?.scan_run_id ?? null,
        prediction_type: type,
        market: type === "DC" ? "DOUBLE_CHANCE" : "1X2",
        selection: f.pick,
        model_version: prediction?.model_version ?? "MONEYBALL GLOBAL 2.0 MANUAL",
        group_name: prediction?.group_name ?? "MANUAL",
        verdict: f.selection_status,
        pick: f.pick,
        probability: prob,
        odds,
        confidence: f.confidence === NONE ? null : f.confidence,
        selection_status: f.selection_status,
        rejection_reason: f.selection_status === "ODRZUCONY" ? f.rejection_reason.trim() || null : null,
        result_status: f.result_status,
        settlement_status: f.result_status,
        verified: prediction?.verified ?? false,
        rationale: f.selection_status === "ODRZUCONY" ? f.rejection_reason.trim() || "Ręcznie odrzucona prognoza." : "Prognoza wprowadzona ręcznie.",
        note: f.rejection_reason.trim() || null,
        data_source: prediction?.data_source ?? "manual",
        data_coverage: prediction?.data_coverage ?? { source: "manual" },
        settled_at: f.result_status === "pending" ? null : (prediction?.settled_at ?? new Date().toISOString()),
        notes: f.notes.trim() || null,
      };
      if (prediction) await updateRow("predictions", prediction.id, row);
      else await insertRow("predictions", row);
    },
    { success: prediction ? "Zapisano prognozę" : "Dodano prognozę", onDone: () => onOpenChange(false) },
  );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (!f.match_id) err["match_id"] = "Wybierz mecz.";
    if (!(PICKS[type] as string[]).includes(f.pick)) err["pick"] = "Wybierz typ.";
    if (prob == null || prob < 0 || prob > 100) err["probability"] = "Podaj wartość 0–100.";
    if (f.odds.trim() && (odds == null || odds <= 1)) err["odds"] = "Kurs musi być większy niż 1,00.";
    setErrors(err);
    if (Object.keys(err).length === 0) save.mutate(undefined);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto bg-card">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl uppercase">
            {prediction ? "Edytuj" : "Nowa"} prognoza {type === "DC" ? "Double Chance" : "1X2"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <Field label="Mecz" error={errors["match_id"]}>
            <MatchPicker matches={matches} value={f.match_id} onChange={(id) => setF((s) => ({ ...s, match_id: id }))} />
          </Field>
          <Field label="Typ" error={errors["pick"]}>
            <ToggleGroup
              type="single"
              value={f.pick}
              onValueChange={(v) => v && setF((s) => ({ ...s, pick: v }))}
              className="grid grid-cols-3 gap-2"
            >
              {PICKS[type].map((p) => (
                <ToggleGroupItem
                  key={p}
                  value={p}
                  className="h-auto flex-col border border-border py-2 data-[state=on]:border-primary data-[state=on]:bg-primary/15 data-[state=on]:text-primary"
                >
                  <span className="num text-lg font-semibold">{p}</span>
                  <span className="text-[10px] text-muted-foreground">{PICK_LABELS[p].split("· ")[1]}</span>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              label="Prawdopodobieństwo %"
              htmlFor="prob"
              error={errors["probability"]}
              hint={prob != null && prob > CANDIDATE_MIN_PROBABILITY ? "Kandydat na kupon (>75%)" : "Szacunek modelu"}
            >
              <Input id="prob" inputMode="decimal" value={f.probability} onChange={(e) => setF((s) => ({ ...s, probability: e.target.value }))} />
            </Field>
            <Field label="Kurs bukmachera" htmlFor="odds" error={errors["odds"]} hint={implied != null ? `Implikowane: ${fmtPct(implied)}` : "Opcjonalnie"}>
              <Input id="odds" inputMode="decimal" value={f.odds} onChange={(e) => setF((s) => ({ ...s, odds: e.target.value }))} />
            </Field>
            <Field label="Pewność">
              <Select value={f.confidence} onValueChange={(v) => setF((s) => ({ ...s, confidence: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Brak</SelectItem>
                  <SelectItem value="niska">Niska</SelectItem>
                  <SelectItem value="średnia">Średnia</SelectItem>
                  <SelectItem value="wysoka">Wysoka</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Status selekcji">
              <ToggleGroup
                type="single"
                value={f.selection_status}
                onValueChange={(v) => v && setF((s) => ({ ...s, selection_status: v }))}
                className="grid grid-cols-2 gap-2"
              >
                <ToggleGroupItem value="WYBRANY" className="border border-border font-display tracking-wider data-[state=on]:border-primary data-[state=on]:bg-primary/15 data-[state=on]:text-primary">
                  WYBRANY
                </ToggleGroupItem>
                <ToggleGroupItem value="ODRZUCONY" className="border border-border font-display tracking-wider data-[state=on]:border-muted-foreground data-[state=on]:bg-muted">
                  ODRZUCONY
                </ToggleGroupItem>
              </ToggleGroup>
            </Field>
            {prediction && (
              <Field label="Rozliczenie (ręcznie)">
                <Select value={f.result_status} onValueChange={(v) => setF((s) => ({ ...s, result_status: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SETTLEMENT_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          </div>
          {f.selection_status === "ODRZUCONY" && (
            <Field label="Powód odrzucenia" htmlFor="reason">
              <Input id="reason" value={f.rejection_reason} onChange={(e) => setF((s) => ({ ...s, rejection_reason: e.target.value }))} />
            </Field>
          )}
          <Field label="Notatki" htmlFor="pnotes">
            <Textarea id="pnotes" rows={2} value={f.notes} onChange={(e) => setF((s) => ({ ...s, notes: e.target.value }))} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Anuluj
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Zapisywanie…" : "Zapisz"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
