import { createFileRoute } from "@tanstack/react-router";
import { DataError, PageLoader } from "@/components/app/ui-bits";
import { PredictionsView } from "@/components/app/PredictionsView";
import { ensureTables } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/prognozy-1x2")({
  head: () => ({ meta: [{ title: "Prognozy 1X2 — MONEYBALL GLOBAL 2.0" }, { name: "description", content: "Prognozy 1X2: wybrane i odrzucone." }, { property: "og:title", content: "Prognozy 1X2 — MONEYBALL" }, { property: "og:description", content: "Prognozy 1X2." }] }),
  loader: ({ context }) => ensureTables(context.queryClient, ["matches", "predictions"]),
  pendingComponent: PageLoader,
  errorComponent: DataError,
  component: () => <PredictionsView type="1X2" />,
});
