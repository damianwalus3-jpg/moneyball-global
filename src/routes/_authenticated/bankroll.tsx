import { createFileRoute } from "@tanstack/react-router";
import { Download, Pencil, Plus, Wallet } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDelete, DataError, EmptyState, PageHeader, PageLoader, StatCard } from "@/components/app/ui-bits";
import { TransactionForm } from "@/components/forms/SimpleForms";
import { downloadFile, stamp, toCsv } from "@/lib/backup";
import { deleteRow } from "@/lib/db";
import { bankrollBalance, signedAmount, TX_LABELS } from "@/lib/domain";
import { fmtMoney } from "@/lib/format";
import { ensureTables, useAction, useTable } from "@/lib/queries";
import { fmtDateTime } from "@/lib/time";
import type { BankrollTransaction, TxType } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/bankroll")({
  head: () => ({
    meta: [
      { title: "Bankroll — MONEYBALL GLOBAL 2.0" },
      { name: "description", content: "Rejestr wpłat, wypłat, stawek i wygranych. Saldo liczone wyłącznie z transakcji." },
      { property: "og:title", content: "Bankroll — MONEYBALL GLOBAL 2.0" },
      { property: "og:description", content: "Rejestr transakcji bankrolla." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => ensureTables(context.queryClient, ["bankroll_transactions", "coupons"]),
  pendingComponent: PageLoader,
  errorComponent: DataError,
  component: Bankroll,
});

function Bankroll() {
  const txs = useTable("bankroll_transactions");
  const coupons = useTable("coupons");
  const [edit, setEdit] = useState<BankrollTransaction | null>(null);
  const [open, setOpen] = useState(false);
  const del = useAction((id: string) => deleteRow("bankroll_transactions", id), { success: "Usunięto transakcję" });
  const balance = bankrollBalance(txs);
  const sum = (t: TxType) => txs.filter((x) => x.type === t).reduce((s, x) => s + Math.abs(Number(x.amount)), 0);
  const sorted = [...txs].sort((a, b) => (b.occurred_at ?? "").localeCompare(a.occurred_at ?? ""));
  const couponName = (id: string | null) => (id ? coupons.find((c) => c.id === id)?.name ?? "kupon" : null);

  return (
    <div>
      <PageHeader
        eyebrow="Rejestr transakcji"
        title="Bankroll"
        description="Saldo wynika wyłącznie z zapisanych transakcji. Bez transakcji pokazujemy „brak danych”."
        actions={
          <>
            <Button
              variant="outline"
              disabled={txs.length === 0}
              onClick={() => downloadFile(`bankroll-${stamp()}.csv`, toCsv(txs as unknown as Record<string, unknown>[]), "text/csv")}
            >
              <Download /> CSV
            </Button>
            <Button
              onClick={() => {
                setEdit(null);
                setOpen(true);
              }}
            >
              <Plus /> Transakcja
            </Button>
          </>
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard className="col-span-2 lg:col-span-1" label="Saldo" value={balance == null ? "brak danych" : fmtMoney(balance)} icon={Wallet} tone="primary" />
        <StatCard label="Wpłaty" value={txs.length ? fmtMoney(sum("deposit")) : "—"} />
        <StatCard label="Wypłaty" value={txs.length ? fmtMoney(sum("withdrawal")) : "—"} />
        <StatCard label="Stawki" value={txs.length ? fmtMoney(sum("stake")) : "—"} />
        <StatCard label="Wygrane" value={txs.length ? fmtMoney(sum("payout")) : "—"} />
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Brak transakcji"
          description="Dodaj pierwszą wpłatę, aby zobaczyć saldo. Aplikacja nie zakłada żadnej kwoty startowej."
          action={
            <Button onClick={() => setOpen(true)}>
              <Plus /> Dodaj wpłatę
            </Button>
          }
        />
      ) : (
        <div className="grid gap-2">
          {sorted.map((t) => {
            const v = signedAmount(t);
            const cn_ = couponName(t.coupon_id);
            return (
              <div key={t.id} className="surface-card flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{TX_LABELS[t.type] ?? t.type}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {fmtDateTime(t.occurred_at)}
                    {cn_ ? ` · ${cn_}` : ""}
                    {t.note ? ` · ${t.note}` : ""}
                  </div>
                </div>
                <div className={cn("num text-right font-semibold", v < 0 ? "text-destructive" : "text-success")}>
                  {v > 0 ? "+" : ""}
                  {fmtMoney(v)}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Edytuj transakcję"
                  onClick={() => {
                    setEdit(t);
                    setOpen(true);
                  }}
                >
                  <Pencil />
                </Button>
                <ConfirmDelete title="Usunąć transakcję?" onConfirm={() => del.mutate(t.id)} />
              </div>
            );
          })}
        </div>
      )}
      <TransactionForm open={open} onOpenChange={setOpen} tx={edit} />
    </div>
  );
}
