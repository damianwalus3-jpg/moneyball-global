import { createFileRoute } from "@tanstack/react-router";
import { DataError, PageLoader } from "@/components/app/ui-bits";
import { PredictionsView } from "@/components/app/PredictionsView";
import { ensureTables } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/double-chance")({
  head: () => ({ meta: [{ title: "Double Chance — MONEYBALL GLOBAL 2.0" }, { name: "description", content: "Prognozy Double Chance: 1X, X2, 12." }, { property: "og:title", content: "Double Chance — MONEYBALL" }, { property: "og:description", content: "Prognozy Double Chance." }] }),
  loader: ({ context }) => ensureTables(context.queryClient, ["matches", "predictions"]),
  pendingComponent: PageLoader,
  errorComponent: DataError,
  component: () => <PredictionsView market="DOUBLE_CHANCE" />,
});
