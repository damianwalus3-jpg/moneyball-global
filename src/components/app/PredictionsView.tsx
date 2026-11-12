import { Pencil, Plus, Target } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDelete, EmptyState, PageHeader, SelectionBadge, SettlementBadge, StatCard } from "@/components/app/ui-bits";
import { PredictionForm } from "@/components/forms/PredictionForm";
import { deleteRow, updateRow } from "@/lib/db";
import { hitRate, impliedProbability, isActivePredictionVersion, MARKET_LABELS } from "@/lib/domain";
import { fmtOdds, fmtPct, matchLabel } from "@/lib/format";
import { useAction, useTable } from "@/lib/queries";
import { fmtDateTime } from "@/lib/time";
import type { Market, Prediction } from "@/lib/types";

export function PredictionsView({ market }: { market: Market }) {
  const matches = useTable("matches");
  const all = useTable("predictions");
  const couponLegs = useTable("coupon_legs");
  const [verdictFilter, setVerdictFilter] = useState<"all" | "WYBRANY" | "ODRZUCONY">("all");
  const [modelScope, setModelScope] = useState<"current" | "all">("current");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Prediction | null>(null);
  const [open, setOpen] = useState(false);
  const byId = useMemo(() => new Map(matches.map((match) => [match.id, match])), [matches]);
  const visible = modelScope === "all"
    ? all
    : all.filter((prediction) => isActivePredictionVersion(prediction.model_version));
  const list = visible
    .filter((prediction) => prediction.market === market)
    .filter((prediction) => verdictFilter === "all" || prediction.verdict === verdictFilter)
    .filter((prediction) => {
      const match = byId.get(prediction.match_id);
      return !query || `${matchLabel(match)} ${match?.competition ?? ""} ${match?.country ?? ""}`.toLowerCase().includes(query.toLowerCase());
    })
    .sort((a, b) => (byId.get(b.match_id)?.kickoff_at ?? "").localeCompare(byId.get(a.match_id)?.kickoff_at ?? ""));
  const settledSelected = visible.filter(
    (prediction) =>
      prediction.market === market &&
      prediction.verdict === "WYBRANY" &&
      prediction.verified &&
      (prediction.settlement_status === "won" || prediction.settlement_status === "lost"),
  );
  const rate = hitRate(settledSelected.map((prediction) => prediction.settlement_status));
  const toggle = useAction((prediction: Prediction) =>
    updateRow("predictions", prediction.id, {
      verdict: prediction.verdict === "ODRZUCONY" ? "WYBRANY" : "ODRZUCONY",
    }),
  );
  const remove = useAction(async (id: string) => {
    if (couponLegs.some((leg) => leg.prediction_id === id))
      throw new Error("Nie można usunąć prognozy użytej w kuponie. Zachowaj historię i zmień werdykt na ODRZUCONY.");
    await deleteRow("predictions", id);
  }, { success: "Usunięto prognozę" });

  return (
    <div>
      <PageHeader
        eyebrow={market === "DOUBLE_CHANCE" ? "1X · X2 · 12" : "1 · X · 2"}
        title={market === "DOUBLE_CHANCE" ? "Double Chance" : "Prognozy 1X2"}
        description="Prawdopodobieństwo modelu jest oddzielone od kursu bukmachera. Skuteczność obejmuje wyłącznie zweryfikowane rozliczenia."
        actions={<Button onClick={() => { setEditing(null); setOpen(true); }} disabled={matches.length === 0}><Plus /> Dodaj prognozę</Button>}
      />
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Skuteczność WYBRANE" value={fmtPct(rate.rate)} hint={`${rate.won}/${rate.settled} zweryfikowanych`} tone="primary" />
        <StatCard label="Rozliczone" value={rate.settled} />
        <StatCard label="Oczekujące" value={list.filter((prediction) => prediction.settlement_status === "pending").length} />
        <StatCard label="Wszystkie" value={list.length} />
      </div>
      <div className="mb-2 flex flex-wrap gap-2">
        <Button size="sm" variant={modelScope === "current" ? "default" : "outline"} onClick={() => setModelScope("current")}>Aktywny model</Button>
        <Button size="sm" variant={modelScope === "all" ? "default" : "outline"} onClick={() => setModelScope("all")}>Wszystkie wersje ({all.length})</Button>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {(["all", "WYBRANY", "ODRZUCONY"] as const).map((verdict) => (
          <Button key={verdict} size="sm" variant={verdictFilter === verdict ? "default" : "outline"} onClick={() => setVerdictFilter(verdict)}>
            {verdict === "all" ? "Wszystkie" : verdict}
          </Button>
        ))}
        <Input placeholder="Szukaj…" value={query} onChange={(event) => setQuery(event.target.value)} className="h-8 max-w-xs" />
      </div>
      {list.length === 0 ? (
        <EmptyState icon={Target} title="Brak prognoz" description={matches.length === 0 ? "Najpierw dodaj mecze lub zaimportuj skan w Terminarzu." : "Dodaj prognozę lub zmień filtry."} />
      ) : (
        <div className="grid gap-2">
          {list.map((prediction) => {
            const match = byId.get(prediction.match_id);
            const implied = impliedProbability(prediction.odds);
            return (
              <div key={prediction.id} className="surface-card flex flex-wrap items-center gap-3 p-3">
                <div className="num flex size-12 items-center justify-center rounded-lg bg-primary/10 text-lg font-semibold text-primary">
                  {prediction.selection}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{matchLabel(match)}</div>
                  <div className="text-xs text-muted-foreground">{match?.competition ?? "—"} · {fmtDateTime(match?.kickoff_at)}</div>
                  {prediction.rationale && <div className="text-xs text-muted-foreground">Uzasadnienie: {prediction.rationale}</div>}
                  {prediction.note && <div className="text-xs text-muted-foreground">{prediction.note}</div>}
                </div>
                <div className="num text-right text-sm">
                  <div>{fmtPct(prediction.probability)}</div>
                  <div className="text-xs text-muted-foreground">kurs {fmtOdds(prediction.odds)}{implied != null && ` · imp. ${fmtPct(implied)}`}</div>
                </div>
                <button onClick={() => toggle.mutate(prediction)} title="Przełącz werdykt"><SelectionBadge status={prediction.verdict} /></button>
                <SettlementBadge status={prediction.settlement_status} />
                {prediction.verified && <span className="text-xs text-success">zweryfikowano</span>}
                <Button variant="ghost" size="icon" aria-label="Edytuj" title={couponLegs.some((leg) => leg.prediction_id === prediction.id) ? "Prognoza jest użyta w kuponie" : "Edytuj"} disabled={couponLegs.some((leg) => leg.prediction_id === prediction.id)} onClick={() => { setEditing(prediction); setOpen(true); }}><Pencil /></Button>
                {!couponLegs.some((leg) => leg.prediction_id === prediction.id) && <ConfirmDelete onConfirm={() => remove.mutate(prediction.id)} />}
              </div>
            );
          })}
        </div>
      )}
      <PredictionForm open={open} onOpenChange={setOpen} market={market} prediction={editing} matches={matches} />
    </div>
  );
}
