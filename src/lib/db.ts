import { requireSupabase } from "./supabase";
import { COLUMNS, OWNER_COLUMN } from "./schema";
import type { TableName, TableRows } from "./types";

interface PgError {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
}

export function humanizeError(e: PgError | null | undefined, table?: string): string {
  if (!e) return "Nieznany błąd.";
  const where = table ? ` (tabela ${table})` : "";
  switch (e.code) {
    case "42P01":
    case "PGRST205":
      return `Tabela nie istnieje lub nie jest dostępna przez API${where}.`;
    case "42703":
    case "PGRST204":
      return `Niezgodność schematu${where}: ${e.message}.`;
    case "42501":
      return `Brak uprawnień${where} (RLS/GRANT). ${e.message ?? ""}`;
    case "23505":
      return `Rekord już istnieje${where}.`;
    case "23503":
      return `Powiązany rekord nie istnieje lub jest używany${where}.`;
    case "23502":
      return `Brak wymaganej wartości${where}: ${e.message}`;
    case "22P02":
      return `Nieprawidłowy format danych${where}: ${e.message}`;
    default:
      return `${e.message ?? "Błąd bazy danych"}${where}`;
  }
}

export function ownerColumn() {
  return OWNER_COLUMN;
}

export async function currentUserId(): Promise<string> {
  const { data, error } = await requireSupabase().auth.getUser();
  if (error || !data.user?.id) throw new Error("Sesja wygasła. Zaloguj się ponownie.");
  return data.user.id;
}

function clean(row: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(row).filter(([, value]) => value !== undefined));
}

/** Only canonical columns are ever sent to PostgREST. */
function whitelist(table: TableName, row: Record<string, unknown>, includeId = false) {
  const allowed = new Set(COLUMNS[table]);
  return Object.fromEntries(
    Object.entries(clean(row)).filter(([key]) =>
      allowed.has(key) && key !== OWNER_COLUMN && (includeId || key !== "id"),
    ),
  );
}

const PAGE = 1000;

export async function fetchAll<K extends TableName>(table: K): Promise<TableRows[K][]> {
  const sb = requireSupabase();
  const uid = await currentUserId();
  const columns = COLUMNS[table].join(",");
  const rows: TableRows[K][] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from(table)
      .select(columns)
      .eq(OWNER_COLUMN, uid)
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(humanizeError(error, table));
    rows.push(...((data ?? []) as TableRows[K][]));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

export async function insertRows<K extends TableName>(
  table: K,
  rows: Record<string, unknown>[],
): Promise<TableRows[K][]> {
  if (rows.length === 0) return [];
  const uid = await currentUserId();
  const payload = rows.map((row) => ({ ...whitelist(table, row), [OWNER_COLUMN]: uid }));
  const { data, error } = await requireSupabase()
    .from(table)
    .insert(payload)
    .select(COLUMNS[table].join(","));
  if (error) throw new Error(humanizeError(error, table));
  return (data ?? []) as TableRows[K][];
}

export async function insertRow<K extends TableName>(table: K, row: Record<string, unknown>) {
  const [inserted] = await insertRows(table, [row]);
  if (!inserted) throw new Error("Zapis nie zwrócił rekordu. Sprawdź uprawnienia (RLS).");
  return inserted;
}

export async function updateRow(table: TableName, id: string, patch: Record<string, unknown>) {
  const uid = await currentUserId();
  const safePatch = whitelist(table, patch);
  const { error } = await requireSupabase()
    .from(table)
    .update(safePatch)
    .eq("id", id)
    .eq(OWNER_COLUMN, uid);
  if (error) throw new Error(humanizeError(error, table));
}

export async function deleteRow(table: TableName, id: string) {
  const uid = await currentUserId();
  const { error } = await requireSupabase()
    .from(table)
    .delete()
    .eq("id", id)
    .eq(OWNER_COLUMN, uid);
  if (error) throw new Error(humanizeError(error, table));
}

/** Restore by id only: existing rows are skipped, never overwritten. */
export async function upsertSkipExisting(table: TableName, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return 0;
  const uid = await currentUserId();
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    if (chunk.some((row) => typeof row.id !== "string" || !row.id))
      throw new Error(`Kopia tabeli ${table} zawiera rekord bez id — import przerwany, aby uniknąć duplikatów.`);
    const ids = chunk.map((row) => String(row.id));
    const { data: existing, error: lookupError } = await requireSupabase()
      .from(table)
      .select("id")
      .eq(OWNER_COLUMN, uid)
      .in("id", ids);
    if (lookupError) throw new Error(humanizeError(lookupError, table));
    const existingIds = new Set((existing ?? []).map((row: { id: string }) => row.id));
    const missing = chunk
      .filter((row) => !existingIds.has(String(row.id)))
      .map((row) => ({ ...whitelist(table, row, true), [OWNER_COLUMN]: uid }));
    if (!missing.length) continue;
    const { error } = await requireSupabase().from(table).insert(missing);
    if (error) throw new Error(humanizeError(error, table));
    inserted += missing.length;
  }
  return inserted;
}
