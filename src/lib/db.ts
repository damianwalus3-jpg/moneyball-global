import { requireSupabase } from "./supabase";
import { COLUMNS, OWNER_COLUMN } from "./schema";
import type { TableName, TableRows } from "./types";

export interface DashboardMarketStats {
  won: number;
  settled: number;
  rate: number | null;
}
export interface DashboardSummary {
  matches_today: number;
  bankroll: number | null;
  coupons_in_play: number;
  candidates: number;
  to_settle: number;
  hit_rates: Partial<Record<"1X2" | "DOUBLE_CHANCE" | "GOALS", DashboardMarketStats>>;
}

function withRequestTimeout<T>(request: PromiseLike<T>, label: string, ms = 10_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(label + ": brak odpowiedzi serwera po " + Math.round(ms / 1000) + " s. Sprawdź połączenie z bazą i spróbuj ponownie.")), ms);
    Promise.resolve(request).then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

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

let cachedCurrentUserId: string | null = null;
let cachedCurrentUserExpiresAt = 0;
let currentUserIdRequest: Promise<string> | null = null;
let authListenerClient: ReturnType<typeof requireSupabase> | null = null;

export async function currentUserId(): Promise<string> {
  const sb = requireSupabase();
  // All table reads start together. Reuse one verified identity lookup instead
  // of sending a separate auth.getUser() request for every table.
  if (authListenerClient !== sb) {
    authListenerClient = sb;
    sb.auth.onAuthStateChange(() => {
      cachedCurrentUserId = null;
      cachedCurrentUserExpiresAt = 0;
      currentUserIdRequest = null;
      rawTableCache.clear();
    });
  }
  if (cachedCurrentUserId && cachedCurrentUserExpiresAt > Date.now()) {
    return cachedCurrentUserId;
  }
  if (currentUserIdRequest) return currentUserIdRequest;

  const request = withRequestTimeout(sb.auth.getUser(), "Weryfikacja sesji", 8_000)
    .then(({ data, error }) => {
      if (error || !data.user?.id) throw new Error("Sesja wygasła. Zaloguj się ponownie.");
      cachedCurrentUserId = data.user.id;
      // Short cache only: session changes are also handled by onAuthStateChange.
      cachedCurrentUserExpiresAt = Date.now() + 15_000;
      return data.user.id;
    })
    .finally(() => {
      if (currentUserIdRequest === request) currentUserIdRequest = null;
    });
  currentUserIdRequest = request;
  return request;
}

export async function fetchLatestScanRun(): Promise<TableRows["scan_runs"] | null> {
  const uid = await currentUserId();
  const { data, error } = await withRequestTimeout(
    requireSupabase()
      .from("scan_runs")
      .select(READ_COLUMNS.scan_runs.join(","))
      .eq(OWNER_COLUMN, uid)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    "Pobieranie ostatniego skanu",
  );
  if (error) throw new Error(humanizeError(error, "scan_runs"));
  return (data ?? null) as TableRows["scan_runs"] | null;
}

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  const { data, error } = await withRequestTimeout(requireSupabase().rpc("moneyball_dashboard_summary"), "Pobieranie podsumowania panelu");
  if (error) throw new Error(humanizeError(error));
  return data as DashboardSummary;
}


export interface CouponFinanceRow {
  id: string;
  name: string;
  coupon_type: string;
  status: "won" | "lost" | "void";
  stake: number | null;
  odds: number | null;
  settled_at: string;
  payout: number | null;
  net: number | null;
}
export interface CouponFinancePeriod {
  count: number;
  stake: number;
  payout: number;
  net: number | null;
  incomplete: number;
}
export interface CouponFinanceTypePeriod extends CouponFinancePeriod {
  won: number;
  lost: number;
  void: number;
}
export interface CouponFinanceSummary {
  day: CouponFinancePeriod;
  week: CouponFinancePeriod;
  month: CouponFinancePeriod;
  all: CouponFinancePeriod;
  by_type: Record<string, CouponFinanceTypePeriod>;
  history: CouponFinanceRow[];
}
export async function fetchCouponFinanceSummary(): Promise<CouponFinanceSummary> {
  const { data, error } = await withRequestTimeout(
    requireSupabase().rpc("moneyball_coupon_finance_summary"),
    "Pobieranie historii finansowej kuponów",
  );
  if (error) throw new Error(humanizeError(error));
  return data as CouponFinanceSummary;
}

