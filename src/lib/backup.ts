import Papa from "papaparse";
import { fetchAll, upsertSkipExisting } from "./db";
import { TABLES_IN_ORDER, type TableName } from "./types";

export const BACKUP_FORMAT = "moneyball-global-2.0-backup";

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: 1;
  exported_at: string;
  tables: Partial<Record<TableName, Record<string, unknown>[]>>;
}

export async function buildBackup(): Promise<Backup> {
  const tables: Backup["tables"] = {};
  for (const t of TABLES_IN_ORDER) tables[t] = (await fetchAll(t)) as unknown as Record<string, unknown>[];
  return { format: BACKUP_FORMAT, version: 1, exported_at: new Date().toISOString(), tables };
}

export function toCsv(rows: Record<string, unknown>[]): string {
  return Papa.unparse(rows, { quotes: false });
}

export function parseCsv(text: string): Record<string, unknown>[] {
  const res = Papa.parse<Record<string, string>>(text.trim(), { header: true, skipEmptyLines: true });
  const firstErr = res.errors[0];
  if (firstErr) throw new Error(`Błąd CSV (wiersz ${(firstErr.row ?? 0) + 2}): ${firstErr.message}`);
  return res.data.map((r) => {
    const o: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r)) o[k.trim()] = v === "" ? null : v;
    return o;
  });
}

export function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function stamp() {
  return new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
}

/** Restores a backup in FK order. Existing rows (same id) are skipped, never overwritten. */
export async function restoreBackup(data: unknown): Promise<Record<string, number>> {
  const b = data as Backup;
  if (!b || b.format !== BACKUP_FORMAT || !b.tables) throw new Error("To nie jest kopia zapasowa MONEYBALL GLOBAL 2.0.");
  const counts: Record<string, number> = {};
  for (const t of TABLES_IN_ORDER) {
    const rows = b.tables[t];
    if (Array.isArray(rows) && rows.length) counts[t] = await upsertSkipExisting(t, rows);
  }
  return counts;
}

export async function importTableCsv(table: TableName, text: string) {
  return upsertSkipExisting(table, parseCsv(text));
}
