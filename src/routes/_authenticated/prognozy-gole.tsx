import { createFileRoute } from "@tanstack/react-router";
import { PredictionsView } from "@/components/app/PredictionsView";

export const Route = createFileRoute("/_authenticated/prognozy-gole")({
  head: () => ({ meta: [{ title: "Prognozy goli — MONEYBALL GLOBAL 2.0" }, { name: "description", content: "Prognozy rynku goli: over/under i BTTS." }] }),
  component: () => <PredictionsView market="GOALS" />,
});
