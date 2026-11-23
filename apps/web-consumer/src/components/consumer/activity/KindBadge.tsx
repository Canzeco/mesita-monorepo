"use client";

// THE KIND BADGE (MESITA-4001, Pato 2026-11-14: "THE UI OF ALL THE TICKETS
// … MUST ENHANCE"): a small white disc at the photo's bottom-right with the
// ticket's kind, the pill menu's own icons (MESITA-3993), so a voucher, a
// gift and a visit stop reading alike. It sits on the muted circle too when
// a place has no photo. Decorative: the row's name says the kind in words.
// The ticket page's header (TicketParts, MESITA-4002) wears the same badge.

import {
  BadgeDollarSign,
  CalendarCheck,
  Gift,
  HandCoins,
  Send,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { Instagram } from "@/components/shared/instagram-icon";
import type { TicketRowKind } from "./ActivityRow";

const ICON: Record<TicketRowKind, LucideIcon> = {
  visit: UtensilsCrossed,
  payment: UtensilsCrossed,
  voucher: BadgeDollarSign,
  bonus: BadgeDollarSign,
  gift_in: Gift,
  gift_out: Send,
  gift_back: Send,
  gift_link: Send,
  refund: HandCoins,
  reversal: HandCoins,
  reservation: CalendarCheck,
  // An Instagram story (MESITA-4738): the Instagram mark.
  story: Instagram,
};

/** The kind's icon in an 18px white disc, for the bottom-right corner of a
 *  `relative` photo box. */
export function KindBadge({ kind }: { kind: TicketRowKind }) {
  const Icon = ICON[kind];
  return (
    <span
      aria-hidden
      className="bg-card text-foreground ring-card absolute -right-1 -bottom-1 flex h-[18px] w-[18px] items-center justify-center rounded-full ring-2"
      data-kind-badge={kind}
    >
      <Icon className="h-[11px] w-[11px]" strokeWidth={2.25} />
    </span>
  );
}
