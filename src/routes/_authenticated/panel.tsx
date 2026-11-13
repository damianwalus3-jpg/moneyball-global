import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { CalendarDays, Ticket, Trophy, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataError, EmptyState, NoGuarantee, PageHeader, PageLoader, StatCard } from "@/components/app/ui-bits";
import { fmtMoney, fmtPct } from "@/lib/format";
import { dashboardSummaryQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/panel")({
  head: () => ({ meta: [{ title: "Panel — MONEYBALL GLOBAL 2.0" }, { name: "description", content: "Podsumowanie prognoz, kuponów i bankrolla." }, { property: "og:title", content: "Panel — MONEYBALL" }, { property: "og:description", content: "Podsumowanie prognoz." }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(dashboardSummaryQuery()),
  pendingComponent: PageLoader,
  errorComponent: DataError,
  component: Panel,
});

function Panel() {
  const { data: summary } = useSuspenseQuery(dashboardSummaryQuery());
  const hr1 = summary.hit_rates["1X2"];
  const hrDc = summary.hit_rates.DOUBLE_CHANCE;
  const hrGoals = summary.hit_rates.GOALS;

  return (
    <div>
      <PageHeader eyebrow="Europe/Brussels" title="Panel" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Bankroll" value={summary.bankroll == null ? "brak danych" : fmtMoney(summary.bankroll)} icon={Wallet} tone="primary" />
        <StatCard label="Mecze dziś" value={summary.matches_today} icon={CalendarDays} />
        <StatCard label="Skuteczność 1X2" value={fmtPct(hr1?.rate ?? null)} hint={`${hr1?.won ?? 0}/${hr1?.settled ?? 0}`} icon={Trophy} />
        <StatCard label="Skuteczność DC" value={fmtPct(hrDc?.rate ?? null)} hint={`${hrDc?.won ?? 0}/${hrDc?.settled ?? 0}`} icon={Trophy} />
        <StatCard label="Skuteczność goli" value={fmtPct(hrGoals?.rate ?? null)} hint={`${hrGoals?.won ?? 0}/${hrGoals?.settled ?? 0}`} icon={Trophy} />
        <StatCard label="Kupony w grze" value={summary.coupons_in_play} icon={Ticket} />
        <StatCard label="Kandydaci >75%" value={summary.candidates} hint="mecze do kuponów" />
        <StatCard label="Do rozliczenia" value={summary.to_settle} tone={summary.to_settle ? "warning" : "default"} />
      </div>
      {summary.matches_today === 0 && (
        <div className="mt-6">
          <EmptyState icon={CalendarDays} title="Brak meczów" description="Zaimportuj skan CSV lub dodaj pierwszy mecz w Terminarzu." action={<Button asChild><Link to="/mecze">Przejdź do Terminarza</Link></Button>} />
        </div>
      )}
      <NoGuarantee className="mt-6" />
    </div>
  );
}
