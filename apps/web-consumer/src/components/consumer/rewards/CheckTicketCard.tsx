"use client";

// The live ticket card on the Rewards "New" tab (Tickets v2, MESITA-806).
// The QR IS the ticket: it encodes mesita.ai/check/<check_code>, the public
// page where staff verify, bill, and close the visit. The card tracks the
// visit live off ticket columns alone — scanned ✓ from first_scanned_at,
// amounts once billed, the story step when opted in.

import { useState } from "react";
import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";
import { BadgeCheck, Loader2, ScanLine, X } from "lucide-react";

import { formatCurrency } from "@/lib/api/profile";
import {
  checkUrlForCode,
  type ConsumerTicketRow,
} from "@/lib/api/tickets";
import { cn } from "@/lib/utils";

const STATUS_LINE: Record<string, string> = {
  open: "Show this QR — staff scan it to verify and start your visit.",
  awaiting_story: "Bill is in. Post your tagged story so the place can approve it.",
  awaiting_payment_confirm: "All set — pay the discounted total at the table.",
};

export function CheckTicketCard({
  ticket,
  onCancel,
}: {
  ticket: ConsumerTicketRow;
  onCancel: (ticketId: string) => Promise<void>;
}) {
  const [cancelling, setCancelling] = useState(false);
  const placeName = ticket.place?.name ?? "Partner place";
  const photo = ticket.place?.photos?.[0] ?? null;
  const scanned = ticket.first_scanned_at != null;
  const billed = (ticket.total_cents ?? 0) > 0;

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await onCancel(ticket.id);
    } finally {
      setCancelling(false);
    }
  };

  return (
    <section className="border-border bg-card overflow-hidden rounded-[24px] border">
      {/* Place header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        {photo ? (
          <Image
            src={photo}
            alt=""
            width={40}
            height={40}
            className="size-10 rounded-xl object-cover"
          />
        ) : (
          <span className="bg-muted grid size-10 place-items-center rounded-xl">
            <ScanLine className="text-muted-foreground size-4" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] leading-tight font-bold">{placeName}</p>
          <p className="text-muted-foreground mt-0.5 flex items-center gap-1 text-[11px]">
            {scanned ? (
              <>
                <BadgeCheck className="size-3 text-emerald-600" /> Scanned by the place
              </>
            ) : (
              "Not scanned yet"
            )}
          </p>
        </div>
        {ticket.status === "open" ? (
          <button
            type="button"
            onClick={() => void handleCancel()}
            disabled={cancelling}
            aria-label="Cancel ticket"
            className="text-muted-foreground hover:text-foreground grid size-8 place-items-center rounded-full transition"
          >
            {cancelling ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <X className="size-4" />
            )}
          </button>
        ) : null}
      </div>

      <div className="flex flex-col items-center gap-3 px-4 py-4">
        {ticket.check_code ? (
          <div className="w-full max-w-[220px] rounded-[20px] bg-white p-3.5 shadow-[0_10px_26px_-14px_rgba(120,20,40,0.45)]">
            <QRCodeSVG
              value={checkUrlForCode(ticket.check_code)}
              size={220}
              className="h-auto w-full"
              bgColor="#ffffff"
              fgColor="#2b1233"
              level="M"
              marginSize={0}
            />
          </div>
        ) : null}

        <p className="text-muted-foreground max-w-[30ch] text-center text-[12px] leading-snug">
          {STATUS_LINE[ticket.status] ?? ticket.status}
        </p>

        {billed ? (
          <div
            className={cn(
              "bg-pink-gradient shadow-glow w-full rounded-xl p-3.5 text-center text-white",
            )}
          >
            <p className="text-[10px] font-bold tracking-[0.14em] uppercase opacity-85">
              {ticket.discount_percent ?? 0}% off applied
            </p>
            <p className="font-display mt-0.5 text-2xl leading-none font-bold">
              {formatCurrency(ticket.total_cents ?? 0)}
            </p>
            <p className="mt-1 text-[11px] opacity-90">
              to pay at the table
              {ticket.discount_cents
                ? ` — you save ${formatCurrency(ticket.discount_cents)}`
                : ""}
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
