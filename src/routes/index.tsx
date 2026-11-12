import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BarChart3, ShieldCheck, Ticket } from "lucide-react";
import logo from "@/assets/logo.png";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MONEYBALL GLOBAL 2.0 — prognozy piłkarskie" },
      {
        name: "description",
        content: "Prywatny panel do śledzenia prognoz 1X2 i Double Chance, kuponów, rozliczeń i bankrolla.",
      },
      { property: "og:title", content: "MONEYBALL GLOBAL 2.0" },
      {
        property: "og:description",
        content: "Prywatny panel do śledzenia prognoz 1X2 i Double Chance, kuponów, rozliczeń i bankrolla.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-5 py-12">
      <div className="w-full max-w-md text-center">
        <img src={logo} alt="MONEYBALL GLOBAL 2.0" width={112} height={112} className="glow mx-auto size-28 rounded-3xl" />
        <div className="eyebrow mt-6 text-primary">Football prediction tracker</div>
        <h1 className="mt-2 text-5xl font-bold uppercase leading-none sm:text-6xl">
          Moneyball
          <span className="block text-primary">Global 2.0</span>
        </h1>
        <p className="mt-4 text-muted-foreground">
          Skany, prognozy 1X2 i Double Chance, kupony pojedyncze i AKO, rozliczenia i bankroll — w jednym miejscu.
        </p>
        <Button asChild size="lg" className="mt-8 w-full text-base">
          <Link to="/panel">
            Otwórz panel <ArrowRight />
          </Link>
        </Button>
        <div className="mt-10 grid grid-cols-3 gap-3 text-left">
          {[
            { icon: ShieldCheck, t: "Twoja baza", d: "Dane tylko w Twoim projekcie" },
            { icon: Ticket, t: "Kupony", d: "Pojedyncze i AKO" },
            { icon: BarChart3, t: "Statystyki", d: "1X2 i DC osobno" },
          ].map((x) => (
            <div key={x.t} className="surface-card p-3">
              <x.icon className="size-4 text-primary" />
              <div className="mt-2 font-display text-sm font-semibold uppercase">{x.t}</div>
              <div className="text-[11px] text-muted-foreground">{x.d}</div>
            </div>
          ))}
        </div>
        <p className="mt-8 text-[11px] text-muted-foreground">
          Prognozy to szacunki — nie gwarantują wygranej.
        </p>
      </div>
    </div>
  );
}
