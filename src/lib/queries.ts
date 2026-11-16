import { queryOptions, useMutation, useQueryClient, useSuspenseQuery, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { fetchAll, fetchDashboardSelectedPicks, fetchDashboardSummary, fetchCouponFinanceSummary } from "./db";
import type { TableName } from "./types";

/** Read-only refresh: results are synced by the backend, the browser only re-reads them. */
export const LIVE_REFRESH = {
  staleTime: 15_000,
  gcTime: 600_000,
  refetchInterval: 120_000,
  refetchIntervalInBackground: false,
  refetchOnWindowFocus: true,
} as const;

export function tableQuery<K extends TableName>(table: K) {
  return queryOptions({
    queryKey: ["table", table] as const,
    queryFn: () => fetchAll(table),
    ...LIVE_REFRESH,
  });
}


export function couponFinanceQuery() {\n  return queryOptions({\n    queryKey: ["coupon-finance-summary"] as const,\n    queryFn: fetchCouponFinanceSummary,\n    retry: false,\n    staleTime: 60_000,\n    gcTime: 600_000,\n    refetchInterval: 60_000,\n    refetchIntervalInBackground: false,\n    refetchOnWindowFocus: true,\n  });\n}\n\nexport function dashboardSummaryQuery() {
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

export function useTable<K extends TableName>(table: K) {
  return useSuspenseQuery(tableQuery(table)).data;
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
