import { useQuery } from "@tanstack/react-query";
import { ResultForm } from "@/components/forms/SimpleForms";
import { fetchPredictionsForMatch } from "@/lib/db";
import { useAction, useTable } from "@/lib/queries";
import { settleMatch, type SettleMode } from "@/lib/settlement";
import type { Match } from "@/lib/types";

/** Enter / correct a match result and settle all predictions, legs and coupons for it. */
export function SettleMatchDialog({ match, onClose }: { match: Match | null; onClose: () => void }) {
  const predictionsQuery = useQuery({
    queryKey: ["match-predictions", match?.id ?? null],
    queryFn: () => match ? fetchPredictionsForMatch(match.id) : Promise.resolve([]),
    enabled: Boolean(match?.id),
    staleTime: 15_000,
  });
  const predictions = predictionsQuery.data ?? [];
  const legs = useTable("coupon_legs");
  const coupons = useTable("coupons");
  const results = useTable("match_results");
  const existing = match ? results.find((r) => r.match_id === match.id) : undefined;

  const settle = useAction(
    (mode: SettleMode) => {
      if (!match) throw new Error("Nie wybrano meczu.");
      if (predictionsQuery.isPending || predictionsQuery.isError) throw new Error("Nie udało się bezpiecznie pobrać prognoz tego meczu. Odśwież okno i spróbuj ponownie.");
      return settleMatch({ match, existingResult: existing, predictions, legs, coupons }, mode);
    },
    {
      success: (r) => r.verified ? `Rozliczono: ${r.changedPredictions} prognoz, ${r.changedCoupons} kuponów` : "Zapisano wynik bez weryfikacji — rozliczenie wstrzymane.",
      onDone: onClose,
    },
  );

  return (
    <ResultForm
      open={match != null}
      onOpenChange={(o) => !o && onClose()}
      match={match}
      result={existing}
      pending={settle.isPending || predictionsQuery.isPending}
      onSave={(v) => settle.mutate(v)}
    />
  );
}
