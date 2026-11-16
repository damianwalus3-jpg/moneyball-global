import { queryOptions, useMutation, useQueryClient, useSuspenseQuery, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { fetchAll, fetchDashboardSelectedPicks, fetchDashboardSummary, fetchCouponFinanceSummary } from "./db";
import type { TableName, TableRows } from "./types";

/** Small live summaries refresh frequently; large table reads use a slower cadence. */
export const LIVE_REFRESH = {
  staleTime: 15_000,
  gcTime: 600_000,
  refetchInterval: 30_000,
  refetchIntervalInBackground: false,
  refetchOnWindowFocus: true,
} as const;

/** Large table reads are cached longer to keep navigation responsive and avoid
 * repeatedly downloading complete tables. Mutations still invalidate them. */
export const TABLE_REFRESH = {
  staleTime: 45_000,
  gcTime: 600_000,
  refetchInterval: 60_000,
  refetchIntervalInBackground: false,
  refetchOnWindowFocus: true,
} as const;

const LIVE_TABLES = new Set<TableName>([
  "matches",
  "match_results",
  "coupons",
  "coupon_legs",
]);

export function tableQuery<K extends TableName>(table: K) {
  const refresh = table === "predictions"
    ? { ...TABLE_REFRESH, staleTime: 120_000, refetchInterval: false as const }
    : LIVE_TABLES.has(table)
      ? LIVE_REFRESH
      : { ...TABLE_REFRESH, staleTime: 120_000, refetchInterval: false as const };
  return queryOptions({
    queryKey: ["table", table] as const,
    queryFn: () => fetchAll(table),
    ...refresh,
  });
}

export function couponFinanceQuery() {
  return queryOptions({
    queryKey: ["coupon-finance-summary"] as const,
    queryFn: fetchCouponFinanceSummary,
    retry: false,
    staleTime: 15_000,
    gcTime: 600_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}

export function dashboardSummaryQuery() {
  return queryOptions({
    queryKey: ["dashboard-summary"] as const,
    queryFn: fetchDashboardSummary,
    retry: false,
    ...LIVE_REFRESH,
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
}

export function dashboardSelectedPicksQuery() {
  return queryOptions({
    queryKey: ["dashboard-selected-picks"] as const,
    queryFn: fetchDashboardSelectedPicks,
    retry: false,
    ...LIVE_REFRESH,
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
}

export function useTable<K extends TableName>(table: K): TableRows[K][] {
  return useSuspenseQuery(tableQuery(table)).data as TableRows[K][];
}

export function ensureTables(qc: QueryClient, tables: TableName[]) {
  return Promise.all(tables.map((t) => qc.ensureQueryData(tableQuery(t))));
}

/** Mutation that toasts errors in Polish and refreshes all table data on success. */
export function useAction<TArgs, TResult = unknown>(
  fn: (args: TArgs) => Promise<TResult>,
  opts: { success?: string | ((r: TResult) => string); onDone?: (r: TResult) => void } = {},
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: async (r) => {
      await Promise.all([qc.invalidateQueries({ queryKey: ["table"] }), qc.invalidateQueries({ queryKey: ["dashboard-summary"] })]);
      const msg = typeof opts.success === "function" ? opts.success(r) : opts.success;
      if (msg) toast.success(msg);
      opts.onDone?.(r);
    },
    onError: async (e: Error) => {
      await qc.invalidateQueries({ queryKey: ["table"] });
      toast.error(e.message);
    },
  });
}
