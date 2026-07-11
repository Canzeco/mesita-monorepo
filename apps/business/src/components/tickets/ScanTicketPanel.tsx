"use client";

import { Loader2, ScanLine, X } from "lucide-react";
import { cn, errMsg } from "@/lib/utils";
import { INPUT_CLASS, TINY_LABEL_CLASS } from "@/lib/ui-classes";
import { formatConsumerCodeInput } from "@/lib/ticket-display";
import {
  FLOW_TYPE_LABELS,
  TICKET_KIND_BY_FLOW_TYPE,
  type TicketFlowType,
} from "@/lib/ticket-staff-lifecycle";
import type { SupabaseClient } from "@supabase/supabase-js";
import { apiOpenTicket } from "@/lib/api/tickets";
import { useState } from "react";
import { ScanFlowPicker } from "@/components/tickets/ScanFlowPicker";

export function ScanTicketPanel({
  projectId,
  supabase,
  onCreated,
  onError,
  onClose,
}: {
  projectId: string;
  supabase: SupabaseClient;
  onCreated: (message: string) => void;
  onError: (message: string) => void;
  onClose?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [guestCode, setGuestCode] = useState("");
  const [ticketType, setTicketType] = useState<TicketFlowType>("A");

  const scanGuest = async () => {
    const code = guestCode.trim().toUpperCase();
    const codeDigits = code.replace(/\D/g, "");

    if (!code) {
      onError("Guest code is required.");
      return;
    }
    if (codeDigits.length !== 8) {
      onError("Guest code must be 8 digits.");
      return;
    }

    setBusy(true);
    try {
      await apiOpenTicket(supabase, {
        projectId,
        consumerCode: code,
        kind: TICKET_KIND_BY_FLOW_TYPE[ticketType],
      });
      setGuestCode("");
      onCreated("Guest scanned — add the bill on their ticket.");
      onClose?.();
    } catch (e) {
      onError(errMsg(e, "Couldn't scan guest."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="border-border/60 from-card via-card to-muted/30 animate-in fade-in slide-in-from-top-2 mt-4 flex flex-col gap-5 rounded-2xl border bg-gradient-to-b p-5 shadow-sm duration-200"
      onSubmit={(e) => {
        e.preventDefault();
        void scanGuest();
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
            <ScanLine className="h-5 w-5" strokeWidth={2} />
          </div>
          <div>
            <p className="font-display text-[15px] font-semibold tracking-tight">
              Scan guest
            </p>
            <p className="text-muted-foreground mt-0.5 max-w-sm text-[12px] leading-snug">
              Link their Mesita code. Billing happens on the ticket row next.
            </p>
          </div>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-muted-foreground hover:text-foreground border-border/60 hover:border-border flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <label className="block">
        <span className={TINY_LABEL_CLASS}>Guest code</span>
        <input
          value={guestCode}
          onChange={(e) =>
            setGuestCode(formatConsumerCodeInput(e.target.value))
          }
          placeholder="0000-0000"
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          className={cn(
            INPUT_CLASS,
            "mt-2 h-12 text-center font-mono text-lg tracking-[0.2em]",
          )}
        />
      </label>

      <div>
        <span className={TINY_LABEL_CLASS}>Flow</span>
        <p className="text-muted-foreground mt-1 mb-2 text-[11px]">
          {FLOW_TYPE_LABELS[ticketType]}
        </p>
        <ScanFlowPicker value={ticketType} onChange={setTicketType} />
      </div>

      <button
        type="submit"
        disabled={busy}
        className="bg-primary text-primary-foreground flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold shadow-sm transition hover:opacity-92 disabled:opacity-50"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ScanLine className="h-4 w-4" strokeWidth={2.5} />
        )}
        Start visit
      </button>
    </form>
  );
}
