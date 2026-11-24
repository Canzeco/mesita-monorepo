// Admin › VIP (MESITA-2550, MESITA-4766): the pure half of
// admin-web-list-guests. A guest's Class is automatic (an invitation code,
// MESITA-4849); no Edge Function sets a Class, Plan, note or cap for a guest
// (MESITA-4649 retired the one that did; its page left with MESITA-3846).

import {
  toClass,
  toPlan,
  type ConsumerClass,
  type ConsumerPlan,
} from "./place-activity.ts";
import {
  planReservationCap,
  readCapOverride,
} from "./reservation-cap.ts";
import { nonBlank } from "./input.ts";

/** Columns admin-web-list-guests reads. */
export const GUEST_ROW_SELECT =
  "id, code, full_name, first_name, last_name, instagram_handle, instagram_verified_at, guest_class, plan, guest_class_set_at, guest_class_set_by, guest_class_note, vip_partner_id, reservation_cap_override, created_at";

export const GUEST_LIST_LIMIT = 50;

export type GuestRow = {
  id: string;
  name: string;
  code: string | null;
  /** The verified handle, without "@"; null when none is proved. */
  instagram: string | null;
  guestClass: ConsumerClass;
  plan: ConsumerPlan;
  /** When an operator last changed the class; null before that. */
  guestClassSetAt: string | null;
  /** That operator's email; null when it no longer resolves. */
  guestClassSetByEmail: string | null;
  /** Operator-only: where this VIP came from. */
  guestClassNote: string | null;
  /** MESITA-2556: the partner this VIP came through; null when none is recorded. */
  vipPartnerId: string | null;
  /** Operator-set reservations a month; null = the plan's cap. */
  reservationCapOverride: number | null;
  /** The plan's cap, what applies while there is no override. */
  planReservationCap: number;
  createdAt: string;
};

export type RawGuest = {
  id?: unknown;
  code?: unknown;
  full_name?: unknown;
  first_name?: unknown;
  last_name?: unknown;
  instagram_handle?: unknown;
  instagram_verified_at?: unknown;
  guest_class?: unknown;
  plan?: unknown;
  guest_class_set_at?: unknown;
  guest_class_set_by?: unknown;
  guest_class_note?: unknown;
  vip_partner_id?: unknown;
  reservation_cap_override?: unknown;
  created_at?: unknown;
};

/** `setByEmail` maps a `guest_class_set_by` user id to the operator's email. */
export function toGuestRow(
  raw: RawGuest,
  setByEmail: (userId: string) => string | null = () => null,
): GuestRow {
  const name = nonBlank(raw.full_name) ??
    ([nonBlank(raw.first_name), nonBlank(raw.last_name)].filter(Boolean).join(" ") || "No name yet");
  const setBy = nonBlank(raw.guest_class_set_by);
  return {
    id: String(raw.id ?? ""),
    name,
    code: nonBlank(raw.code),
    instagram: nonBlank(raw.instagram_verified_at) ? nonBlank(raw.instagram_handle) : null,
    guestClass: toClass(raw.guest_class),
    plan: toPlan(raw.plan),
    guestClassSetAt: nonBlank(raw.guest_class_set_at),
    guestClassSetByEmail: setBy ? setByEmail(setBy) : null,
    guestClassNote: nonBlank(raw.guest_class_note),
    vipPartnerId: nonBlank(raw.vip_partner_id),
    reservationCapOverride: readCapOverride(raw.reservation_cap_override),
    planReservationCap: planReservationCap(raw.plan),
    createdAt: String(raw.created_at ?? ""),
  };
}

/**
 * The PostgREST `.or()` filter for a search, or null for no search. The
 * query is reduced to letters, digits, spaces, "." and "_" first: a comma or
 * a parenthesis would split or close the `.or()` string. Eight digits, with
 * or without the dash, also match the member number exactly.
 */
export function guestSearchFilter(q: unknown): string | null {
  if (typeof q !== "string") return null;
  const clean = q.replace(/^@/, "").replace(/[^\p{L}\p{N} ._-]/gu, " ").replace(/\s+/g, " ")
    .trim();
  if (clean === "") return null;
  // Double-quoted, so a space or a "." stays inside the value.
  const like = `"%${clean.replace(/[%_]/g, (c) => `\\${c}`)}%"`;
  const terms = [
    `full_name.ilike.${like}`,
    `first_name.ilike.${like}`,
    `last_name.ilike.${like}`,
    `instagram_handle.ilike.${like}`,
  ];
  const digits = clean.replace(/-/g, "");
  if (/^\d{8}$/.test(digits)) terms.push(`code.eq.${digits.slice(0, 4)}-${digits.slice(4)}`);
  return terms.join(",");
}
