import { ResultForm } from "@/components/forms/SimpleForms";
import { useAction, useTable } from "@/lib/queries";
import { settleMatch, type SettleMode } from "@/lib/settlement";
import type { Match } from "@/lib/types";

/** Enter / correct a match result and settle all predictions, legs and coupons for it. */
export function SettleMatchDialog({ match, onClose }: { match: Match | null; onClose: () => void }) {
  const predictions = useTable("predictions");
  const legs = useTable("coupon_legs");
  const coupons = useTable("coupons");
  const results = useTable("match_results");
  const existing = match ? results.find((r) => r.match_id === match.id) : undefined;

  const settle = useAction(
    (mode: SettleMode) => {
      if (!match) throw new Error("Nie wybrano meczu.");
      return settleMatch({ match, existingResult: existing, predictions, legs, coupons }, mode);
    },
    {
      success: (r) => `Rozliczono: ${r.changedPredictions} prognoz, ${r.changedCoupons} kuponów`,
      onDone: onClose,
    },
  );

  return (
    <ResultForm
      open={match != null}
      onOpenChange={(o) => !o && onClose()}
      match={match}
      result={existing}
      pending={settle.isPending}
      onSave={(v) => settle.mutate(v)}
    />
  );
}
