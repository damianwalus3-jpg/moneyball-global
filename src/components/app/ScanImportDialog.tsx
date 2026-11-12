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

export function ScanImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const matches = useTable("matches");
  const [text, setText] = useState("");
  const [source, setSource] = useState("CSV import");

  useEffect(() => {
    if (open) {
      setText("");
      setSource("CSV import");
    }
  }, [open]);

  const { parsed, parseError } = useMemo((): { parsed: ParsedScan | null; parseError: string } => {
    if (!text.trim()) return { parsed: null, parseError: "" };
    try {
      return { parsed: parseScanRows(parseCsv(text)), parseError: "" };
    } catch (error) {
      return { parsed: null, parseError: error instanceof Error ? error.message : "Błąd pliku." };
    }
  }, [text]);

  const selected = parsed?.predictions.filter((prediction) => prediction.verdict === "WYBRANY").length ?? 0;
  const rejected = parsed?.predictions.filter((prediction) => prediction.verdict === "ODRZUCONY").length ?? 0;
  const doubleChance = parsed?.predictions.filter((prediction) => prediction.market === "DOUBLE_CHANCE").length ?? 0;

  const run = useAction(
    async () => {
      if (!parsed) throw new Error("Wklej lub wczytaj poprawny CSV.");
      if (parsed.errors.length) throw new Error("Popraw błędy w wierszach przed importem.");
      if (!source.trim()) throw new Error("Podaj źródło importu.");
      return importScan(parsed, matches, source);
    },
    {
      success: (result) => `Import zakończony: ${result.newMatches} nowych meczów, ${result.reusedMatches} istniejących, ${result.predictions} nowych prognoz.`,
      onDone: () => onOpenChange(false),
    },
  );

  function readFile(file?: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result ?? ""));
    reader.onerror = () => setText("");
    reader.readAsText(file);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto bg-card">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl uppercase">Import skanu CSV</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <p className="text-sm text-muted-foreground">
            Import używa wyłącznie kanonicznych nagłówków. Istniejące mecze i prognozy są pomijane, nigdy nadpisywane.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => downloadFile("moneyball-scan-template.csv", SCAN_TEMPLATE_CSV, "text/csv")}>
              <Download /> Pobierz szablon CSV
            </Button>
            <Button type="button" variant="outline" asChild>
              <label className="cursor-pointer">
                <FileUp /> Wczytaj plik
                <input type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => readFile(event.target.files?.[0])} />
              </label>
            </Button>
          </div>
          <Field label="Źródło skanu">
            <Input value={source} onChange={(event) => setSource(event.target.value)} placeholder="np. FootyNomad" />
          </Field>
          <Field label="Dane CSV">
            <Textarea
              rows={9}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="kickoff_at,competition,country,gender,home_team,away_team,market,selection,probability,odds,confidence,verdict,rationale,model_version,group_name"
              className="font-mono text-xs"
            />
          </Field>
          {parseError && <p className="text-sm text-destructive">{parseError}</p>}
          {parsed && (
            <div className="rounded-lg border border-border p-3 text-sm">
              <div className="font-semibold">Podgląd importu</div>
              <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div><div className="eyebrow">Mecze</div><b className="num">{parsed.matches.length}</b></div>
                <div><div className="eyebrow">Prognozy</div><b className="num">{parsed.predictions.length}</b></div>
                <div><div className="eyebrow">WYBRANY</div><b className="num">{selected}</b></div>
                <div><div className="eyebrow">ODRZUCONY</div><b className="num">{rejected}</b></div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Prognozy Double Chance: {doubleChance}. Wartości poniżej 75% są importowane jako ODRZUCONY, jeśli werdykt nie został podany.</p>
              {parsed.errors.length > 0 && (
                <div className="mt-3 grid gap-1 text-xs text-destructive">
                  {parsed.errors.slice(0, 12).map((error) => <p key={error.row}>Wiersz {error.row}: {error.message}</p>)}
                  {parsed.errors.length > 12 && <p>… i {parsed.errors.length - 12} kolejnych błędów.</p>}
                </div>
              )}
            </div>
          )}
          <p className="text-xs text-muted-foreground">CSV musi zawierać id tylko wtedy, gdy używasz importu kopii tabeli. Ten import skanu tworzy nowe rekordy i pomija duplikaty po meczu/prognozie.</p>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Anuluj</Button>
          <Button onClick={() => run.mutate(undefined)} disabled={!parsed || parsed.errors.length > 0 || run.isPending}>
            {run.isPending ? "Importowanie…" : "Importuj skan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
