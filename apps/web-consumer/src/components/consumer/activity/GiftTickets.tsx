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
// A gift taken back has no receiver and never will (MESITA-4084, Pato
// 2026-11-15: "why the ???? … it was taken back"): the sender's photo alone,
// the money back with them, under an undo bubble.
// Then the place's photo, the sentence, the state and the place under it,
// the time on the right. No arrow, no struck amount, no motion beyond the tap highlight. The
// rows sit in Tickets' list box (ActivityRows). MESITA-4036's row drew
// sender → receiver with a big amount over an arrow. The row opens the
// gift's own page, /me/tickets/gift/<giftId> (MESITA-4066), which draws this
// picture larger; a receiver's credit still on hold reads "Taken · ready in
// 1 hr" (lib/gift-ticket.ts).

import { Gift, Undo2 } from "lucide-react";
import { PushLink } from "@/components/consumer/nav/PushLink";
import { EmptyState } from "@/components/shared/EmptyState";
import { money, type GiftPerson, type GiftTicket } from "@/lib/api/wallet";
import { CONSUMER_ROUTES, giftTicketPath } from "@/lib/consumer-route-contract";
import { giftState } from "@/lib/gift-ticket";
import { timeAgo } from "@/lib/time-ago";
import { cn } from "@/lib/utils";
import { ActivityRows } from "./ActivityRow";
import { TakeBack } from "./GiftTakeBack";

export const GIFT_TONE = {
  green: "text-green-700",
  ink: "text-foreground",
  grey: "text-muted-foreground",
} as const;

/** When the gift last moved: taken, taken back, or sent. */
export function movedAt(g: GiftTicket): string {
  return g.claimed_at ?? g.taken_back_at ?? g.created_at;
}

const FACE = "rounded-full ring-2 ring-card";

/** A person's round photo, their initial, or a dashed "?" while nobody took
 *  the gift. `size` is its box: 40px in the row, 64px on the gift page. */
export function GiftFace({
  person,
  size = "h-10 w-10 text-sm",
}: {
  person: GiftPerson | null;
  size?: string;
}) {
  if (!person) {
    return (
      <span
        aria-hidden
        className={cn(
          FACE,
          size,
          "border-border bg-card text-muted-foreground flex items-center justify-center border-2 border-dashed",
        )}
      >
        ?
      </span>
    );
  }
  return person.photo ? (
    // A friend's own photo; plain img, as the bar's own avatar.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={person.photo} alt="" className={cn(FACE, size, "bg-muted object-cover")} />
  ) : (
    <span
      aria-hidden
      className={cn(
        FACE,
        size,
        "bg-muted text-foreground flex items-center justify-center font-semibold",
      )}
    >
      {person.name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

const FACES = {
  row: { face: "h-10 w-10 text-sm", overlap: "-ml-3", bubble: "h-[18px] w-[18px]", icon: "h-[11px] w-[11px]" },
  page: { face: "h-16 w-16 text-xl", overlap: "-ml-4", bubble: "h-6 w-6", icon: "h-3.5 w-3.5" },
} as const;

/** The gift's people: sender and receiver overlapping under a gift bubble,
 *  or, once taken back, the sender alone under an undo bubble. */
export function GiftFaces({ g, size = "row" }: { g: GiftTicket; size?: keyof typeof FACES }) {
  const f = FACES[size];
  const back = g.status === "taken_back";
  const Icon = back ? Undo2 : Gift;
  return (
    <span className="relative flex shrink-0 items-center" aria-hidden>
      <GiftFace person={g.sender} size={f.face} />
      {back ? null : (
        <span className={f.overlap}>
          <GiftFace person={g.recipient} size={f.face} />
        </span>
      )}
      <span
        className={cn(
          "bg-foreground text-background ring-card absolute -right-1 -bottom-1 flex items-center justify-center rounded-full ring-2",
          f.bubble,
        )}
      >
        <Icon className={f.icon} strokeWidth={2.25} />
      </span>
    </span>
  );
}

/** "You sent $3.00MX", "Ana sent you $150.00MX", "Ana sent $20.00MX". */
export function giftSentence(g: GiftTicket): string {
  const amount = money(g.amount_cents, g.currency);
  if (g.sender.you) return `You sent ${amount}`;
  if (g.recipient?.you) return `${g.sender.name} sent you ${amount}`;
  return `${g.sender.name} sent ${amount}`;
}

export function GiftTicketRow({
  g,
  showPlace = true,
  onChanged,
}: {
  g: GiftTicket;
  /** False on a place's own Loyalty Card page, where the name repeats. */
  showPlace?: boolean;
  /** Read the wallet again after a Take back from the row. */
  onChanged?: () => void;
}) {
  const state = giftState(g);
  const place = g.place?.name ?? "A Mesita place";
  const who = (p: GiftPerson | null, none: string) =>
    p ? (p.you ? "you" : p.name) : none;
  const words = giftSentence(g);
  // TAKE BACK ON THE ROW (MESITA-4324, Pato: "remove the waiting for a
  // friend list … it must be expressed in the gift tickets"): a gift you
  // sent that nobody took yet carries the small grey Take back where the
  // time was; the time moves to the state line. The pill is the link's
  // sibling, never inside it (a link cannot hold a button).
  const canTakeBack = g.status === "open" && g.sender.you && onChanged !== undefined;
  const ago = timeAgo(movedAt(g));
  return (
    <li className="flex items-center gap-2 pr-4">
      <PushLink
        href={giftTicketPath(g.gift_id)}
        aria-label={`Gift, ${money(g.amount_cents, g.currency)} at ${place}, from ${who(g.sender, "someone")}${g.status === "taken_back" ? "" : ` to ${who(g.recipient, "nobody yet")}`}, ${state.label}`}
        className={cn("hover:bg-muted/40 active:bg-muted/60 flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 transition", !canTakeBack && "-mr-4 pr-4")}
        data-gift-ticket={g.status}
      >
        <GiftFaces g={g} />
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
          {/* The state, then the place (or the time, beside Take back): two
              lines fit beside three photos at 375px, and a long place name
              truncates before the state does. */}
          <span className="mt-0.5 block truncate text-sm">
            <span className={cn("font-medium", GIFT_TONE[state.tone])}>{state.label}</span>
            {canTakeBack ? (
              <span className="text-muted-foreground tabular-nums"> · {ago}</span>
            ) : showPlace ? (
              <span className="text-muted-foreground"> · {place}</span>
            ) : null}
          </span>
        </span>
        {canTakeBack ? null : (
          <span className="text-muted-foreground shrink-0 self-start text-sm tabular-nums">{ago}</span>
        )}
      </PushLink>
      {canTakeBack ? <TakeBack g={g} onDone={onChanged} variant="pill" /> : null}
    </li>
  );
}

/** Waiting gifts first (the ones you can act on), then the rest; each part
 *  keeps the read's order, newest first (MESITA-4324). */
export function giftOrder(gifts: GiftTicket[]): GiftTicket[] {
  return [...gifts.filter((g) => g.status === "open"), ...gifts.filter((g) => g.status !== "open")];
}

/** Tickets' Gifts list: every gift sent or received, waiting ones first, in
 *  the list box. */
export function GiftTickets({
  gifts,
  showPlace = true,
  onChanged,
}: {
  gifts: GiftTicket[];
  showPlace?: boolean;
  onChanged?: () => void;
}) {
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
      {giftOrder(gifts).map((g) => (
        <GiftTicketRow key={g.gift_id} g={g} showPlace={showPlace} onChanged={onChanged} />
      ))}
    </ActivityRows>
  );
}
