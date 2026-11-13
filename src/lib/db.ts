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

const READ_COLUMNS: Record<TableName, readonly string[]> = {
  ...COLUMNS,
  matches: [...COLUMNS.matches, "league", "kickoff_date"],
};

const PAGE = 1000;

async function fetchRawAll<K extends TableName>(table: K): Promise<TableRows[K][]> {
  const sb = requireSupabase();
  const uid = await currentUserId();
  const columns = READ_COLUMNS[table].join(",");
  const rows: TableRows[K][] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from(table)
      .select(columns)
      .eq(OWNER_COLUMN, uid)
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(humanizeError(error, table));
    rows.push(...((data ?? []) as unknown as TableRows[K][]));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

/** Read adapter for screens still using the previous field names. All writes
 * remain strictly whitelisted to canonical Supabase columns. */
export async function fetchAll<K extends TableName>(table: K): Promise<TableRows[K][]> {
  const rows = await fetchRawAll(table);
  if (table === "scan_runs") {
    const scans = rows as TableRows["scan_runs"][];
    return scans.map((row) => ({ ...row, matches_count: row.matches_found })) as TableRows[K][];
  }
  if (table === "matches") {
    const matches = rows as TableRows["matches"][];
    return matches.map((row) => ({ ...row, competition: row.competition ?? row.league ?? null, league: row.league ?? row.competition ?? null })) as TableRows[K][];
  }
  if (table === "predictions") {
    const predictions = rows as TableRows["predictions"][];
    const matches = await fetchRawAll("matches");
    const scanRunByMatch = new Map(matches.map((match) => [match.id, match.scan_run_id]));
    return predictions.map((row) => ({
      ...row,
      prediction_type: row.market === "DOUBLE_CHANCE" ? "DC" : row.market === "GOALS" ? "GOALS" : "1X2",
      pick: row.selection,
      selection_status: row.verdict,
      result_status: row.settlement_status,
      rejection_reason: row.rationale,
      notes: row.note,
      data_source: row.data_source,
      data_coverage: row.data_coverage ?? null,
      scan_run_id: row.scan_run_id ?? scanRunByMatch.get(row.match_id) ?? null,
      settled_at: null,
    })) as TableRows[K][];
  }
  if (table === "coupon_legs") {
    const legs = rows as TableRows["coupon_legs"][];
    const predictions = await fetchRawAll("predictions");
    const byId = new Map(predictions.map((prediction) => [prediction.id, prediction]));
    return legs.map((leg) => {
      const prediction = byId.get(leg.prediction_id);
      return {
        ...leg,
        // Use the latest prediction price when the leg was saved before odds arrived.
        // This is a read-time fallback; it never fabricates or overwrites stored prices.
        odds: leg.odds ?? prediction?.odds ?? null,
        match_id: prediction?.match_id ?? null,
        prediction_type: prediction?.market === "DOUBLE_CHANCE" ? "DC" : prediction?.market === "GOALS" ? "GOALS" : "1X2",
        pick: prediction?.selection ?? "—",
        probability: prediction?.probability ?? null,
        result_status: leg.status,
      };
    }) as TableRows[K][];
  }
  if (table === "coupons") {
    const coupons = rows as TableRows["coupons"][];
    const [legs, predictions] = await Promise.all([
      fetchRawAll("coupon_legs"),
      fetchRawAll("predictions"),
    ]);
    const byId = new Map(predictions.map((prediction) => [prediction.id, prediction]));
    return coupons.map((coupon) => {
      const couponLegs = legs.filter((leg) => leg.coupon_id === coupon.id);
      const probabilities = couponLegs.map((leg) => byId.get(leg.prediction_id)?.probability ?? null);
      const prices = couponLegs.map((leg) => leg.odds ?? byId.get(leg.prediction_id)?.odds ?? null);
      const validProbability = probabilities.length === coupon.target_legs && probabilities.every((p) => p != null);
      const combinedProbability = validProbability
        ? Math.round(probabilities.reduce((acc, p) => acc * (Number(p) / 100), 1) * 10000) / 100
        : null;
      const validOdds = prices.length === coupon.target_legs && prices.every((price) => price != null && Number(price) > 1);
      const combinedOdds = validOdds
        ? Math.round(prices.reduce((acc, price) => acc * Number(price), 1) * 100) / 100
        : null;
      return {
        ...coupon,
        total_odds: combinedOdds ?? coupon.combined_odds,
        combined_odds: combinedOdds ?? coupon.combined_odds,
        combined_probability: combinedProbability,
      };
    }) as TableRows[K][];
  }
  if (table === "odds_snapshots") {
    const odds = rows as TableRows["odds_snapshots"][];
    const predictions = await fetchRawAll("predictions");
    const byId = new Map(predictions.map((prediction) => [prediction.id, prediction]));
    const grouped = new Map<string, Record<string, unknown>>();
    for (const snapshot of odds) {
      const prediction = snapshot.prediction_id ? byId.get(snapshot.prediction_id) : undefined;
      const matchId = prediction?.match_id ?? null;
      const key = [matchId ?? "unknown", snapshot.bookmaker, snapshot.captured_at].join("|");
      const item = grouped.get(key) ?? { ...snapshot, match_id: matchId, odds_1: null, odds_x: null, odds_2: null };
      if (prediction?.market === "1X2") {
        if (prediction.selection === "1") item["odds_1"] = snapshot.odds;
        if (prediction.selection === "X") item["odds_x"] = snapshot.odds;
        if (prediction.selection === "2") item["odds_2"] = snapshot.odds;
      }
      grouped.set(key, item);
    }
    return [...grouped.values()] as unknown as TableRows[K][];
  }
  if (table === "match_results") {
    const results = rows as TableRows["match_results"][];
    return results.map((row) => ({
      ...row,
      home_goals: row.home_score,
      away_goals: row.away_score,
      settled_at: row.finished_at,
    })) as TableRows[K][];
  }
  if (table === "bankroll_transactions") {
    const transactions = rows as TableRows["bankroll_transactions"][];
    return transactions.map((row) => ({
      ...row,
      type: row.transaction_type === "return" ? "payout" : row.transaction_type,
    })) as TableRows[K][];
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
  return (data ?? []) as unknown as TableRows[K][];
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
    if (chunk.some((row) => typeof row["id"] !== "string" || !row["id"]))
      throw new Error(`Kopia tabeli ${table} zawiera rekord bez id — import przerwany, aby uniknąć duplikatów.`);
    const ids = chunk.map((row) => String(row["id"]));
    const { data: existing, error: lookupError } = await requireSupabase()
      .from(table)
      .select("id")
      .eq(OWNER_COLUMN, uid)
      .in("id", ids);
    if (lookupError) throw new Error(humanizeError(lookupError, table));
    const existingIds = new Set((existing ?? []).map((row: { id: string }) => row.id));
    const missing = chunk
      .filter((row) => !existingIds.has(String(row["id"])))
      .map((row) => ({ ...whitelist(table, row, true), [OWNER_COLUMN]: uid }));
    if (!missing.length) continue;
    const { error } = await requireSupabase().from(table).insert(missing);
    if (error) throw new Error(humanizeError(error, table));
    inserted += missing.length;
  }
  return inserted;
}
