import { Link, useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { AlertTriangle, Loader2, Trash2, type LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SETTLEMENT_LABELS } from "@/lib/domain";
import type { Market, Settlement, Verdict } from "@/lib/types";
import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
        <h1 className="text-3xl font-bold uppercase leading-none sm:text-4xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="surface-card flex flex-col items-center px-6 py-10 text-center">
      <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="size-6" />
      </div>
      <h3 className="text-xl font-semibold uppercase">{title}</h3>
      {description && <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  tone?: "default" | "primary" | "warning" | "danger";
  className?: string;
}) {
  return (
    <div className={cn(tone === "primary" ? "surface-hero" : "surface-card", "p-4", className)}>
      <div className="flex items-center justify-between">
        <span className="eyebrow">{label}</span>
        {Icon && (
          <Icon
            className={cn(
              "size-4",
              tone === "primary" && "text-primary",
              tone === "warning" && "text-warning",
              tone === "danger" && "text-destructive",
              tone === "default" && "text-muted-foreground",
            )}
          />
        )}
      </div>
      <div className="num mt-2 text-2xl font-semibold leading-tight sm:text-3xl">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

const SETTLE_VARIANT = { pending: "warning", won: "success", lost: "danger", void: "muted" } as const;

export function SettlementBadge({ status }: { status: Settlement | null | undefined }) {
  const s = status ?? "pending";
  return <Badge variant={SETTLE_VARIANT[s]}>{SETTLEMENT_LABELS[s]}</Badge>;
}

export function SelectionBadge({ status }: { status: Verdict | null | undefined }) {
  return status === "WYBRANY" ? (
    <Badge variant="rejected">ODRZUCONY</Badge>
  ) : (
    <Badge variant="selected">WYBRANY</Badge>
  );
}

export function TypeBadge({ type }: { type: Market }) {
  return <Badge variant={type === "DOUBLE_CHANCE" ? "info" : "outline"}>{type === "DOUBLE_CHANCE" ? "Double Chance" : "1X2"}</Badge>;
}

export function PageLoader() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
      <Loader2 className="mr-2 size-5 animate-spin" /> Wczytywanie danych…
    </div>
  );
}

export function DataError({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  return (
    <div className="surface-card mx-auto mt-6 max-w-xl p-6">
      <div className="flex items-center gap-2 text-destructive">
        <AlertTriangle className="size-5" />
        <h2 className="text-xl font-semibold uppercase">Nie udało się pobrać danych</h2>
      </div>
      <p className="mt-2 break-words text-sm text-muted-foreground">{error instanceof Error ? error.message : String(error)}</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Jeśli to niezgodność tabel lub kolumn, uruchom diagnostykę schematu w ustawieniach.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          onClick={() => {
            router.invalidate();
            reset();
          }}
        >
          Spróbuj ponownie
        </Button>
        <Button variant="outline" asChild>
          <Link to="/ustawienia">Diagnostyka</Link>
        </Button>
      </div>
    </div>
  );
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor?: string | undefined;
  error?: string | undefined;
  hint?: string | undefined;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function ConfirmDelete({
  onConfirm,
  title = "Usunąć rekord?",
  description = "Tej operacji nie można cofnąć.",
  size = "icon",
  label,
}: {
  onConfirm: () => void;
  title?: string;
  description?: string;
  size?: "icon" | "sm";
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        size={size}
        aria-label={label ?? "Usuń"}
        className="text-muted-foreground hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <Trash2 />
        {size === "sm" && (label ?? "Usuń")}
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={onConfirm}
            >
              Usuń
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function NoGuarantee({ className }: { className?: string }) {
  return (
    <p className={cn("text-xs text-muted-foreground", className)}>
      Prawdopodobieństwa to szacunki modelu, nie gwarancja wygranej. Zakłady wiążą się z ryzykiem
      straty.
    </p>
  );
}
