import { createFileRoute } from "@tanstack/react-router";
import { DataError, PageLoader } from "@/components/app/ui-bits";
import { PredictionsView } from "@/components/app/PredictionsView";
import { ensureTables } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/prognozy-gole")({
  head: () => ({ meta: [{ title: "Prognozy goli — MONEYBALL GLOBAL 2.0" }, { name: "description", content: "Prognozy rynku goli: over/under i BTTS." }] }),
  loader: ({ context }) => ensureTables(context.queryClient, ["matches", "predictions"]),
  pendingComponent: PageLoader,
  errorComponent: DataError,
  component: () => <PredictionsView market="GOALS" />,
});
