"use client";

// GIFTS, ONE LIST (Pato, 2026-11-15, MESITA-4036: "Unify gifts events in and
// out. Only one view of gift events"). Each gift is one row of Tickets' list.
//
// CALMER ROWS (MESITA-4053, Pato 2026-11-15: "put it inside a box … less
// animation. you can just display two profile images and the place image
// and with text indicate amounts … you don't need that super stupid arrow
// … maybe just an icon … like gift little bubble near profile photos"):
//
//   (Pato)(Ana)🎁 [place]  You sent $3.00MX                        2h
//                          Taken · Taquería Orinoco
//
// The sender's and receiver's 40px photos overlap by 12px with an 18px black
// gift bubble on them; the receiver is a dashed "?" while nobody took it.
// Then the place's photo, the sentence, the state and the place under it,
// the time on the right. No arrow, no struck amount, no motion beyond the tap highlight. The
// rows sit in Tickets' list box (ActivityRows). MESITA-4036's row drew
// sender → receiver with a big amount over an arrow. The row opens the
// guest's own entry for it (the Gift sent / Gift received page), else the
// place's House Card.

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
import { ActivityRows } from "./ActivityRow";

const STATE: Record<GiftTicket["status"], { label: string; tone: string }> = {
  open: { label: "Waiting for a friend", tone: "text-foreground" },
  claimed: { label: "Taken", tone: "text-green-700" },
  taken_back: { label: "Taken back", tone: "text-muted-foreground" },
};

/** When the gift last moved: taken, taken back, or sent. */
function movedAt(g: GiftTicket): string {
  return g.claimed_at ?? g.taken_back_at ?? g.created_at;
}

const FACE = "h-10 w-10 rounded-full ring-2 ring-card";

function Face({ person }: { person: GiftPerson | null }) {
  if (!person) {
    return (
      <span
        aria-hidden
        className={cn(
          FACE,
          "border-border bg-card text-muted-foreground flex items-center justify-center border-2 border-dashed text-sm",
        )}
      >
        ?
      </span>
    );
  }
  return person.photo ? (
    // A friend's own photo; plain img, as the bar's own avatar.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={person.photo} alt="" className={cn(FACE, "bg-muted object-cover")} />
  ) : (
    <span
      aria-hidden
      className={cn(
        FACE,
        "bg-muted text-foreground flex items-center justify-center text-sm font-semibold",
      )}
    >
      {person.name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

/** "You sent $3.00MX", "Ana sent you $150.00MX", "Ana sent $20.00MX". */
function sentence(g: GiftTicket): string {
  const amount = money(g.amount_cents, g.currency);
  if (g.sender.you) return `You sent ${amount}`;
  if (g.recipient?.you) return `${g.sender.name} sent you ${amount}`;
  return `${g.sender.name} sent ${amount}`;
}

export function GiftTicketRow({ g }: { g: GiftTicket }) {
  const state = STATE[g.status];
  const place = g.place?.name ?? "A Mesita place";
  const href = g.entry
    ? creditEntryPath(g.place_id, g.entry)
    : walletPlacePath(g.place_id);
  const who = (p: GiftPerson | null, none: string) =>
    p ? (p.you ? "you" : p.name) : none;
  const words = sentence(g);
  return (
    <li>
      <PushLink
        href={href}
        aria-label={`Gift, ${money(g.amount_cents, g.currency)} at ${place}, from ${who(g.sender, "someone")} to ${who(g.recipient, "nobody yet")}, ${state.label}`}
        className="hover:bg-muted/40 active:bg-muted/60 flex items-center gap-3 px-4 py-3 transition"
        data-gift-ticket={g.status}
      >
        {/* The two people, overlapping, with the gift bubble on them. */}
        <span className="relative flex shrink-0 items-center" aria-hidden>
          <Face person={g.sender} />
          <span className="-ml-3">
            <Face person={g.recipient} />
          </span>
          <span className="bg-foreground text-background ring-card absolute -right-1 -bottom-1 flex h-[18px] w-[18px] items-center justify-center rounded-full ring-2">
            <Gift className="h-[11px] w-[11px]" strokeWidth={2.25} />
          </span>
        </span>
        {g.place?.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={g.place.photo}
            alt=""
            className="bg-muted h-10 w-10 shrink-0 rounded-xl object-cover"
          />
        ) : (
          <span className="bg-muted h-10 w-10 shrink-0 rounded-xl" aria-hidden />
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold tabular-nums">
            {words}
          </span>
          {/* The state, then the place: two lines fit beside three photos
              at 375px (the sentence and the place on one line wrapped), and
              a long place name truncates before the state does. */}
          <span className="mt-0.5 block truncate text-sm">
            <span className={cn("font-medium", state.tone)}>{state.label}</span>
            <span className="text-muted-foreground"> · {place}</span>
          </span>
        </span>
        <span className="text-muted-foreground shrink-0 self-start text-sm tabular-nums">
          {timeAgo(movedAt(g))}
        </span>
      </PushLink>
    </li>
  );
}

/** Tickets' Gifts list: every gift sent or received, newest first, in the
 *  list box. */
export function GiftTickets({ gifts }: { gifts: GiftTicket[] }) {
  if (gifts.length === 0) {
    return (
      <EmptyState
        icon={Gift}
        title="No gifts yet"
        action={{ label: "Send Gift", href: CONSUMER_ROUTES.mePages.gift }}
      />
    );
  }
  return (
    <ActivityRows data-gift-tickets>
      {gifts.map((g) => (
        <GiftTicketRow key={g.gift_id} g={g} />
      ))}
    </ActivityRows>
  );
}
