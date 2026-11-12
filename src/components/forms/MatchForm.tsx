import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/app/ui-bits";
import { insertRow, updateRow } from "@/lib/db";
import { MATCH_STATUS_LABELS } from "@/lib/domain";
import { useAction } from "@/lib/queries";
import { brusselsInputToISO, fmtDateTime, isoToBrusselsInput } from "@/lib/time";
import type { Gender, Match, ScanRun } from "@/lib/types";

const NONE = "__none__";
const GENDERS: { value: Gender; label: string }[] = [
  { value: "men", label: "Mężczyźni" },
  { value: "women", label: "Kobiety" },
  { value: "mixed", label: "Mieszane" },
  { value: "unknown", label: "Nieznana" },
];

export function MatchForm({
  open,
  onOpenChange,
  match,
  scanRuns,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  match?: Match | null;
  scanRuns: ScanRun[];
}) {
  const [form, setForm] = useState({
    home_team: "",
    away_team: "",
    competition: "",
    country: "",
    gender: "unknown" as Gender,
    kickoff: "",
    status: "scheduled",
    source: "manual",
    scan_run_id: NONE,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setForm({
      home_team: match?.home_team ?? "",
      away_team: match?.away_team ?? "",
      competition: match?.competition ?? "",
      country: match?.country ?? "",
      gender: match?.gender ?? "unknown",
      kickoff: isoToBrusselsInput(match?.kickoff_at),
      status: match?.status ?? "scheduled",
      source: match?.source ?? "manual",
      scan_run_id: match?.scan_run_id ?? NONE,
    });
  }, [open, match]);

  const save = useAction(
    async () => {
      const row = {
        home_team: form.home_team.trim(),
        away_team: form.away_team.trim(),
        competition: form.competition.trim() || null,
        country: form.country.trim() || null,
        gender: form.gender,
        kickoff_at: brusselsInputToISO(form.kickoff),
        status: form.status,
        source: form.source.trim() || "manual",
        scan_run_id: form.scan_run_id === NONE ? null : form.scan_run_id,
      };
      if (match) await updateRow("matches", match.id, row);
      else await insertRow("matches", row);
    },
    { success: match ? "Zapisano mecz" : "Dodano mecz", onDone: () => onOpenChange(false) },
  );

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!form.home_team.trim()) nextErrors["home_team"] = "Podaj gospodarzy.";
    if (!form.away_team.trim()) nextErrors["away_team"] = "Podaj gości.";
    if (form.home_team.trim() && form.home_team.trim().toLowerCase() === form.away_team.trim().toLowerCase())
      nextErrors["away_team"] = "Drużyny muszą być różne.";
    if (!brusselsInputToISO(form.kickoff)) nextErrors["kickoff"] = "Podaj datę i godzinę.";
    setErrors(nextErrors);
    if (!Object.keys(nextErrors).length) save.mutate(undefined);
  }

  const set = (key: "home_team" | "away_team" | "competition" | "country" | "source" | "kickoff") =>
    (event: React.ChangeEvent<HTMLInputElement>) => setForm((current) => ({ ...current, [key]: event.target.value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto bg-card">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl uppercase">{match ? "Edytuj mecz" : "Nowy mecz"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Gospodarze" htmlFor="home" error={errors["home_team"]}>
              <Input id="home" value={form.home_team} onChange={set("home_team")} />
            </Field>
            <Field label="Goście" htmlFor="away" error={errors["away_team"]}>
              <Input id="away" value={form.away_team} onChange={set("away_team")} />
            </Field>
            <Field label="Rozgrywki" htmlFor="competition">
              <Input id="competition" value={form.competition} onChange={set("competition")} placeholder="Nazwa rozgrywek" />
            </Field>
            <Field label="Kraj" htmlFor="country">
              <Input id="country" value={form.country} onChange={set("country")} />
            </Field>
            <Field label="Płeć / kategoria">
              <Select value={form.gender} onValueChange={(value) => setForm((current) => ({ ...current, gender: value as Gender }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{GENDERS.map((gender) => <SelectItem key={gender.value} value={gender.value}>{gender.label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Źródło" htmlFor="source">
              <Input id="source" value={form.source} onChange={set("source")} />
            </Field>
            <Field label="Start (czas Brukseli)" htmlFor="kickoff" error={errors["kickoff"]}>
              <Input id="kickoff" type="datetime-local" value={form.kickoff} onChange={set("kickoff")} />
            </Field>
            <Field label="Status">
              <Select value={form.status} onValueChange={(value) => setForm((current) => ({ ...current, status: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(MATCH_STATUS_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Skan">
            <Select value={form.scan_run_id} onValueChange={(value) => setForm((current) => ({ ...current, scan_run_id: value }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Bez skanu</SelectItem>
                {scanRuns.map((scan) => (
                  <SelectItem key={scan.id} value={scan.id}>
                    {fmtDateTime(scan.started_at)} · {scan.source}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