export interface DashboardSelectedPick {
  prediction_id: string;
  market: string;
  selection: string;
  probability: number | null;
  odds: number | null;
  settlement_status: string;
  match_id: string;
  home_team: string;
  away_team: string;
  competition: string | null;
  league: string | null;
  kickoff_at: string | null;
  kickoff_date: string | null;
  match_status: string;
  home_score: number | null;
  away_score: number | null;
  rationale: string | null;
  confidence: string | null;
  data_coverage: Record<string, unknown> | null;
}

/** Small, date-scoped dashboard read; never downloads the user's full prediction history. */
export async function fetchDashboardSelectedPicks(): Promise<DashboardSelectedPick[]> {
  const { data, error } = await withRequestTimeout(requireSupabase().rpc("moneyball_dashboard_selected_picks"), "Pobieranie wybranych typów");
  if (error) throw new Error(humanizeError(error));
  return (data ?? []) as DashboardSelectedPick[];
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

// Supabase's default PostgREST row cap is 1,000. Use keyset pagination
// (id > lastId) rather than OFFSET: deep offsets on the 18k-row predictions
// table were hitting PostgreSQL statement_timeout during navigation.
const PAGE = 250;
const RAW_CACHE_MS = 120_000;
const inFlightTableReads = new Map<string, Promise<unknown>>();
const rawTableCache = new Map<string, { expiresAt: number; rows: unknown[] }>();

async function fetchRawAllUncached<K extends TableName>(table: K, uid: string): Promise<TableRows[K][]> {
  const sb = requireSupabase();
  const columns = READ_COLUMNS[table].join(",");
  const rows: TableRows[K][] = [];
  // Large operational tables are split into four disjoint UUID ranges.
  // Each range uses keyset pagination, so requests can run concurrently without
  // expensive OFFSET scans or skipped/duplicated rows.
  const ranges: { lower: string; upper?: string }[] =
    table === "predictions" || table === "matches"
      ? [
          { lower: "00000000-0000-0000-0000-000000000000", upper: "40000000-0000-0000-0000-000000000000" },
          { lower: "40000000-0000-0000-0000-000000000000", upper: "80000000-0000-0000-0000-000000000000" },
          { lower: "80000000-0000-0000-0000-000000000000", upper: "c0000000-0000-0000-0000-000000000000" },
          { lower: "c0000000-0000-0000-0000-000000000000" },
        ]
      : [{ lower: "00000000-0000-0000-0000-000000000000" }];

  const readRange = async (range: { lower: string; upper?: string }) => {
    const rangeRows: TableRows[K][] = [];
    let lastId: string | null = null;
    for (;;) {
      // Start with a small indexed page. If Postgres still cancels a statement
      // under load, retry the exact same cursor with a smaller page; never skip
      // or duplicate rows and never restart the entire history download.
      let pageSize = PAGE;
      let pageRows: TableRows[K][] | null = null;
      for (;;) {
        let query = sb
          .from(table)
          .select(columns)
          .eq(OWNER_COLUMN, uid)
          .gte("id", range.lower)
          .order("id", { ascending: true })
          .limit(pageSize);
        if (range.upper) query = query.lt("id", range.upper);
        if (lastId) query = query.gt("id", lastId);
        const result = await query;
        if (!result.error) {
          pageRows = (result.data ?? []) as unknown as TableRows[K][];
          break;
        }
        const timedOut =
          result.error.code === "57014" ||
          /statement timeout|canceling statement/i.test(result.error.message ?? "");
        if (!timedOut || pageSize <= 50) {
          throw new Error(humanizeError(result.error, table));
        }
        pageSize = Math.max(50, Math.floor(pageSize / 2));
      }
      if (!pageRows) throw new Error("Pobieranie tabeli " + table + " nie zwróciło strony danych.");
      rangeRows.push(...pageRows);
      if (pageRows.length < pageSize) break;
      const nextId = (pageRows[pageRows.length - 1] as { id?: unknown })?.id;
      if (typeof nextId !== "string" || nextId === lastId) {
        throw new Error("Nie udało się bezpiecznie stronicować tabeli " + table + " po identyfikatorze.");
      }
      lastId = nextId;
    }
    return rangeRows;
  };
  // Keep database concurrency bounded. Four simultaneous large-table scans
  // previously competed for Postgres resources and caused statement timeouts.
  const partitions: TableRows[K][][] = [];
  for (let i = 0; i < ranges.length; i += 2) {
    partitions.push(...(await Promise.all(ranges.slice(i, i + 2).map(readRange))));
  }
  for (const partition of partitions) rows.push(...partition);
  rows.sort((a, b) => String((a as { id: string }).id).localeCompare(String((b as { id: string }).id)));
  return rows;
}

/** Fetch only predictions referenced by a set of rows; avoids downloading the full history for joins. */
async function fetchPredictionsByIds(ids: (string | null | undefined)[]): Promise<TableRows["predictions"][]> {
  const uniqueIds = [...new Set(ids.filter((id): id is string => typeof id === "string" && id.length > 0))];
  if (uniqueIds.length === 0) return [];
  const uid = await currentUserId();
  const sb = requireSupabase();
  const rows: TableRows["predictions"][] = [];
  // Keep IN lists modest and owner-scoped; this is a lookup for referenced IDs, not a history scan.
  for (let index = 0; index < uniqueIds.length; index += 100) {
    const chunk = uniqueIds.slice(index, index + 100);
    const { data, error } = await withRequestTimeout(
      sb.from("predictions").select(READ_COLUMNS.predictions.join(",")).eq(OWNER_COLUMN, uid).in("id", chunk),
      "Pobieranie powiązanych prognoz",
    );
    if (error) throw new Error(humanizeError(error, "predictions"));
    rows.push(...((data ?? []) as unknown as TableRows["predictions"][]));
  }
  return rows;
}

async function fetchRawAll<K extends TableName>(table: K): Promise<TableRows[K][]> {
  const uid = await currentUserId();
  const key = `${uid}:${table}`;
  const cached = rawTableCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.rows as TableRows[K][];
  const existing = inFlightTableReads.get(key);
  if (existing) return existing as Promise<TableRows[K][]>;
  const request = fetchRawAllUncached(table, uid).then((rows) => {
    rawTableCache.set(key, { rows, expiresAt: Date.now() + RAW_CACHE_MS });
    return rows;
  });
  inFlightTableReads.set(key, request);
  try {
    return await request;
  } finally {
    if (inFlightTableReads.get(key) === request) inFlightTableReads.delete(key);
  }
}

function invalidateRawTableCache(table?: TableName) {
  if (!table) { rawTableCache.clear(); return; }
  for (const key of rawTableCache.keys()) if (key.endsWith(":" + table)) rawTableCache.delete(key);
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
      scan_run_id: row.scan_run_id ?? null,
      settled_at: null,
    })) as TableRows[K][];
  }
  if (table === "coupon_legs") {
    const legs = rows as TableRows["coupon_legs"][];
    const predictions = await fetchPredictionsByIds(legs.map((leg) => leg.prediction_id));
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
    const legs = await fetchRawAll("coupon_legs");
    const predictions = await fetchPredictionsByIds(legs.map((leg) => leg.prediction_id));
    const byId = new Map(predictions.map((prediction) => [prediction.id, prediction]));
    // Group once instead of scanning every coupon leg for every coupon (O(n²)).
    const legsByCoupon = new Map<string, typeof legs>();
    for (const leg of legs) {
      const group = legsByCoupon.get(leg.coupon_id);
      if (group) group.push(leg);
      else legsByCoupon.set(leg.coupon_id, [leg]);
    }
    return coupons.map((coupon) => {
      const couponLegs = legsByCoupon.get(coupon.id) ?? [];
      const probabilities = couponLegs.map((leg) => byId.get(leg.prediction_id)?.probability ?? null);
      const prices = couponLegs.map((leg) => leg.odds ?? byId.get(leg.prediction_id)?.odds ?? null);
      const validProbability = probabilities.length === coupon.target_legs && probabilities.every((p) => p != null);
      const combinedProbability = validProbability
        ? Math.round(probabilities.reduce<number>((acc, p) => acc * (Number(p) / 100), 1) * 10000) / 100
        : null;
      const validOdds = prices.length === coupon.target_legs && prices.every((price) => price != null && Number(price) > 1);
      const combinedOdds = validOdds
        ? Math.round(prices.reduce<number>((acc, price) => acc * Number(price), 1) * 100) / 100
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
    const predictions = await fetchPredictionsByIds(odds.map((snapshot) => snapshot.prediction_id));
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
  invalidateRawTableCache(table);
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
  invalidateRawTableCache(table);
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
