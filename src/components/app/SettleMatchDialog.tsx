import { useQuery } from "@tanstack/react-query";
import { ResultForm } from "@/components/forms/SimpleForms";
import { fetchMatchSettlementContext } from "@/lib/db";
import { useAction } from "@/lib/queries";
import { settleMatch, type SettleMode } from "@/lib/settlement";
import type { Match } from "@/lib/types";

/** Enter / correct a match result and settle all predictions, legs and coupons for it. */
export function SettleMatchDialog({ match, onClose }: { match: Match | null; onClose: () => void }) {
  const contextQuery = useQuery({
    queryKey: ["match-settlement-context", match?.id ?? null],
    queryFn: () => match ? fetchMatchSettlementContext(match.id) : Promise.resolve(null),
    enabled: Boolean(match?.id),
    staleTime: 15_000,
    gcTime: 5 * 60_000,
  });
  const context = contextQuery.data;
  const predictions = context?.predictions ?? [];
  const legs = context?.legs ?? [];
  const coupons = context?.coupons ?? [];
  const existing = context?.existingResult;

  const settle = useAction(
    (mode: SettleMode) => {
      if (!match) throw new Error("Nie wybrano meczu.");
      if (contextQuery.isPending || contextQuery.isError || !context) throw new Error("Nie udało się bezpiecznie pobrać danych rozliczenia tego meczu. Odśwież okno i spróbuj ponownie.");
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
      pending={settle.isPending || contextQuery.isPending || contextQuery.isError}
      onSave={(v) => settle.mutate(v)}
    />
  );
}
