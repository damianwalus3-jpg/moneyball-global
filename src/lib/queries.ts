import { queryOptions, useMutation, useQueryClient, useSuspenseQuery, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { fetchAll } from "./db";
import type { TableName } from "./types";

export function tableQuery<K extends TableName>(table: K) {
  return queryOptions({
    queryKey: ["table", table] as const,
    queryFn: () => fetchAll(table),
    staleTime: 120_000,
    gcTime: 600_000,
    refetchOnWindowFocus: false,
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
      await qc.invalidateQueries({ queryKey: ["table"] });
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
