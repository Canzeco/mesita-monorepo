"use client";

// GIFTS, ONE LIST (Pato, 2026-11-15, MESITA-4036: "Unify gifts events in and
// out. Only one view of gift events"). Each gift is one row of Tickets' list.
//
// THE OTHER TABS' ROW (Pato, 2026-11-24, MESITA-4911: "this looks like
// shit"): one 48px mark, so every row starts on the same edge, two lines,
// the money on the right. It drew two faces AND the place's photo, the
// amount inside a sentence, and Take back on a line of its own:
//
//   (place)🎁 Taquería Orinoco          $100.00
//             Waiting for a friend · 1d  (Take back)
//   (place)👤 Taquería Orinoco          −$200.00
//             To Ana · 4d                  Taken
//   (place)↩  Taquería Orinoco           $200.00    (quiet)
//             Sent · 4d               Taken back
//
// The badge is the other person's face, else the gift (an undo once taken
// back). On a place's own Loyalty Card the mark is the person and the name
// line says who. The row opens the gift's own page,
// /me/tickets/gift/<giftId> (MESITA-4066), which keeps the two faces
// (GiftFaces); a receiver's credit still on hold reads "Taken · ready in
// 1 hr" (lib/gift-ticket.ts).

import { Gift, Undo2 } from "lucide-react";
import { PushLink } from "@/components/consumer/nav/PushLink";
import { EmptyState } from "@/components/shared/EmptyState";
import { money, type GiftPerson, type GiftTicket } from "@/lib/api/wallet";
import { CONSUMER_ROUTES, giftTicketPath } from "@/lib/consumer-route-contract";
import { giftHoldUntil, giftState } from "@/lib/gift-ticket";
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
  row: { face: "h-12 w-12 text-base", overlap: "-ml-4", bubble: "h-5 w-5", icon: "h-[11px] w-[11px]" },
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

/** The other person, from where the guest stands: null while nobody is. */
function otherPerson(g: GiftTicket): GiftPerson | null {
  if (!g.sender.you) return g.sender;
  return g.status === "taken_back" ? null : g.recipient;
}

/** "To Ana", "From Ana", "Waiting for a friend", "Sent" (taken back). */
function whoLine(g: GiftTicket): string {
  if (!g.sender.you) return `From ${g.sender.name}`;
  if (g.status === "open") return giftState(g).label;
  return g.recipient && g.status === "claimed" ? `To ${g.recipient.name}` : "Sent";
}

const MARK = "bg-muted text-foreground flex h-12 w-12 items-center justify-center rounded-full object-cover";

/** The row's one 48px mark: the place under the person's badge, or on the
 *  place's own page the person alone. */
function GiftMark({ g, showPlace }: { g: GiftTicket; showPlace: boolean }) {
  const back = g.status === "taken_back";
  const other = otherPerson(g);
  const Icon = back ? Undo2 : Gift;
  if (!showPlace) {
    return other ? (
      <span className="shrink-0">
        <GiftFace person={other} size="h-12 w-12 text-base" />
      </span>
    ) : (
      <span className={cn(MARK, "shrink-0", back && "text-muted-foreground")} aria-hidden>
        <Icon className="h-5 w-5" />
      </span>
    );
  }
  return (
    <span className="relative h-12 w-12 shrink-0" aria-hidden>
      {g.place?.photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={g.place.photo} alt="" className={cn(MARK, back && "opacity-50 grayscale")} />
      ) : (
        <span className={MARK} />
      )}
      <span className="absolute -right-1 -bottom-1">
        {other ? (
          <GiftFace person={other} size="h-5 w-5 type-meta" />
        ) : (
          <span className="bg-card text-foreground ring-card flex h-5 w-5 items-center justify-center rounded-full ring-2">
            <Icon className="h-3 w-3" strokeWidth={2.25} />
          </span>
        )}
      </span>
    </span>
  );
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
  const back = g.status === "taken_back";
  const who = whoLine(g);
  const ago = timeAgo(movedAt(g));
  // "Taken · ready in 1 hr" is too long for the right column: it joins the
  // grey line.
  const held = giftHoldUntil(g) !== null;
  const facts = [showPlace ? who : "", held ? state.label : "", ago];
  const sign =
    g.status !== "claimed" ? "" : g.sender.you ? "−" : g.recipient?.you ? "+" : "";
  // TAKE BACK ON THE ROW (MESITA-4324, Pato: "remove the waiting for a
  // friend list … it must be expressed in the gift tickets"), under the
  // amount. The row's link is stretched behind the words, so the pill is its
  // sibling, never inside it (a link cannot hold a button).
  const canTakeBack = g.status === "open" && g.sender.you && onChanged !== undefined;
  return (
    <li className="relative">
      <PushLink
        href={giftTicketPath(g.gift_id)}
        aria-label={`Gift, ${money(g.amount_cents, g.currency)} at ${place}, ${who}, ${state.label}`}
        className="hover:bg-muted/40 active:bg-muted/60 absolute inset-0 transition"
        data-gift-ticket={g.status}
      />
      <div className="pointer-events-none relative flex items-center gap-4 px-4 py-4">
        <GiftMark g={g} showPlace={showPlace} />
        {/* Lines wrap and the row grows; nothing truncates (MESITA-4343). */}
        <span className="min-w-0 flex-1">
          <span className={cn("block text-base font-semibold break-words", back && "text-muted-foreground")}>
            {showPlace ? place : who}
          </span>
          <span className="text-muted-foreground mt-1 block text-sm break-words tabular-nums">
            {facts.filter(Boolean).join(" · ")}
          </span>
        </span>
        <div className="flex shrink-0 flex-col items-end gap-1 text-right">
          <span
            className={cn(
              "text-base font-semibold tabular-nums",
              back ? "text-muted-foreground" : sign === "+" && "text-green-700",
            )}
          >
            {sign}
            {money(g.amount_cents, g.currency)}
          </span>
          {canTakeBack ? (
            <div className="pointer-events-auto">
              <TakeBack g={g} onDone={onChanged} variant="pill" />
            </div>
          ) : g.status === "open" || held ? null : (
            <span className={cn("text-sm font-semibold", GIFT_TONE[state.tone])}>{state.label}</span>
          )}
        </div>
      </div>
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
