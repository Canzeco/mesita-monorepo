// GIFT TICKETS (Pato, 2026-11-15, MESITA-4036: "Unify gifts events in and
// out. Only one view of gift events. Left side is sender and right side is
// receiver"): one ticket per wallet_gifts row the guest sent or received,
// with both people's first name and photo. consumer-web-get-wallet reads the
// rows; this module shapes them, so the rules are pinned by
// wallet-gifts.test.ts.
//
// WHO SHOWS: a person is their first name (or the Me header's fallback) and
// their photo; Public profile off (appear_anonymous) hides the photo, as
// Social does (MESITA-2590, MESITA-2612). Nothing else about the friend
// leaves the server. The receiver is null until someone takes the gift.

import { MEMBER_FALLBACK_NAME } from "./place-activity.ts";

export type GiftRow = {
  id: string;
  sender_id: string;
  recipient_id: string | null;
  place_id: string;
  amount_cents: number;
  currency: string;
  status: string;
  created_at: string;
  claimed_at: string | null;
  taken_back_at: string | null;
};

export type PersonRow = {
  id: string;
  first_name: string | null;
  avatar_url: string | null;
  appear_anonymous: boolean | null;
};

/** The guest's own ledger line for a gift: its Loyalty Card entry page.
 *  `available_at` is when a received gift's credit turns Available
 *  (MESITA-4066: "Taken · ready in 1 hr"). */
export type GiftEntryRow = { gift_id: string; kind: string; created_at: string; available_at?: string | null };

export type GiftPerson = { name: string; photo: string | null; you: boolean };

export type GiftTicket = {
  gift_id: string;
  place_id: string;
  amount_cents: number;
  currency: string;
  /** open: nobody took it yet · claimed: a friend took it · taken_back: the
   *  sender took it back before anyone did. */
  status: "open" | "claimed" | "taken_back";
  role: "sender" | "recipient";
  created_at: string;
  claimed_at: string | null;
  taken_back_at: string | null;
  sender: GiftPerson;
  recipient: GiftPerson | null;
  /** The guest's ledger line for it (its entry page), null when none.
   *  `available_at`: when that line's credit turns Available (a received
   *  gift's hold), null when it has none (MESITA-4066). */
  entry: { kind: string; at: string; available_at: string | null } | null;
};

const STATUSES = new Set(["open", "claimed", "taken_back"]);

export function giftPerson(
  id: string,
  viewerId: string,
  people: Map<string, PersonRow>,
): GiftPerson {
  const p = people.get(id);
  return {
    name: p?.first_name?.trim() || MEMBER_FALLBACK_NAME,
    photo: p && p.appear_anonymous !== true ? (p.avatar_url ?? null) : null,
    you: id === viewerId,
  };
}

/** Every gift the viewer sent or received, newest first. A row with an
 *  unknown status, or that is not the viewer's, is dropped. The viewer's
 *  latest ledger line for the gift is its entry page. */
export function giftTickets(
  rows: GiftRow[],
  people: PersonRow[],
  entries: GiftEntryRow[],
  viewerId: string,
): GiftTicket[] {
  const byId = new Map(people.map((p) => [p.id, p]));
  const latest = new Map<string, GiftEntryRow>();
  for (const e of entries) {
    const had = latest.get(e.gift_id);
    if (!had || Date.parse(e.created_at) > Date.parse(had.created_at)) latest.set(e.gift_id, e);
  }
  return rows
    .filter((g) =>
      STATUSES.has(g.status) && (g.sender_id === viewerId || g.recipient_id === viewerId)
    )
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    .map((g) => {
      const e = latest.get(g.id);
      return {
        gift_id: g.id,
        place_id: g.place_id,
        amount_cents: g.amount_cents,
        currency: g.currency,
        status: g.status as GiftTicket["status"],
        role: g.sender_id === viewerId ? "sender" : "recipient",
        created_at: g.created_at,
        claimed_at: g.claimed_at,
        taken_back_at: g.taken_back_at,
        sender: giftPerson(g.sender_id, viewerId, byId),
        recipient: g.recipient_id ? giftPerson(g.recipient_id, viewerId, byId) : null,
        entry: e ? { kind: e.kind, at: e.created_at, available_at: e.available_at ?? null } : null,
      };
    });
}

/** Everyone a gift list names, but the viewer, for one consumers read. */
export function giftPeopleIds(rows: GiftRow[]): string[] {
  return [
    ...new Set(rows.flatMap((g) => [g.sender_id, ...(g.recipient_id ? [g.recipient_id] : [])])),
  ];
}
