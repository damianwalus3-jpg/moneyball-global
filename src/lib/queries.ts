import { infiniteQueryOptions, queryOptions, useMutation, useQueryClient, useSuspenseQuery, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { fetchAll, fetchDashboardSelectedPicks, fetchDashboardSummary, fetchCouponFinanceSummary, fetchLatestScanRun, fetchCouponPageData, fetchMatchPageData, fetchMatchesByIds, fetchCouponLegsByPredictionIds, fetchResultsPage, fetchHistoryPage, fetchStatisticsPageData, fetchTrackerCategories, fetchJackpotEntries, fetchTrackerCategorySummary } from "./db";
import type { HistoryPageCursor, ResultsPageCursor } from "./db";
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

type TableRefreshPolicy = {
  staleTime: number;
  gcTime: number;
  refetchInterval: number;
  refetchIntervalInBackground: boolean;
  refetchOnWindowFocus: boolean;
};

const TABLE_REFRESH_BY_NAME: Partial<Record<TableName, TableRefreshPolicy>> = {
  // Fixtures are expensive to refresh and the user requires a 15-minute cadence.
  // Dashboard summaries remain on LIVE_REFRESH and are intentionally separate.
  matches: {
    ...TABLE_REFRESH,
    staleTime: 60_000,
    refetchInterval: 15 * 60_000,
  },
  // Results should settle promptly without polling every full table every 30 seconds.
  match_results: {
    ...TABLE_REFRESH,
    staleTime: 30_000,
    refetchInterval: 5 * 60_000,
  },
  coupons: {
    ...TABLE_REFRESH,
    staleTime: 30_000,
    refetchInterval: 60_000,
  },
  coupon_legs: {
    ...TABLE_REFRESH,
    staleTime: 30_000,
    refetchInterval: 60_000,
  },
};

export function tableQuery<K extends TableName>(table: K) {
  const refresh = TABLE_REFRESH_BY_NAME[table]
    ?? (table === "predictions"
      ? { ...TABLE_REFRESH, staleTime: 120_000, refetchInterval: false as const }
      : { ...TABLE_REFRESH, staleTime: 120_000, refetchInterval: false as const });
  return queryOptions({
    queryKey: ["table", table] as const,
    queryFn: () => fetchAll(table),
    ...refresh,
  });
}

export function predictionCouponLegsQuery(predictionIds: string[]) {
  const ids = [...new Set(predictionIds.filter(Boolean))].sort();
  return queryOptions({
    queryKey: ["prediction-coupon-legs", ids] as const,
    queryFn: () => fetchCouponLegsByPredictionIds(ids),
    enabled: ids.length > 0,
    staleTime: 60_000,
    gcTime: 600_000,
    refetchInterval: false,
  });
}

export function predictionMatchesQuery(matchIds: string[]) {
  const ids = [...new Set(matchIds.filter(Boolean))].sort();
  return queryOptions({
    queryKey: ["prediction-matches", ids] as const,
    queryFn: () => fetchMatchesByIds(ids),
    enabled: ids.length > 0,
    staleTime: 120_000,
    gcTime: 600_000,
    refetchInterval: false,
  });
}

export function statisticsPageDataQuery() {
  return queryOptions({
    queryKey: ["statistics-page-data"] as const,
    queryFn: fetchStatisticsPageData,
    retry: false,
    staleTime: 60_000,
    gcTime: 600_000,
    refetchInterval: false,
  });
}

export function useStatisticsPageData() {
  return useSuspenseQuery(statisticsPageDataQuery()).data;
}

export function historyPagesQuery(filters: {
  tab: "todo" | "done";
  search: string;
}) {
  return infiniteQueryOptions({
    queryKey: ["history-pages", filters.tab, filters.search] as const,
    queryFn: ({ pageParam }) => fetchHistoryPage({
      tab: filters.tab,
      search: filters.search,
      cursor: pageParam,
    }),
    initialPageParam: null as HistoryPageCursor | null,
    getNextPageParam: (lastPage) => lastPage.has_more ? lastPage.next_cursor ?? undefined : undefined,
    staleTime: 120_000,
    gcTime: 60_000,
    refetchInterval: (query) => (query.state.data?.pages.length ?? 0) > 1 ? false : 5 * 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

export function resultsPagesQuery(filters: {
  filter: "all" | "final" | "rejected" | "jackpot";
  search: string;
}) {
  return infiniteQueryOptions({
    queryKey: ["results-pages", filters.filter, filters.search] as const,
    queryFn: ({ pageParam }) => fetchResultsPage({
      filter: filters.filter,
      search: filters.search,
      cursor: pageParam,
    }),
    initialPageParam: null as ResultsPageCursor | null,
    getNextPageParam: (lastPage) => lastPage.has_more ? lastPage.next_cursor ?? undefined : undefined,
    staleTime: 30_000,
    gcTime: 600_000,
    refetchInterval: 5 * 60_000,
    refetchIntervalInBackground: false,
  });
}

export function matchPageDataQuery() {
  return queryOptions({
    queryKey: ["match-page-data"] as const,
    queryFn: fetchMatchPageData,
    retry: false,
    staleTime: 30_000,
    gcTime: 600_000,
    refetchInterval: 5 * 60_000,
    refetchIntervalInBackground: false,
  });
}

export function couponPageDataQuery() {
  return queryOptions({
    queryKey: ["coupon-page-data"] as const,
    queryFn: fetchCouponPageData,
    retry: false,
    staleTime: 30_000,
    gcTime: 600_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
}

export function latestScanRunQuery() {
  return queryOptions({
    queryKey: ["latest-scan-run"] as const,
    queryFn: fetchLatestScanRun,
    retry: false,
    staleTime: 60_000,
    gcTime: 600_000,
    refetchInterval: 5 * 60_000,
    refetchIntervalInBackground: false,
  });
}

export function trackerCategoriesQuery() {
  return queryOptions({
    queryKey: ["tracker-categories"] as const,
    queryFn: fetchTrackerCategories,
    retry: false,
    staleTime: 10 * 60_000,
    gcTime: 600_000,
    refetchInterval: false,
  });
}

export function jackpotEntriesQuery() {
  return queryOptions({
    queryKey: ["jackpot-entries"] as const,
    queryFn: fetchJackpotEntries,
    retry: false,
    staleTime: 30_000,
    gcTime: 600_000,
    refetchInterval: false,
  });
}

export function trackerCategorySummaryQuery() {
  return queryOptions({
    queryKey: ["tracker-category-summary"] as const,
    queryFn: fetchTrackerCategorySummary,
    retry: false,
    staleTime: 60_000,
    gcTime: 600_000,
    refetchInterval: false,
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
      await Promise.all([qc.invalidateQueries({ queryKey: ["table"] }), qc.invalidateQueries({ queryKey: ["prediction-coupon-legs"] }), qc.resetQueries({ queryKey: ["prediction-pages"] }), qc.invalidateQueries({ queryKey: ["dashboard-summary"] }), qc.invalidateQueries({ queryKey: ["coupon-page-data"] }), qc.invalidateQueries({ queryKey: ["match-page-data"] }), qc.resetQueries({ queryKey: ["results-pages"] }), qc.resetQueries({ queryKey: ["history-pages"] }), qc.invalidateQueries({ queryKey: ["match-predictions"] }), qc.invalidateQueries({ queryKey: ["match-settlement-context"] }), qc.invalidateQueries({ queryKey: ["statistics-page-data"] }), qc.invalidateQueries({ queryKey: ["jackpot-entries"] }), qc.invalidateQueries({ queryKey: ["tracker-categories"] })]);
      const msg = typeof opts.success === "function" ? opts.success(r) : opts.success;
      if (msg) toast.success(msg);
      opts.onDone?.(r);
    },
    onError: async (e: Error) => {
      await Promise.all([qc.invalidateQueries({ queryKey: ["table"] }), qc.resetQueries({ queryKey: ["prediction-pages"] }), qc.invalidateQueries({ queryKey: ["coupon-page-data"] }), qc.resetQueries({ queryKey: ["results-pages"] }), qc.resetQueries({ queryKey: ["history-pages"] }), qc.invalidateQueries({ queryKey: ["match-predictions"] }), qc.invalidateQueries({ queryKey: ["match-settlement-context"] }), qc.invalidateQueries({ queryKey: ["statistics-page-data"] })]);
      toast.error(e.message);
    },
  });
}
