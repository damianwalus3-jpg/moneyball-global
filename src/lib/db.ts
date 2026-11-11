import { readConfig } from "./config";
import { requireSupabase } from "./supabase";
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
      return `Tabela nie istnieje lub nie jest dostępna przez API${where}. Sprawdź Ustawienia → Diagnostyka.`;
    case "42703":
    case "PGRST204":
      return `Niezgodność schematu${where}: ${e.message}. Sprawdź Ustawienia → Diagnostyka.`;
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
  return readConfig()?.ownerColumn ?? "user_id";
}

export async function currentUserId(): Promise<string> {
  const { data } = await requireSupabase().auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error("Sesja wygasła. Zaloguj się ponownie.");
  return id;
}

function clean(row: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) if (v !== undefined) out[k] = v;
  return out;
}

const PAGE = 1000;

export async function fetchAll<K extends TableName>(table: K): Promise<TableRows[K][]> {
  const sb = requireSupabase();
  const rows: TableRows[K][] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from(table)
      .select("*")
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
  const col = ownerColumn();
  const payload = rows.map((r) => ({ ...clean(r), [col]: uid }));
  const { data, error } = await requireSupabase().from(table).insert(payload).select();
  if (error) throw new Error(humanizeError(error, table));
  return (data ?? []) as TableRows[K][];
}

export async function insertRow<K extends TableName>(table: K, row: Record<string, unknown>) {
  const [r] = await insertRows(table, [row]);
  if (!r) throw new Error("Zapis nie zwrócił rekordu. Sprawdź uprawnienia (RLS).");
  return r;
}

export async function updateRow(table: TableName, id: string, patch: Record<string, unknown>) {
  const { error } = await requireSupabase().from(table).update(clean(patch)).eq("id", id);
  if (error) throw new Error(humanizeError(error, table));
}

export async function deleteRow(table: TableName, id: string) {
  const { error } = await requireSupabase().from(table).delete().eq("id", id);
  if (error) throw new Error(humanizeError(error, table));
}

/** Insert-or-skip by id: never overwrites rows that already exist. */
export async function upsertSkipExisting(table: TableName, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return 0;
  const uid = await currentUserId();
  const col = ownerColumn();
  let n = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500).map((r) => {
      const c = clean(r);
      delete c["user_id"];
      delete c["owner_id"];
      return { ...c, [col]: uid };
    });
    const withId = chunk.filter((r) => r["id"]);
    const withoutId = chunk.filter((r) => !r["id"]);
    if (withId.length) {
      const { error } = await requireSupabase()
        .from(table)
        .upsert(withId, { onConflict: "id", ignoreDuplicates: true });
      if (error) throw new Error(humanizeError(error, table));
    }
    if (withoutId.length) {
      const { error } = await requireSupabase().from(table).insert(withoutId);
      if (error) throw new Error(humanizeError(error, table));
    }
    n += chunk.length;
  }
  return n;
}
