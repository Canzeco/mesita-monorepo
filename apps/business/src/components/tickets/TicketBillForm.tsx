"use client";

import { Loader2, Receipt } from "lucide-react";
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
      className="border-primary/20 bg-primary/[0.04] ml-11 flex flex-col gap-3 rounded-xl border p-3.5 sm:ml-12"
      onSubmit={(e) => {
        e.preventDefault();
        void submitBill();
      }}
    >
      <div className="flex items-center gap-2">
        <Receipt className="text-primary h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
        <p className="text-foreground text-[12px] font-semibold">Enter bill</p>
      </div>
      <div
        className={cn(
          "grid gap-2",
          isCashbackFlow ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2",
        )}
      >
        <label className="min-w-0">
          <span className={TINY_LABEL_CLASS}>Subtotal</span>
          <div className="relative mt-1">
            <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[10px] font-medium">
              {venueCurrency}
            </span>
            <input
              value={subtotalText}
              onChange={(e) => setSubtotalText(e.target.value)}
              placeholder="850"
              inputMode="decimal"
              className={cn(INPUT_CLASS, "h-10 bg-card pl-12 text-sm tabular-nums")}
            />
          </div>
        </label>
        {isCashbackFlow ? (
          <label className="min-w-0">
            <span className={TINY_LABEL_CLASS}>Tip</span>
            <div className="relative mt-1">
              <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[10px] font-medium">
                {venueCurrency}
              </span>
              <input
                value={tipText}
                onChange={(e) => setTipText(e.target.value)}
                placeholder="0"
                inputMode="decimal"
                className={cn(INPUT_CLASS, "h-10 bg-card pl-12 text-sm tabular-nums")}
              />
            </div>
          </label>
        ) : null}
        <div
          className={cn(
            "flex items-end",
            isCashbackFlow ? "col-span-2 sm:col-span-1" : "col-span-1",
          )}
        >
          <button
            type="submit"
            disabled={disabled}
            className="bg-foreground text-background hover:opacity-90 flex h-10 w-full items-center justify-center gap-2 rounded-full text-[13px] font-semibold transition disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              "Send to guest"
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
