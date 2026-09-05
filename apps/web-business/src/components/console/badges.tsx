// Small server-safe display atoms for the (shell) console: rung badge,
// payment-state pill, stat tile, data row, mock chip. Rows not cards —
// these are calm utility chrome, not decoration.
//
// NOTE: rung colors use Tailwind palette classes for the mock era; the
// deferred token cleanup replaces the stale two-tier `--tier-*` vars with
// `--rung-*` tokens in one pass.
import { cn } from "@/lib/utils";
import { TINY_LABEL_CLASS } from "@/lib/ui-classes";
import type { PaymentAccountState, Rung } from "@/lib/model/types";

const RUNG_LABEL: Record<Rung, string> = {
  listed: "Listed",
  verified: "Verified",
  partner: "Partner",
};

const RUNG_DOT: Record<Rung, string> = {
  listed: "bg-muted-foreground/50",
  verified: "bg-amber-500",
  partner: "bg-emerald-500",
};

export function RungBadge({
  rung,
  className,
}: {
  rung: Rung;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "border-border bg-card inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", RUNG_DOT[rung])} />
      {RUNG_LABEL[rung]}
    </span>
  );
}

const STATE_LABEL: Record<PaymentAccountState, string> = {
  none: "No account",
  pending: "Pending",
  charges_only: "Charges only",
  live: "Live",
  restricted: "Restricted",
};

const STATE_CLASS: Record<PaymentAccountState, string> = {
  none: "bg-muted text-muted-foreground",
  pending: "bg-amber-500/15 text-amber-700",
  charges_only: "bg-amber-500/15 text-amber-700",
  live: "bg-emerald-500/15 text-emerald-700",
  restricted: "bg-destructive/10 text-destructive",
};

export function StatePill({ state }: { state: PaymentAccountState }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
        STATE_CLASS[state],
      )}
    >
      {STATE_LABEL[state]}
    </span>
  );
}

export function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="border-border bg-card flex min-w-0 flex-col gap-1 rounded-2xl border p-4">
      <span className={TINY_LABEL_CLASS}>{label}</span>
      <span className="font-display text-2xl font-semibold tracking-tight">
        {value}
      </span>
      {hint && (
        <span className="text-muted-foreground text-[12px]">{hint}</span>
      )}
    </div>
  );
}

export function DataRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-border/60 flex items-center justify-between gap-4 border-b py-2.5 text-sm last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right font-medium">{children}</span>
    </div>
  );
}

export function MockChip() {
  return (
    <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-bold tracking-[0.14em] text-amber-700 uppercase">
      Mock data
    </span>
  );
}
