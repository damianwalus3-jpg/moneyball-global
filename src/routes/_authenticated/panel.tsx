import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { CalendarDays, ChevronRight, Ticket, Trophy, type LucideIcon } from "lucide-react";
import { DataError, EmptyState, NoGuarantee, PageHeader, PageLoader, StatCard } from "@/components/app/ui-bits";
import { fmtPct } from "@/lib/format";
import { dashboardSummaryQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/panel")({
  head: () => ({ meta: [{ title: "Panel — MONEYBALL GLOBAL 2.0" }, { name: "description", content: "Podsumowanie prognoz, kuponów i bankrolla." }, { property: "og:title", content: "Panel — MONEYBALL" }, { property: "og:description", content: "Podsumowanie prognoz." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(dashboardSummaryQuery()),
  pendingComponent: PageLoader,
  errorComponent: DataError,
  component: Panel,
});

function DashboardTile({ to, label, value, hint, icon, tone = "default" }: {
  to: "/bankroll" | "/mecze" | "/statystyki" | "/kupony" | "/historia";
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  tone?: "default" | "primary" | "warning";
}) {
  return (
    <Link
      to={to}
      aria-label={`${label}: ${value}. Zobacz szczegóły`}
      className="group block min-w-0 rounded-xl outline-none transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
    >
      <StatCard label={label} value={value} hint={hint} icon={icon} tone={tone} className="h-full transition-colors group-hover:border-primary/50" />
      <span className="mt-1 flex items-center justify-end gap-1 px-1 text-xs font-semibold text-primary">
        Zobacz szczegóły <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

function Panel() {
  const { data: summary } = useSuspenseQuery(dashboardSummaryQuery());
  const hr1 = summary.hit_rates["1X2"] ?? { rate: null, won: 0, settled: 0 };
  const hrDc = summary.hit_rates["DOUBLE_CHANCE"] ?? { rate: null, won: 0, settled: 0 };
  const hrGoals = summary.hit_rates.GOALS;

  return (
    <div>
      <PageHeader eyebrow="Europe/Brussels" title="Panel" />
      <p className="mb-3 text-sm text-muted-foreground">Każdy kafelek jest teraz przyciskiem — otwiera odpowiedni widok ze szczegółami.</p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <DashboardTile to="/mecze" label="Mecze dziś" value={summary.matches_today} icon={CalendarDays} />
        <DashboardTile to="/statystyki" label="Skuteczność 1X2" value={fmtPct(hr1.rate)} hint={`${hr1.won}/${hr1.settled} · model ogółem`} icon={Trophy} />
        <DashboardTile to="/statystyki" label="Skuteczność DC" value={fmtPct(hrDc.rate)} hint={`${hrDc.won}/${hrDc.settled} · model ogółem`} icon={Trophy} />
        <DashboardTile to="/statystyki" label="Skuteczność goli" value={fmtPct(hrGoals?.rate ?? null)} hint={`${hrGoals?.won ?? 0}/${hrGoals?.settled ?? 0} rozliczonych`} icon={Trophy} />
        <DashboardTile to="/kupony" label="Kupony w grze" value={summary.coupons_in_play} icon={Ticket} />
        <DashboardTile to="/kupony" label="Kandydaci >75%" value={summary.candidates} hint="mecze do kuponów" icon={Trophy} />
        <DashboardTile to="/historia" label="Do rozliczenia" value={summary.to_settle} hint="wyniki i rozliczenia" icon={CalendarDays} tone={summary.to_settle ? "warning" : "default"} />
      </div>
      {summary.matches_today === 0 && (
        <div className="mt-6">
          <EmptyState icon={CalendarDays} title="Brak meczów" description="Zaimportuj skan CSV lub dodaj pierwszy mecz w Terminarzu." />
        </div>
      )}
      <NoGuarantee className="mt-6" />
    </div>
  );
}
