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

/** Validate the complete payload before the first database write. */
export function validateBackup(data: unknown): { backup: Backup; counts: Partial<Record<TableName, number>> } {
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new Error("Nieprawidłowy format kopii zapasowej.");
  const candidate = data as Partial<Backup>;
  if (candidate.format !== BACKUP_FORMAT || candidate.version !== 1 || !candidate.tables ||
      typeof candidate.tables !== "object" || Array.isArray(candidate.tables))
    throw new Error("To nie jest obsługiwana kopia zapasowa MONEYBALL GLOBAL 2.0.");

  const allowed = new Set<string>(TABLES_IN_ORDER);
  const counts: Partial<Record<TableName, number>> = {};
  for (const [tableName, rows] of Object.entries(candidate.tables)) {
    if (!allowed.has(tableName))
      throw new Error(`Kopia zawiera nieobsługiwaną tabelę: ${tableName}.`);
    if (!Array.isArray(rows))
      throw new Error(`Dane tabeli ${tableName} muszą być listą rekordów.`);
    const ids = new Set<string>();
    for (const [index, row] of rows.entries()) {
      if (!row || typeof row !== "object" || Array.isArray(row) ||
          typeof (row as Record<string, unknown>).id !== "string" ||
          !(row as Record<string, unknown>).id || !(row as Record<string, unknown>).id?.toString().trim()) {
        throw new Error(`Nieprawidłowy rekord ${index + 1} w tabeli ${tableName}: wymagane jest id.`);
      }
      const id = String((row as Record<string, unknown>).id);
      if (ids.has(id)) throw new Error(`Powtórzone id ${id} w tabeli ${tableName}.`);
      ids.add(id);
    }
    counts[tableName as TableName] = rows.length;
  }
  return { backup: candidate as Backup, counts };
}

/** Restores a backup in FK order. Existing rows (same id) are skipped, never overwritten. */
export async function restoreBackup(data: unknown): Promise<Record<string, number>> {
  const { backup: b } = validateBackup(data);
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
