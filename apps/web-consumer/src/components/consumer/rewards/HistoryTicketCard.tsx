"use client";

// History row for the Rewards tab (Tickets v2, MESITA-806) — ticket-driven,
// so cancelled-before-billing visits appear too (the old notification list
// couldn't see them). Billed tickets tap through to the existing detail;
// unbilled-cancelled ones have no receipt to show, so they don't link.

import Image from "next/image";
import { useRouter } from "next/navigation";
import { CheckCircle2, ScanLine, XCircle } from "lucide-react";

import { formatCurrency } from "@/lib/api/profile";
import type { ConsumerTicketRow } from "@/lib/api/tickets";
import { formatTicketVisitDate } from "@/lib/api/pay";
import { rewardsTicketPath } from "@/lib/consumer-route-contract";
import { cn } from "@/lib/utils";

export function HistoryTicketCard({ ticket }: { ticket: ConsumerTicketRow }) {
  const router = useRouter();
  const placeName = ticket.place?.name ?? "Partner place";
  const photo = ticket.place?.photos?.[0] ?? null;
  const cancelled = ticket.status === "cancelled";
  const billed = (ticket.total_cents ?? 0) > 0;
  const linkable = billed && !cancelled;

  const body = (
    <>
      {photo ? (
        <Image
          src={photo}
          alt=""
          width={44}
          height={44}
          className="size-11 shrink-0 rounded-xl object-cover"
        />
      ) : (
        <span className="bg-muted grid size-11 shrink-0 place-items-center rounded-xl">
          <ScanLine className="text-muted-foreground size-4" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] leading-tight font-bold">{placeName}</p>
        <p className="text-muted-foreground mt-0.5 text-[11px]">
          {formatTicketVisitDate(ticket.revealed_at ?? ticket.cancelled_at ?? ticket.created_at) ?? "—"}
        </p>
      </div>
      <div className="shrink-0 text-right">
        {cancelled ? (
          <span className="text-muted-foreground flex items-center gap-1 text-[11.5px] font-semibold">
            <XCircle className="size-3.5" /> Cancelled
          </span>
        ) : (
          <>
            <span className="flex items-center justify-end gap-1 text-[11.5px] font-semibold text-emerald-700">
              <CheckCircle2 className="size-3.5" /> Paid
            </span>
            {ticket.discount_cents ? (
              <span className="text-muted-foreground block text-[11px]">
                saved {formatCurrency(ticket.discount_cents)}
              </span>
            ) : null}
          </>
        )}
      </div>
    </>
  );

  const className = cn(
    "border-border bg-card flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3",
    linkable && "text-left transition active:scale-[0.99]",
    cancelled && "opacity-70",
  );

  return linkable ? (
    <button
      type="button"
      onClick={() => router.push(rewardsTicketPath(ticket.id), { scroll: false })}
      className={className}
    >
      {body}
    </button>
  ) : (
    <div className={className}>{body}</div>
  );
}
