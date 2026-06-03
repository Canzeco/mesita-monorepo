"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BusinessTicket } from "@/lib/api/tickets";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  centsToMoney,
  ticketOpenedMetaLine,
  ticketTitle,
} from "@/lib/ticket-display";
import {
  staffLifecycleFromTicket,
  staffStatusLabel,
  staffStatusTone,
  ticketCanCancel,
  ticketFlowTypeFromKind,
  ticketNeedsBill,
  ticketNeedsStaffPaymentConfirm,
} from "@/lib/ticket-staff-lifecycle";
import { TicketLifecycleStepper } from "@/components/tickets/TicketLifecycleStepper";
import { TicketBillForm } from "@/components/tickets/TicketBillForm";

function rewardLine(ticket: BusinessTicket): string | null {
  const discount = ticket.discount_cents ?? 0;
  const cashback = ticket.cashback_cents ?? 0;
  const redeem = ticket.redeem_cents ?? 0;
  const parts: string[] = [];
  if (discount > 0) parts.push(`${centsToMoney(discount, ticket.currency)} off`);
  if (cashback > 0) parts.push(`${centsToMoney(cashback, ticket.currency)} back`);
  if (redeem > 0) parts.push(`${centsToMoney(redeem, ticket.currency)} redeemed`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function TicketCard({
  ticket,
  venueCurrency,
  supabase,
  busy,
  onMarkPaid,
  onCancel,
  onBillSubmitted,
  onError,
}: {
  ticket: BusinessTicket;
  venueCurrency: string;
  supabase: SupabaseClient;
  busy: string | null;
  onMarkPaid: (ticketId: string) => void;
  onCancel: (ticketId: string) => void;
  onBillSubmitted: (message: string) => void;
  onError: (message: string) => void;
}) {
  const lifecycle = staffLifecycleFromTicket(ticket);
  const needsBill = ticketNeedsBill(ticket);
  const pendingPay = ticketNeedsStaffPaymentConfirm(ticket);
  const canCancel = ticketCanCancel(ticket);
  const payBusy = busy === `pay:${ticket.id}`;
  const cancelBusy = busy === `cancel:${ticket.id}`;
  const cancelled = ticket.status === "cancelled";
  const reward = rewardLine(ticket);
  const flowType = ticketFlowTypeFromKind(ticket.kind);
  const hasTotal = (ticket.total_cents ?? 0) > 0;

  return (
    <article className="group border-border/60 hover:border-border flex flex-col gap-3 border-b py-4 transition first:pt-4 last:border-b-0">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
            staffStatusTone(ticket.status),
          )}
          aria-hidden
        >
          {ticketTitle(ticket).charAt(0).toUpperCase()}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold tracking-tight">
                {ticketTitle(ticket)}
              </p>
              <p className="text-muted-foreground mt-0.5 text-[11px]">
                {ticketOpenedMetaLine(ticket)}
                <span className="text-border mx-1.5">·</span>
                <span className="text-muted-foreground/80">Type {flowType}</span>
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[15px] font-semibold tabular-nums tracking-tight">
                {hasTotal
                  ? centsToMoney(ticket.total_cents, ticket.currency)
                  : "—"}
              </p>
              {reward ? (
                <p className="text-secondary mt-0.5 text-[11px] font-medium">
                  {reward}
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "rounded-md px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase",
                staffStatusTone(ticket.status),
              )}
            >
              {staffStatusLabel(ticket.status)}
            </span>
          </div>

          <div className="mt-3">
            <TicketLifecycleStepper
              steps={lifecycle}
              cancelled={cancelled}
              showHint={needsBill}
            />
          </div>
        </div>
      </div>

      {needsBill && !cancelled ? (
        <TicketBillForm
          ticket={ticket}
          venueCurrency={venueCurrency}
          supabase={supabase}
          billBusy={busy === `bill:${ticket.id}`}
          onSubmitted={onBillSubmitted}
          onError={onError}
        />
      ) : null}

      {(pendingPay || canCancel) && !cancelled && !needsBill ? (
        <div className="flex items-center gap-4 pl-12">
          {pendingPay ? (
            <button
              type="button"
              onClick={() => onMarkPaid(ticket.id)}
              disabled={payBusy || busy === "refresh"}
              className="text-foreground hover:text-secondary text-[13px] font-semibold transition disabled:opacity-40"
            >
              {payBusy ? (
                <Loader2 className="inline h-3.5 w-3.5 animate-spin" />
              ) : (
                "Mark paid"
              )}
            </button>
          ) : null}
          {canCancel ? (
            <button
              type="button"
              onClick={() => onCancel(ticket.id)}
              disabled={cancelBusy || busy === "refresh"}
              className="text-muted-foreground hover:text-destructive text-[13px] font-medium transition disabled:opacity-40"
            >
              {cancelBusy ? (
                <Loader2 className="inline h-3.5 w-3.5 animate-spin" />
              ) : (
                "Cancel"
              )}
            </button>
          ) : null}
        </div>
      ) : null}

      {canCancel && needsBill && !cancelled ? (
        <div className="flex items-center gap-4 pl-12">
          <button
            type="button"
            onClick={() => onCancel(ticket.id)}
            disabled={cancelBusy || busy === "refresh"}
            className="text-muted-foreground hover:text-destructive text-[13px] font-medium transition disabled:opacity-40"
          >
            {cancelBusy ? (
              <Loader2 className="inline h-3.5 w-3.5 animate-spin" />
            ) : (
              "Cancel"
            )}
          </button>
        </div>
      ) : null}
    </article>
  );
}
