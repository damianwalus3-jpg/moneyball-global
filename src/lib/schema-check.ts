import { readConfig } from "./config";
import { requireSupabase } from "./supabase";
import { expectedColumns } from "./schema";
import { TABLES_IN_ORDER, type TableName } from "./types";

export type TableCheck =
  | { table: TableName; status: "ok"; count: number | null }
  | { table: TableName; status: "missing_table"; message: string }
  | { table: TableName; status: "missing_columns"; missing: string[]; count: number | null }
  | { table: TableName; status: "error"; message: string };

export interface SchemaReport {
  checkedAt: string;
  ownerColumn: string;
  detectedOwnerColumn: "user_id" | "owner_id" | null;
  tables: TableCheck[];
  warnings: string[];
}

const isMissingTable = (code?: string) => code === "42P01" || code === "PGRST205";
const isMissingColumn = (code?: string) => code === "42703" || code === "PGRST204";

async function columnExists(table: string, col: string) {
  const { error } = await requireSupabase().from(table).select(col).limit(1);
  if (!error) return true;
  if (isMissingColumn(error.code)) return false;
  throw new Error(error.message);
}

/** Read-only check of every expected table/column against the live database. */
export async function runSchemaCheck(): Promise<SchemaReport> {
  const sb = requireSupabase();
  const owner = readConfig()?.ownerColumn ?? "user_id";
  const tables: TableCheck[] = [];
  const warnings: string[] = [];

  let detected: SchemaReport["detectedOwnerColumn"] = null;
  try {
    if (await columnExists("matches", "user_id")) detected = "user_id";
    else if (await columnExists("matches", "owner_id")) detected = "owner_id";
  } catch {
    detected = null;
  }
  if (detected && detected !== owner)
    warnings.push(
      `Tabele używają kolumny właściciela "${detected}", a aplikacja jest ustawiona na "${owner}". Zmień ustawienie poniżej.`,
    );

  for (const table of TABLES_IN_ORDER) {
    const cols = expectedColumns(table, owner);
    const { error } = await sb.from(table).select(cols.join(",")).limit(1);
    let count: number | null = null;
    if (!error || isMissingColumn(error.code)) {
      const c = await sb.from(table).select("id", { count: "exact", head: true });
      count = c.count ?? null;
    }
    if (!error) {
      tables.push({ table, status: "ok", count });
      continue;
    }
    if (isMissingTable(error.code)) {
      tables.push({ table, status: "missing_table", message: error.message });
      continue;
    }
    if (isMissingColumn(error.code)) {
      const missing: string[] = [];
      for (const col of cols) {
        try {
          if (!(await columnExists(table, col))) missing.push(col);
        } catch {
          /* ignore individual failures */
        }
      }
      tables.push({ table, status: "missing_columns", missing, count });
      continue;
    }
    tables.push({ table, status: "error", message: `${error.code ?? ""} ${error.message}`.trim() });
  }

  // Probability scale sanity check (app stores 0–100).
  try {
    const { data } = await sb.from("predictions").select("probability").not("probability", "is", null).limit(200);
    const vals = (data ?? []).map((r: { probability: number }) => Number(r.probability));
    if (vals.length > 0 && vals.every((v) => v <= 1))
      warnings.push(
        "Wszystkie zapisane prawdopodobieństwa są ≤ 1 — wygląda na skalę 0–1. Aplikacja używa skali 0–100 (%).",
      );
  } catch {
    /* table may be missing; reported above */
  }

  return { checkedAt: new Date().toISOString(), ownerColumn: owner, detectedOwnerColumn: detected, tables, warnings };
}
