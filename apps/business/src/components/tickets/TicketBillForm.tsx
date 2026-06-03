"use client";

import { Loader2 } from "lucide-react";
import { cn, errMsg } from "@/lib/utils";
import { INPUT_CLASS, TINY_LABEL_CLASS } from "@/lib/ui-classes";
import type { BusinessTicket } from "@/lib/api/tickets";
import { apiSubmitTicketBill } from "@/lib/api/tickets";
import { ticketFlowTypeFromKind } from "@/lib/ticket-staff-lifecycle";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useState } from "react";

export function TicketBillForm({
  ticket,
  venueCurrency,
  supabase,
  billBusy,
  onSubmitted,
  onError,
}: {
  ticket: BusinessTicket;
  venueCurrency: string;
  supabase: SupabaseClient;
  billBusy: boolean;
  onSubmitted: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [subtotalText, setSubtotalText] = useState("");
  const [tipText, setTipText] = useState("");
  const flowType = ticketFlowTypeFromKind(ticket.kind);
  const isCashbackFlow = flowType === "C" || flowType === "D";

  const submitBill = async () => {
    const subtotal = Number(subtotalText);
    const tip = isCashbackFlow && tipText.trim() ? Number(tipText) : 0;

    if (!Number.isFinite(subtotal) || subtotal <= 0) {
      onError("Subtotal must be greater than 0.");
      return;
    }
    if (isCashbackFlow && (!Number.isFinite(tip) || tip < 0)) {
      onError("Tip must be 0 or greater.");
      return;
    }

    setSubmitting(true);
    try {
      await apiSubmitTicketBill(supabase, {
        ticketId: ticket.id,
        checkSubtotalCents: Math.round(subtotal * 100),
        tipCents: isCashbackFlow ? Math.round(tip * 100) : 0,
      });
      setSubtotalText("");
      setTipText("");
      onSubmitted("Bill sent to guest.");
    } catch (e) {
      onError(errMsg(e, "Couldn't submit bill."));
    } finally {
      setSubmitting(false);
    }
  };

  const disabled = submitting || billBusy;

  return (
    <form
      className="border-border/50 bg-muted/30 mt-2 flex flex-col gap-3 rounded-xl border p-3 pl-12"
      onSubmit={(e) => {
        e.preventDefault();
        void submitBill();
      }}
    >
      <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
        Billing
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <label>
          <span className={TINY_LABEL_CLASS}>Subtotal</span>
          <div className="relative mt-1">
            <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-[10px]">
              {venueCurrency}
            </span>
            <input
              value={subtotalText}
              onChange={(e) => setSubtotalText(e.target.value)}
              placeholder="850"
              inputMode="decimal"
              className={cn(INPUT_CLASS, "h-10 pl-11 text-sm tabular-nums")}
            />
          </div>
        </label>
        {isCashbackFlow ? (
          <label>
            <span className={TINY_LABEL_CLASS}>Tip</span>
            <div className="relative mt-1">
              <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-[10px]">
                {venueCurrency}
              </span>
              <input
                value={tipText}
                onChange={(e) => setTipText(e.target.value)}
                placeholder="0"
                inputMode="decimal"
                className={cn(INPUT_CLASS, "h-10 pl-11 text-sm tabular-nums")}
              />
            </div>
          </label>
        ) : null}
        <div className="col-span-2 flex items-end sm:col-span-1">
          <button
            type="submit"
            disabled={disabled}
            className="bg-foreground text-background hover:opacity-90 flex h-10 w-full items-center justify-center gap-2 rounded-lg text-[13px] font-semibold transition disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              "Submit bill"
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
