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
  FLOW_TYPE_SHORT_LABELS,
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
  const redeem = ticket.redeem_cents ?? 0;
  const parts: string[] = [];
  if (discount > 0)
    parts.push(`${centsToMoney(discount, ticket.currency)} off`);
  if (redeem > 0)
    parts.push(`${centsToMoney(redeem, ticket.currency)} redeemed`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function TicketCard({
  ticket,
  placeCurrency,
  supabase,
  busy,
  onMarkPaid,
  onCancel,
  onBillSubmitted,
  onError,
}: {
  ticket: BusinessTicket;
  placeCurrency: string;
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
  const showActions = !cancelled && (needsBill || pendingPay || canCancel);
  const flowLabel =
    flowType === "B" ? FLOW_TYPE_SHORT_LABELS[flowType] : null;

  return (
    <article
      className={cn(
        "border-border/60 bg-card overflow-hidden rounded-2xl border transition",
        needsBill && "border-primary/20 shadow-[0_8px_28px_-24px_rgba(0,0,0,0.35)]",
        cancelled && "opacity-60",
      )}
    >
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-start gap-3">
          <div
            className="bg-muted text-foreground/70 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
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
                <p className="text-[15px] font-semibold tracking-tight tabular-nums">
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

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                  staffStatusTone(ticket.status),
                )}
              >
                {staffStatusLabel(ticket.status)}
              </span>
              {flowLabel ? (
                <span className="text-muted-foreground bg-muted/60 rounded-full px-2 py-0.5 text-[10px] font-medium">
                  {flowLabel}
                </span>
              ) : null}
            </div>

            <div className="mt-2.5">
              <TicketLifecycleStepper
                steps={lifecycle}
                cancelled={cancelled}
                showHint={needsBill}
                compact
                hideLabel
              />
            </div>
          </div>
        </div>

        {needsBill && !cancelled ? (
          <TicketBillForm
            ticket={ticket}
            placeCurrency={placeCurrency}
            supabase={supabase}
            billBusy={busy === `bill:${ticket.id}`}
            onSubmitted={onBillSubmitted}
            onError={onError}
          />
        ) : null}
      </div>

      {showActions && !needsBill ? (
        <div className="border-border/50 bg-muted/15 flex flex-wrap items-center gap-2 border-t px-4 py-2.5">
          {pendingPay ? (
            <button
              type="button"
              onClick={() => onMarkPaid(ticket.id)}
              disabled={payBusy || busy === "refresh"}
              className="bg-pink-gradient inline-flex h-9 flex-1 items-center justify-center rounded-full px-4 text-[13px] font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-40 sm:flex-none"
            >
              {payBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                "Paid received"
              )}
            </button>
          ) : null}
          {canCancel ? (
            <button
              type="button"
              onClick={() => onCancel(ticket.id)}
              disabled={cancelBusy || busy === "refresh"}
              className="text-muted-foreground hover:text-destructive border-border/60 hover:border-border inline-flex h-9 flex-1 items-center justify-center rounded-full border bg-card px-3.5 text-[13px] font-medium transition disabled:opacity-40 sm:flex-none"
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
        <div className="border-border/50 bg-muted/15 border-t px-4 py-2.5">
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
