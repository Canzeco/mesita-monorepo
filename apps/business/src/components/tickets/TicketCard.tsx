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
  FLOW_TYPE_LABELS,
  FORMAL_KINDS,
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

function statusAccentClass(status: BusinessTicket["status"]): string {
  if (status === "open") return "bg-sky-500";
  if (status === "awaiting_payment_confirm" || status === "pending_pay") {
    return "bg-amber-500";
  }
  if (status === "paid" || status === "revealed") return "bg-emerald-500";
  if (status === "awaiting_story") return "bg-violet-500";
  if (status === "cancelled") return "bg-muted-foreground/40";
  return "bg-border";
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
  const payConfirmLabel = FORMAL_KINDS.has(ticket.kind)
    ? "Mark paid"
    : "Paid received";
  const showActions = !cancelled && (needsBill || pendingPay || canCancel);

  return (
    <article
      className={cn(
        "group relative flex flex-col gap-3 rounded-2xl border p-4 transition",
        needsBill
          ? "border-primary/25 bg-card shadow-sm ring-1 ring-primary/10"
          : "border-border/50 bg-card/80 hover:border-border/80 hover:bg-card",
        cancelled && "opacity-60",
      )}
    >
      <span
        className={cn(
          "absolute top-4 bottom-4 left-0 w-0.5 rounded-full",
          statusAccentClass(ticket.status),
        )}
        aria-hidden
      />

      <div className="flex items-start gap-3 pl-1">
        <div
          className={cn(
            "font-display flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
            staffStatusTone(ticket.status),
          )}
          aria-hidden
        >
          {ticketTitle(ticket).charAt(0).toUpperCase()}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold tracking-tight">
                {ticketTitle(ticket)}
              </p>
              <p className="text-muted-foreground mt-0.5 text-[11px] leading-snug">
                {ticketOpenedMetaLine(ticket)}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[16px] font-semibold tabular-nums tracking-tight">
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

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
                staffStatusTone(ticket.status),
              )}
            >
              {staffStatusLabel(ticket.status)}
            </span>
            <span
              className="text-muted-foreground bg-muted/60 rounded-full px-2 py-0.5 text-[10px] font-medium"
              title={FLOW_TYPE_LABELS[flowType]}
            >
              {flowType}
            </span>
          </div>

          <div className="mt-3">
            <TicketLifecycleStepper
              steps={lifecycle}
              cancelled={cancelled}
              showHint={needsBill}
              compact
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

      {showActions && !needsBill ? (
        <div className="flex flex-wrap items-center gap-2 pl-11 sm:pl-12">
          {pendingPay ? (
            <button
              type="button"
              onClick={() => onMarkPaid(ticket.id)}
              disabled={payBusy || busy === "refresh"}
              className="bg-primary text-primary-foreground hover:opacity-92 inline-flex h-9 items-center justify-center rounded-full px-4 text-[13px] font-semibold shadow-sm transition disabled:opacity-40"
            >
              {payBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                payConfirmLabel
              )}
            </button>
          ) : null}
          {canCancel ? (
            <button
              type="button"
              onClick={() => onCancel(ticket.id)}
              disabled={cancelBusy || busy === "refresh"}
              className="text-muted-foreground hover:text-destructive border-border/60 hover:border-border inline-flex h-9 items-center justify-center rounded-full border px-3.5 text-[13px] font-medium transition disabled:opacity-40"
            >
              {cancelBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                "Cancel"
              )}
            </button>
          ) : null}
        </div>
      ) : null}

      {showActions && needsBill && canCancel ? (
        <div className="pl-11 sm:pl-12">
          <button
            type="button"
            onClick={() => onCancel(ticket.id)}
            disabled={cancelBusy || busy === "refresh"}
            className="text-muted-foreground hover:text-destructive text-[12px] font-medium transition disabled:opacity-40"
          >
            {cancelBusy ? (
              <Loader2 className="inline h-3 w-3 animate-spin" />
            ) : (
              "Cancel ticket"
            )}
          </button>
        </div>
      ) : null}
    </article>
  );
}
