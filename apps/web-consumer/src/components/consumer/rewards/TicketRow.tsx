"use client";

// Compact ticket row (MESITA-857) — the wallet's Pending and History lists
// are just doors into THE ticket screen now, so one row serves both: thumb,
// place, one-line status, and the money once there is money. The big in-list
// QR card died with the modal; the QR lives on the ticket.

import Image from "next/image";
import { ChevronRight, ScanLine } from "lucide-react";

import { formatCurrency } from "@/lib/api/profile";
import type { ConsumerTicketRow } from "@/lib/api/tickets";
import { cn } from "@/lib/utils";

function caption(t: ConsumerTicketRow): string {
  switch (t.status) {
    case "open":
      return t.first_scanned_at
        ? "Scanned — visit started"
        : "Open — show your QR";
    case "awaiting_payment_confirm":
      return "Pay the discounted total";
    case "revealed":
      return t.discount_percent ? `${t.discount_percent}% off` : "Completed";
    case "cancelled":
      return "Cancelled";
    default:
      return t.status;
  }
}

export function TicketRow({
  ticket,
  onOpen,
}: {
  ticket: ConsumerTicketRow;
  onOpen: () => void;
}) {
  const photo = ticket.place?.photos?.[0] ?? null;
  const closed = ticket.status === "revealed" || ticket.status === "cancelled";
  const saved = ticket.status === "revealed" ? (ticket.discount_cents ?? 0) : 0;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="border-border bg-card hover:bg-muted/40 flex min-h-16 w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition active:scale-[0.995]"
    >
      {photo ? (
        <Image
          src={photo}
          alt=""
          width={48}
          height={48}
          className={cn(
            "size-12 shrink-0 rounded-xl object-cover",
            ticket.status === "cancelled" && "opacity-50 grayscale",
          )}
        />
      ) : (
        <span className="bg-muted text-muted-foreground grid size-12 shrink-0 place-items-center rounded-xl">
          <ScanLine className="size-5" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="text-foreground block truncate text-[13.5px] leading-tight font-bold">
          {ticket.place?.name ?? "Partner place"}
        </span>
        <span
          className={cn(
            "mt-0.5 block truncate text-[11.5px]",
            !closed && ticket.first_scanned_at
              ? "font-semibold text-emerald-700"
              : "text-muted-foreground",
          )}
        >
          {caption(ticket)}
        </span>
      </span>
      {saved > 0 ? (
        <span className="shrink-0 text-[13.5px] font-extrabold text-emerald-700 tabular-nums">
          −{formatCurrency(saved)}
        </span>
      ) : (
        <ChevronRight className="text-muted-foreground size-4 shrink-0" />
      )}
    </button>
  );
}
