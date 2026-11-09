import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/app/ui-bits";
import { insertRow, updateRow } from "@/lib/db";
import { MATCH_STATUS_LABELS } from "@/lib/domain";
import { useAction } from "@/lib/queries";
import { brusselsInputToISO, fmtDateTime, isoToBrusselsInput } from "@/lib/time";
import type { Match, ScanRun } from "@/lib/types";

const NONE = "__none__";

export function MatchForm({
  open,
  onOpenChange,
  match,
  scanRuns,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  match?: Match | null;
  scanRuns: ScanRun[];
}) {
  const [f, setF] = useState({
    home_team: "",
    away_team: "",
    league: "",
    country: "",
    kickoff: "",
    status: "scheduled",
    scan_run_id: NONE,
    notes: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setF({
      home_team: match?.home_team ?? "",
      away_team: match?.away_team ?? "",
      league: match?.league ?? "",
      country: match?.country ?? "",
      kickoff: isoToBrusselsInput(match?.kickoff_at),
      status: match?.status ?? "scheduled",
      scan_run_id: match?.scan_run_id ?? NONE,
      notes: match?.notes ?? "",
    });
  }, [open, match]);

  const save = useAction(
    async () => {
      const row = {
        home_team: f.home_team.trim(),
        away_team: f.away_team.trim(),
        league: f.league.trim(),
        country: f.country.trim() || null,
        kickoff_at: brusselsInputToISO(f.kickoff),
        status: f.status,
        scan_run_id: f.scan_run_id === NONE ? null : f.scan_run_id,
        notes: f.notes.trim() || null,
      };
      if (match) await updateRow("matches", match.id, row);
      else await insertRow("matches", row);
    },
    { success: match ? "Zapisano mecz" : "Dodano mecz", onDone: () => onOpenChange(false) },
  );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (!f.home_team.trim()) err.home_team = "Podaj gospodarzy.";
    if (!f.away_team.trim()) err.away_team = "Podaj gości.";
    if (f.home_team.trim() && f.home_team.trim().toLowerCase() === f.away_team.trim().toLowerCase())
      err.away_team = "Drużyny muszą być różne.";
    if (!f.league.trim()) err.league = "Podaj ligę.";
    if (!brusselsInputToISO(f.kickoff)) err.kickoff = "Podaj datę i godzinę.";
    setErrors(err);
    if (Object.keys(err).length === 0) save.mutate(undefined);
  }

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF((s) => ({ ...s, [k]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto bg-card">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl uppercase">{match ? "Edytuj mecz" : "Nowy mecz"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Gospodarze" htmlFor="home" error={errors.home_team}>
              <Input id="home" value={f.home_team} onChange={set("home_team")} />
            </Field>
            <Field label="Goście" htmlFor="away" error={errors.away_team}>
              <Input id="away" value={f.away_team} onChange={set("away_team")} />
            </Field>
            <Field label="Liga" htmlFor="league" error={errors.league}>
              <Input id="league" value={f.league} onChange={set("league")} />
            </Field>
            <Field label="Kraj" htmlFor="country">
              <Input id="country" value={f.country} onChange={set("country")} />
            </Field>
            <Field label="Start (czas Brukseli)" htmlFor="kickoff" error={errors.kickoff}>
              <Input id="kickoff" type="datetime-local" value={f.kickoff} onChange={set("kickoff")} />
            </Field>
            <Field label="Status">
              <Select value={f.status} onValueChange={(v) => setF((s) => ({ ...s, status: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(MATCH_STATUS_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Skan">
            <Select value={f.scan_run_id} onValueChange={(v) => setF((s) => ({ ...s, scan_run_id: v }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Bez skanu</SelectItem>
                {scanRuns.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {fmtDateTime(s.started_at ?? s.created_at)} · {s.source ?? "skan"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Notatki" htmlFor="notes">
            <Textarea id="notes" rows={2} value={f.notes} onChange={set("notes")} />
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
