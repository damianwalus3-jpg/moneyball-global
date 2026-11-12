import { createFileRoute, Link } from "@tanstack/react-router";
import { Database, Download, Smartphone, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, PageHeader } from "@/components/app/ui-bits";
import { buildBackup, downloadFile, importTableCsv, restoreBackup, stamp, toCsv } from "@/lib/backup";
import { maskKey, readConfig, readPrefs, savePrefs } from "@/lib/config";
import { fetchAll } from "@/lib/db";
import { canInstall, isStandalone, promptInstall, subscribeInstall } from "@/lib/install";
import { useAction } from "@/lib/queries";
import { runSchemaCheck, type SchemaReport } from "@/lib/schema-check";
import { TABLE_LABELS, TABLES_IN_ORDER, type TableName } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/ustawienia")({
  head: () => ({
    meta: [
      { title: "Ustawienia — MONEYBALL GLOBAL 2.0" },
      { name: "description", content: "Połączenie z bazą, diagnostyka schematu, kopia zapasowa i import/eksport CSV/JSON." },
      { property: "og:title", content: "Ustawienia — MONEYBALL GLOBAL 2.0" },
      { property: "og:description", content: "Diagnostyka, kopia zapasowa i import/eksport." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Ustawienia,
});

function Ustawienia() {
  const [cfg, setCfg] = useState<ReturnType<typeof readConfig>>(null);
  const [currency, setCurrency] = useState("");
  const [report, setReport] = useState<SchemaReport | null>(null);
  const [checking, setChecking] = useState(false);
  const [installable, setInstallable] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [csvTable, setCsvTable] = useState<TableName>("matches");

  useEffect(() => {
    setCfg(readConfig());
    setCurrency(readPrefs().currency);
    setStandalone(isStandalone());
    setInstallable(canInstall());
    return subscribeInstall(() => setInstallable(canInstall()));
  }, []);

  async function check() {
    setChecking(true);
    try {
      setReport(await runSchemaCheck());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Błąd diagnostyki");
    } finally {
      setChecking(false);
    }
  }

  const restore = useAction(async (file: File) => restoreBackup(JSON.parse(await file.text())), {
    success: (c) => `Przywrócono (pominięto istniejące): ${Object.entries(c).map(([k, v]) => `${k} ${v}`).join(", ") || "0"}`,
  });
  const importCsv = useAction(async (file: File) => importTableCsv(csvTable, await file.text()), {
    success: (n) => `Zaimportowano ${n} wierszy do ${TABLE_LABELS[csvTable]}`,
  });


  return (
    <div className="grid gap-6">
      <PageHeader title="Ustawienia" eyebrow="Połączenie · dane · aplikacja" />

      <section className="surface-card grid gap-3 p-4">
        <h2 className="text-xl font-semibold uppercase">Połączenie z bazą</h2>
        <div className="text-sm text-muted-foreground">
          <div>Adres: <span className="num">{cfg?.url ?? "—"}</span></div>
          <div>Klucz publiczny: <span className="num">{cfg ? maskKey(cfg.anonKey) : "—"}</span> ({cfg?.source === "env" ? "zmienna środowiskowa" : "to urządzenie"})</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild><Link to="/setup">Zmień klucz</Link></Button>
        </div>
        <Field label="Waluta (wyświetlanie)" hint="Tylko etykieta, np. PLN lub EUR.">
          <Input className="max-w-40" value={currency} onChange={(e) => { setCurrency(e.target.value); savePrefs({ currency: e.target.value.trim() }); }} />
        </Field>
      </section>

      <section className="surface-card grid gap-3 p-4">
        <h2 className="text-xl font-semibold uppercase">Diagnostyka schematu</h2>
        <p className="text-sm text-muted-foreground">Tylko odczyt: sprawdza 8 tabel, kanoniczne kolumny, liczbę Twoich rekordów i dostęp anonimowy. Nie generuje SQL i niczego nie zmienia w bazie.</p>
        <Button className="w-fit" onClick={check} disabled={checking}><Database /> {checking ? "Sprawdzanie…" : "Sprawdź tabele"}</Button>
        {report && (
          <div className="grid gap-1 text-sm">
            <div className="rounded-lg border border-border p-3">
              <div>Kolumna właściciela: <b className="num">owner_id</b></div>
              <div>Dostęp anonimowy: <b>{report.anonymousAccess}</b></div>
            </div>
            {report.warnings.map((w) => <p key={w} className="text-warning">{w}</p>)}
            {report.tables.map((t) => (
              <div key={t.table} className="flex justify-between gap-2 border-b border-border py-1">
                <span className="num">{t.table}</span>
                <span className={t.status === "ok" ? "text-success" : "text-destructive"}>
                  {t.status === "ok" ? `OK · ${t.count ?? "?"} wierszy` : t.status === "missing_table" ? "brak tabeli" : t.status === "missing_columns" ? `brak kolumn: ${t.missing.join(", ")}` : t.message}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="surface-card grid gap-3 p-4">
        <h2 className="text-xl font-semibold uppercase">Kopia zapasowa i import/eksport</h2>
        <div className="flex flex-wrap gap-2">
          <Button onClick={async () => { try { downloadFile(`moneyball-backup-${stamp()}.json`, JSON.stringify(await buildBackup(), null, 2), "application/json"); } catch (e) { toast.error((e as Error).message); } }}>
            <Download /> Pełna kopia JSON
          </Button>
          <FileButton label="Przywróć z JSON" accept=".json,application/json" onFile={(f) => restore.mutate(f)} />
        </div>
        <p className="text-xs text-muted-foreground">Przywracanie pomija rekordy, które już istnieją — nigdy ich nie nadpisuje.</p>
        <div className="flex flex-wrap items-center gap-2">
          <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={csvTable} onChange={(e) => setCsvTable(e.target.value as TableName)}>
            {TABLES_IN_ORDER.map((t) => <option key={t} value={t}>{TABLE_LABELS[t]}</option>)}
          </select>
          <Button variant="outline" onClick={async () => { try { downloadFile(`${csvTable}-${stamp()}.csv`, toCsv((await fetchAll(csvTable)) as unknown as Record<string, unknown>[]), "text/csv"); } catch (e) { toast.error((e as Error).message); } }}>
            <Download /> Eksport CSV
          </Button>
          <FileButton label="Import CSV" accept=".csv,text/csv" onFile={(f) => importCsv.mutate(f)} />
        </div>
      </section>

      <section className="surface-card grid gap-3 p-4">
        <h2 className="text-xl font-semibold uppercase">Aplikacja na telefonie</h2>
        {standalone ? (
          <p className="text-sm text-muted-foreground">Aplikacja działa z ekranu głównego.</p>
        ) : installable ? (
          <Button className="w-fit" onClick={() => promptInstall()}><Smartphone /> Dodaj do ekranu głównego</Button>
        ) : (
          <p className="text-sm text-muted-foreground">Android (Chrome): menu ⋮ → „Dodaj do ekranu głównego” / „Zainstaluj aplikację”.</p>
        )}
      </section>
    </div>
  );
}

function FileButton({ label, accept, onFile }: { label: string; accept: string; onFile: (f: File) => void }) {
  return (
    <Button variant="outline" asChild>
      <label className="cursor-pointer">
        <Upload /> {label}
        <input type="file" accept={accept} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
      </label>
    </Button>
  );
}
