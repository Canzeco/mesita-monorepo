"use client";

import Link from "next/link";
import { CheckCircle2, Wallet } from "lucide-react";
import { TicketTransactionSummary } from "@/components/consumer/TicketTransactionSummary";
import type { TicketTransactionSummary as TicketTransactionSummaryData } from "@/lib/api/pay";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { ticketFlowTypeFromKind } from "@/lib/ticket-flow-steps";

export function TicketVisitComplete({
  summary,
  ticketKind,
}: {
  summary: TicketTransactionSummaryData;
  ticketKind?: string | null;
}) {
  const flowType = ticketFlowTypeFromKind(ticketKind ?? "dp");
  const hasCashback = flowType === "C" || flowType === "D";

  return (
    <section className="surface-card-soft space-y-4 p-4">
      <div className="flex flex-col items-center py-2 text-center">
        <CheckCircle2 className="text-secondary h-12 w-12" strokeWidth={1.75} />
        <h2 className="text-foreground mt-3 text-xl font-bold">Visit complete</h2>
        <p className="text-muted-foreground mt-1 max-w-xs text-sm leading-relaxed">
          Thanks for using Mesita at this restaurant.
        </p>
      </div>

      <TicketTransactionSummary summary={summary} variant="detail" />

      {hasCashback ? (
        <Link
          href={CONSUMER_ROUTES.pay.balance}
          className="btn-primary flex items-center justify-center gap-2 py-3.5 text-base"
        >
          <Wallet className="h-5 w-5" />
          View my balance
        </Link>
      ) : null}
    </section>
  );
}
