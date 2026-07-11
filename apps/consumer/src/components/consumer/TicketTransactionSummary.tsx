import {
  formatPayMx,
  formatTicketTransactionSummaryLine,
  type TicketTransactionSummary as TicketTransactionSummaryData,
} from "@/lib/api/pay";
import { cn } from "@/lib/utils";

function SummaryRow({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-semibold tabular-nums",
          highlight ? "text-secondary" : "text-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function TicketTransactionSummary({
  summary,
  variant = "compact",
  className,
}: {
  summary: TicketTransactionSummaryData;
  variant?: "compact" | "detail";
  className?: string;
}) {
  const line = formatTicketTransactionSummaryLine(summary);

  if (variant === "compact") {
    return (
      <div
        className={cn(
          "bg-pink-gradient mt-2 w-full rounded-xl px-3 py-2.5 text-left text-white shadow-sm",
          className,
        )}
      >
        <p className="text-[10px] font-semibold tracking-[0.12em] uppercase opacity-80">
          Status summary
        </p>
        <p className="mt-1 text-xs leading-snug font-medium">{line}</p>
      </div>
    );
  }

  const promoLabel =
    summary.promoPercent != null && summary.promoPercent > 0
      ? `${summary.promoPercent}% off subtotal`
      : "—";

  const rewardLabel =
    summary.promoPercent != null && summary.promoPercent > 0
      ? `${summary.promoPercent}% (${formatPayMx(summary.rewardCents, summary.currency)})`
      : summary.rewardCents > 0
        ? formatPayMx(summary.rewardCents, summary.currency)
        : "—";

  return (
    <div
      className={cn(
        "reward-highlight flex-col items-stretch space-y-2 px-3 py-3",
        className,
      )}
    >
      <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.12em] uppercase">
        Transaction summary
      </p>
      <SummaryRow label="Discount on subtotal" value={promoLabel} highlight />
      <SummaryRow
        label="Payment"
        value={
          summary.paymentCents != null
            ? formatPayMx(summary.paymentCents, summary.currency)
            : "—"
        }
      />
      <SummaryRow label="You save" value={rewardLabel} highlight />
    </div>
  );
}
