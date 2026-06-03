"use client";

import { Loader2, Plus } from "lucide-react";
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

export function ScanTicketPanel({
  venueId,
  supabase,
  onCreated,
  onError,
  onClose,
}: {
  venueId: string;
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
        venueId,
        consumerCode: code,
        kind: TICKET_KIND_BY_FLOW_TYPE[ticketType],
      });
      setGuestCode("");
      onCreated("Guest scanned — enter the bill on their ticket.");
      onClose?.();
    } catch (e) {
      onError(errMsg(e, "Couldn't scan guest."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="border-border/70 bg-card/80 mt-3 flex flex-col gap-4 rounded-2xl border p-4 shadow-sm backdrop-blur-sm md:p-5"
      onSubmit={(e) => {
        e.preventDefault();
        void scanGuest();
      }}
    >
      <p className="text-muted-foreground text-[12px] leading-snug">
        Scan the guest&apos;s code to start the visit. Billing is a separate step on
        each ticket.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label>
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
              "mt-1.5 h-11 font-mono text-base tracking-widest",
            )}
          />
        </label>
        <label>
          <span className={TINY_LABEL_CLASS}>Flow</span>
          <select
            value={ticketType}
            onChange={(e) => setTicketType(e.target.value as TicketFlowType)}
            className={cn(INPUT_CLASS, "mt-1.5 h-11 text-sm")}
          >
            {(Object.keys(FLOW_TYPE_LABELS) as TicketFlowType[]).map((t) => (
              <option key={t} value={t}>
                {t} · {FLOW_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex items-center justify-end gap-3">
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-sm font-medium transition"
          >
            Cancel
          </button>
        ) : null}
        <button
          type="submit"
          disabled={busy}
          className="bg-foreground text-background hover:opacity-90 flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" strokeWidth={2.5} />
          )}
          Scan guest
        </button>
      </div>
    </form>
  );
}
