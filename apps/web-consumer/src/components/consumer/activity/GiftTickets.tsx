"use client";

// GIFTS, ONE LIST (Pato, 2026-11-15, MESITA-4036: "Unify gifts events in and
// out. Only one view of gift events. Left side is sender and right side is
// receiver ... if nobody has taken then waiting. Or if someone has claimed
// then like show ... it must look like X and Y"). Each gift is one row of
// Tickets' list, sender → receiver:
//
//   (Pato)  ────── $200 ──────▶  (Ana)
//    You     Taquería Orinoco      Ana
//   Taken                                Nov 14
//
// Nobody took it yet: the right is a dashed "?" and the arrow is dashed,
// "Waiting for a friend". Taken back: the amount is struck, the right reads
// Nobody. The row opens the guest's own entry for it (the Gift sent / Gift
// received page), else the place's House Card.

import { Gift } from "lucide-react";
import { PushLink } from "@/components/consumer/nav/PushLink";
import { EmptyState } from "@/components/shared/EmptyState";
import { money, type GiftPerson, type GiftTicket } from "@/lib/api/wallet";
import {
  CONSUMER_ROUTES,
  creditEntryPath,
  walletPlacePath,
} from "@/lib/consumer-route-contract";
import { timeAgo } from "@/lib/time-ago";
import { cn } from "@/lib/utils";

const STATE: Record<GiftTicket["status"], { label: string; tone: string }> = {
  open: { label: "Waiting for a friend", tone: "text-foreground" },
  claimed: { label: "Taken", tone: "text-green-700" },
  taken_back: { label: "Taken back", tone: "text-muted-foreground" },
};

/** When the gift last moved: taken, taken back, or sent. */
function movedAt(g: GiftTicket): string {
  return g.claimed_at ?? g.taken_back_at ?? g.created_at;
}

function Face({ person }: { person: GiftPerson }) {
  return person.photo ? (
    // A friend's own photo; plain img, as the bar's own avatar.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={person.photo}
      alt=""
      className="bg-muted h-12 w-12 rounded-full object-cover"
    />
  ) : (
    <span
      aria-hidden
      className="bg-muted text-foreground flex h-12 w-12 items-center justify-center rounded-full text-base font-semibold"
    >
      {person.name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

function Side({
  person,
  ghost,
}: {
  person: GiftPerson | null;
  /** The word under the dashed "?" when nobody took it. */
  ghost: string;
}) {
  return (
    <span className="flex w-16 shrink-0 flex-col items-center gap-1">
      {person ? (
        <Face person={person} />
      ) : (
        <span
          aria-hidden
          className="border-border text-muted-foreground flex h-12 w-12 items-center justify-center rounded-full border-2 border-dashed text-base"
        >
          ?
        </span>
      )}
      <span
        className={cn(
          "max-w-full truncate text-xs font-medium",
          person ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {person ? (person.you ? "You" : person.name) : ghost}
      </span>
    </span>
  );
}

export function GiftTicketRow({ g }: { g: GiftTicket }) {
  const state = STATE[g.status];
  const nobody = !g.recipient;
  const back = g.status === "taken_back";
  const place = g.place?.name ?? "A Mesita place";
  const href = g.entry
    ? creditEntryPath(g.place_id, g.entry)
    : walletPlacePath(g.place_id);
  const who = (p: GiftPerson | null, none: string) =>
    p ? (p.you ? "you" : p.name) : none;
  return (
    <li>
      <PushLink
        href={href}
        aria-label={`Gift, ${money(g.amount_cents, g.currency)} at ${place}, from ${who(g.sender, "someone")} to ${who(g.recipient, "nobody yet")}, ${state.label}`}
        className="hover:bg-muted/40 active:bg-muted/60 block px-5 py-4 transition"
        data-gift-ticket={g.status}
      >
        <span className="flex items-center gap-2">
          <Side person={g.sender} ghost="" />
          <span className="flex min-w-0 flex-1 flex-col items-center">
            <span
              className={cn(
                "text-lg font-semibold tabular-nums",
                back && "text-muted-foreground line-through",
              )}
            >
              {money(g.amount_cents, g.currency)}
            </span>
            {/* The arrow: solid once someone took it, dashed while nobody did. */}
            <span aria-hidden className="relative my-1 block h-0 w-full">
              <span
                className={cn(
                  "block w-full border-t-2",
                  nobody ? "border-border border-dashed" : "border-foreground",
                )}
              />
              <span
                className={cn(
                  "absolute -top-[7px] -right-0.5 text-xs leading-none",
                  nobody ? "text-border" : "text-foreground",
                )}
              >
                ▶
              </span>
            </span>
            <span className="text-muted-foreground max-w-full truncate text-xs">
              {place}
            </span>
          </span>
          <Side person={g.recipient} ghost={back ? "Nobody" : "Waiting"} />
        </span>
        <span className="mt-2 flex items-center justify-between text-sm">
          <span className={cn("font-medium", state.tone)}>{state.label}</span>
          <span className="text-muted-foreground tabular-nums">
            {timeAgo(movedAt(g))}
          </span>
        </span>
      </PushLink>
    </li>
  );
}

/** Tickets' Gifts list: every gift sent or received, newest first. */
export function GiftTickets({ gifts }: { gifts: GiftTicket[] }) {
  if (gifts.length === 0) {
    return (
      <EmptyState
        icon={Gift}
        title="No gifts yet"
        action={{ label: "Send Credits", href: CONSUMER_ROUTES.mePages.gift }}
      />
    );
  }
  return (
    <ul className="divide-border -mx-5 divide-y" data-gift-tickets>
      {gifts.map((g) => (
        <GiftTicketRow key={g.gift_id} g={g} />
      ))}
    </ul>
  );
}
