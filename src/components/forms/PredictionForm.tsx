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
import { CANDIDATE_MIN_PROBABILITY, impliedProbability, PICK_LABELS, PICKS } from "@/lib/domain";
import { fmtPct, parseDecimal } from "@/lib/format";
import { useAction } from "@/lib/queries";
import type { Market, Match, Prediction, Verdict } from "@/lib/types";

const NONE = "__none__";
const GROUPS = ["TEST", "MAIN", "MEGA", "EXTRA"] as const;

export function PredictionForm({
  open,
  onOpenChange,
  market,
  prediction,
  matches,
  defaultMatchId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  market: Market;
  prediction?: Prediction | null;
  matches: Match[];
  defaultMatchId?: string;
}) {
  const [form, setForm] = useState({
    match_id: "",
    selection: "",
    probability: "",
    odds: "",
    confidence: NONE,
    verdict: "ODRZUCONY" as Verdict,
    rationale: "",
    model_version: "MANUAL",
    group_name: "TEST",
    note: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setForm({
      match_id: prediction?.match_id ?? defaultMatchId ?? "",
      selection: prediction?.selection === "—" ? "" : prediction?.selection ?? "",
      probability: prediction?.probability != null ? String(prediction.probability) : "",
      odds: prediction?.odds != null ? String(prediction.odds) : "",
      confidence: prediction?.confidence ?? NONE,
      verdict: prediction?.verdict === "WYBRANY" ? "WYBRANY" : "ODRZUCONY",
      rationale: prediction?.rationale ?? "",
      model_version: prediction?.model_version ?? "MANUAL",
      group_name: prediction?.group_name ?? "TEST",
      note: prediction?.note ?? "",
    });
  }, [open, prediction, defaultMatchId]);

  const probability = parseDecimal(form.probability);
  const odds = parseDecimal(form.odds);
  const implied = impliedProbability(odds);

  const save = useAction(
    async () => {
      const row = {
        match_id: form.match_id,
        model_version: form.model_version.trim() || "MANUAL",
        market,
        selection: form.selection,
        probability,
        confidence: form.confidence === NONE ? null : form.confidence,
        verdict: form.verdict,
        rationale: form.rationale.trim() || null,
        group_name: form.group_name,
        odds,
        settlement_status: prediction?.settlement_status ?? "pending",
        verified: prediction?.verified ?? false,
        note: form.note.trim() || null,
      };
      if (prediction) await updateRow("predictions", prediction.id, row);
      else await insertRow("predictions", row);
    },
    { success: prediction ? "Zapisano prognozę" : "Dodano prognozę", onDone: () => onOpenChange(false) },
  );

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!form.match_id) nextErrors["match_id"] = "Wybierz mecz.";
    if (!(PICKS[market] as string[]).includes(form.selection)) nextErrors["selection"] = "Wybierz poprawny typ.";
    if (probability == null || probability < 0 || probability > 100) nextErrors["probability"] = "Podaj wartość 0–100.";
    if (form.odds.trim() && (odds == null || odds <= 1)) nextErrors["odds"] = "Kurs musi być większy niż 1,00.";
    setErrors(nextErrors);
    if (!Object.keys(nextErrors).length) save.mutate(undefined);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto bg-card">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl uppercase">
            {prediction ? "Edytuj" : "Nowa"} prognoza · {market === "DOUBLE_CHANCE" ? "Double Chance" : "1X2"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <Field label="Mecz" error={errors["match_id"]}>
            <MatchPicker matches={matches} value={form.match_id} onChange={(id) => setForm((current) => ({ ...current, match_id: id }))} />
          </Field>
          <Field label="Wybór" error={errors["selection"]}>
            <ToggleGroup
              type="single"
              value={form.selection}
              onValueChange={(value) => value && setForm((current) => ({ ...current, selection: value }))}
              className="grid grid-cols-3 gap-2"
            >
              {PICKS[market].map((selection) => (
                <ToggleGroupItem
                  key={selection}
                  value={selection}
                  className="h-auto flex-col border border-border py-2 data-[state=on]:border-primary data-[state=on]:bg-primary/15 data-[state=on]:text-primary"
                >
                  <span className="num text-lg font-semibold">{selection}</span>
                  <span className="text-[10px] text-muted-foreground">{PICK_LABELS[selection].split("· ")[1]}</span>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              label="Prawdopodobieństwo %"
              htmlFor="prob"
              error={errors["probability"]}
              hint={probability != null && probability > CANDIDATE_MIN_PROBABILITY ? "Kandydat na kupon (>75%)" : "Szacunek modelu"}
            >
              <Input id="prob" inputMode="decimal" value={form.probability} onChange={(event) => setForm((current) => ({ ...current, probability: event.target.value }))} />
            </Field>
            <Field label="Kurs bukmachera" htmlFor="odds" error={errors["odds"]} hint={implied != null ? `Implikowane: ${fmtPct(implied)}` : "Opcjonalnie"}>
              <Input id="odds" inputMode="decimal" value={form.odds} onChange={(event) => setForm((current) => ({ ...current, odds: event.target.value }))} />
            </Field>
            <Field label="Pewność">
              <Select value={form.confidence} onValueChange={(value) => setForm((current) => ({ ...current, confidence: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
            <Field label="Werdykt">
              <ToggleGroup
                type="single"
                value={form.verdict}
                onValueChange={(value) => value && setForm((current) => ({ ...current, verdict: value as Verdict }))}
                className="grid grid-cols-2 gap-2"
              >
                <ToggleGroupItem value="WYBRANY" className="border border-border font-display tracking-wider data-[state=on]:border-primary data-[state=on]:bg-primary/15 data-[state=on]:text-primary">WYBRANY</ToggleGroupItem>
                <ToggleGroupItem value="ODRZUCONY" className="border border-border font-display tracking-wider data-[state=on]:border-muted-foreground data-[state=on]:bg-muted">ODRZUCONY</ToggleGroupItem>
              </ToggleGroup>
            </Field>
            <Field label="Grupa">
              <Select value={form.group_name} onValueChange={(value) => setForm((current) => ({ ...current, group_name: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{GROUPS.map((group) => <SelectItem key={group} value={group}>{group}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Model" htmlFor="model">
            <Input id="model" value={form.model_version} onChange={(event) => setForm((current) => ({ ...current, model_version: event.target.value }))} />
          </Field>
          <Field label="Uzasadnienie" htmlFor="rationale">
            <Textarea id="rationale" rows={2} value={form.rationale} onChange={(event) => setForm((current) => ({ ...current, rationale: event.target.value }))} />
          </Field>
          <Field label="Notatka" htmlFor="note">
            <Textarea id="note" rows={2} value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Anuluj</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? "Zapisywanie…" : "Zapisz"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
