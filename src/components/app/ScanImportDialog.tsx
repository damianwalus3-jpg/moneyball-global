import { Download, FileUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/app/ui-bits";
import { downloadFile, parseCsv } from "@/lib/backup";
import { useAction, useTable } from "@/lib/queries";
import { parseScanRows, SCAN_TEMPLATE_CSV, type ParsedScan } from "@/lib/scan-import";
import { importScan } from "@/lib/scan-import-service";

export function ScanImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const matches = useTable("matches");
  const [text, setText] = useState("");
  const [source, setSource] = useState("");
  const [parseError, setParseError] = useState("");

  useEffect(() => {
    if (open) {
      setText("");
      setSource("");
      setParseError("");
    }
  }, [open]);

  const parsed: ParsedScan | null = useMemo(() => {
    if (!text.trim()) return null;
    try {
      setParseError("");
      return parseScanRows(parseCsv(text));
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Błąd pliku.");
      return null;
    }
  }, [text]);

  const run = useAction(() => importScan(parsed!, matches, source), {
    success: (r) =>
      `Zaimportowano: ${r.newMatches} nowych meczów, ${r.reusedMatches} istniejących, ${r.predictions} prognoz`,
    onDone: () => onOpenChange(false),
  });

  const selected = parsed?.predictions.filter((p) => p.selection_status === "WYBRANY").length ?? 0;
  const rejected = parsed?.predictions.filter((p) => p.selection_status === "ODRZUCONY").length ?? 0;
  const dc = parsed?.predictions.filter((p) => p.prediction_type === "DC").length ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto bg-card sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl uppercase">Import skanu (CSV)</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <p className="text-sm text-muted-foreground">
            Każdy poprawny wiersz zapisuje mecz. Prognozy z prawdopodobieństwem ≤ 75% trafiają do bazy jako{" "}
            <strong>ODRZUCONY</strong> — nic nie jest pomijane. Czas bez strefy traktowany jest jako Europe/Brussels.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <label className="cursor-pointer">
                <FileUp /> Wybierz plik
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) setText(await f.text());
                    e.target.value = "";
                  }}
                />
              </label>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => downloadFile("szablon-skanu.csv", SCAN_TEMPLATE_CSV, "text/csv")}
            >
              <Download /> Szablon CSV
            </Button>
          </div>
          <Field label="Zawartość CSV" error={parseError}>
            <Textarea
              rows={6}
              className="num text-xs"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="kickoff,league,country,home_team,away_team,prediction_type,pick,probability,odds"
            />
          </Field>
          <Field label="Źródło / model">
            <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="np. skan poranny" />
          </Field>
          {parsed && (
            <div className="surface-card grid gap-2 p-3 text-sm">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat label="Mecze" value={parsed.matches.length} />
                <Stat label="WYBRANY" value={selected} />
                <Stat label="ODRZUCONY" value={rejected} />
                <Stat label="w tym DC" value={dc} />
              </div>
              {parsed.errors.length > 0 && (
                <div className="mt-2 max-h-40 overflow-y-auto rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs">
                  <div className="mb-1 font-semibold text-destructive">Błędy ({parsed.errors.length}) — popraw przed importem:</div>
                  {parsed.errors.map((e, i) => (
                    <div key={i}>
                      Wiersz {e.row}: {e.message}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Anuluj
          </Button>
          <Button
            disabled={!parsed || parsed.errors.length > 0 || parsed.matches.length === 0 || run.isPending}
            onClick={() => run.mutate(undefined)}
          >
            {run.isPending ? "Importowanie…" : "Importuj"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="eyebrow">{label}</div>
      <div className="num text-xl font-semibold">{value}</div>
    </div>
  );
}
