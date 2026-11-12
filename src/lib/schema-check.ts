import { createClient } from "@supabase/supabase-js";
import { readConfig } from "./config";
import { currentUserId, humanizeError } from "./db";
import { requireSupabase } from "./supabase";
import { COLUMNS, OWNER_COLUMN } from "./schema";
import { TABLES_IN_ORDER, type TableName } from "./types";

export type TableCheck =
  | { table: TableName; status: "ok"; count: number | null }
  | { table: TableName; status: "missing_table"; message: string }
  | { table: TableName; status: "missing_columns"; missing: string[]; count: number | null }
  | { table: TableName; status: "error"; message: string };

export interface SchemaReport {
  checkedAt: string;
  ownerColumn: typeof OWNER_COLUMN;
  tables: TableCheck[];
  warnings: string[];
  anonymousAccess: "blocked" | "no_rows" | "exposed" | "unknown";
}

const isMissingTable = (code?: string) => code === "42P01" || code === "PGRST205";
const isMissingColumn = (code?: string) => code === "42703" || code === "PGRST204";
const isPermissionDenied = (code?: string) => code === "42501" || code === "PGRST301";

async function countOwned(table: TableName, uid: string) {
  const { count, error } = await requireSupabase()
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq(OWNER_COLUMN, uid);
  if (error) throw new Error(humanizeError(error, table));
  return count ?? null;
}

/** Read-only diagnostics. It never generates SQL or changes the database. */
export async function runSchemaCheck(): Promise<SchemaReport> {
  const cfg = readConfig();
  if (!cfg) throw new Error("Najpierw skonfiguruj bezpieczne połączenie z Supabase.");
  const uid = await currentUserId();
  const sb = requireSupabase();
  const tables: TableCheck[] = [];
  const warnings: string[] = [];

  for (const table of TABLES_IN_ORDER) {
    const columns = COLUMNS[table];
    const { error } = await sb
      .from(table)
      .select(columns.join(","))
      .eq(OWNER_COLUMN, uid)
      .limit(1);
    if (!error) {
      tables.push({ table, status: "ok", count: await countOwned(table, uid) });
      continue;
    }
    if (isMissingTable(error.code)) {
      tables.push({ table, status: "missing_table", message: error.message });
      continue;
    }
    if (isMissingColumn(error.code)) {
      const missing: string[] = [];
      for (const column of columns) {
        const probe = await sb.from(table).select(column).eq(OWNER_COLUMN, uid).limit(1);
        if (isMissingColumn(probe.error?.code)) missing.push(column);
      }
      let count: number | null = null;
      try { count = await countOwned(table, uid); } catch { /* count is optional during schema mismatch */ }
      tables.push({ table, status: "missing_columns", missing, count });
      continue;
    }
    tables.push({ table, status: "error", message: `${error.code ?? ""} ${error.message}`.trim() });
  }

  // A separate anonymous client has no user session. Any visible row is a warning.
  let anonymousAccess: SchemaReport["anonymousAccess"] = "unknown";
  try {
    const anon = createClient(cfg.url, cfg.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    let sawRows = false;
    let sawPermissionBlock = false;
    for (const table of TABLES_IN_ORDER) {
      const { data, error } = await anon.from(table).select("id").limit(1);
      if (data?.length) sawRows = true;
      if (isPermissionDenied(error?.code)) sawPermissionBlock = true;
      if (error && !isPermissionDenied(error.code) && !isMissingTable(error.code)) {
        warnings.push(`Nie udało się w pełni sprawdzić dostępu anonimowego dla ${table}: ${error.message}`);
      }
    }
    anonymousAccess = sawRows ? "exposed" : sawPermissionBlock ? "blocked" : "no_rows";
    if (sawRows) warnings.push("Uwaga: klient anonimowy odczytał co najmniej jeden rekord. Sprawdź polityki RLS.");
  } catch {
    anonymousAccess = "unknown";
    warnings.push("Nie udało się zweryfikować dostępu anonimowego.");
  }

  return { checkedAt: new Date().toISOString(), ownerColumn: OWNER_COLUMN, tables, warnings, anonymousAccess };
}
