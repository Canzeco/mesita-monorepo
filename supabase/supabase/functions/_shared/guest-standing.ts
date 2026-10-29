// Manage › Guests (MESITA-2550, MESITA-2553): the pure half of
// admin-web-list-guests and admin-web-set-guest-standing. An operator finds a
// guest and sets their Class (regular or VIP, through a partner) and their Plan
// (free or premium). The two are independent. The admin_set_guest_standing RPC is
// the only writer; no consumer EF accepts either field. A VIP also carries the
// partner it came through and an optional last day (MESITA-2556); neither
// drives a rule, and no rate is stored anywhere.
// An operator can also set one guest's monthly reservation cap (MESITA-2555,
// consumers.reservation_cap_override; null = the plan's cap).

import {
  toClass,
  toPlan,
  type ConsumerClass,
  type ConsumerPlan,
} from "./place-activity.ts";
import {
  planReservationCap,
  RESERVATION_CAP_OVERRIDE_MAX,
  readCapOverride,
} from "./reservation-cap.ts";
import { isUuid } from "./place-id.ts";
import { nonBlank } from "./input.ts";

/** Columns both admin EFs read back. */
export const GUEST_ROW_SELECT =
  "id, code, full_name, first_name, last_name, instagram_handle, instagram_verified_at, guest_class, plan, guest_class_set_at, guest_class_set_by, guest_class_note, vip_partner_id, vip_until, reservation_cap_override, created_at";

export const GUEST_LIST_LIMIT = 50;

/** The VIP note's limit, the same as the database CHECK. */
export const GUEST_CLASS_NOTE_MAX = 280;

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
  /** MESITA-2556: the VIP's last day (YYYY-MM-DD), or null for no end date. */
  vipUntil: string | null;
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
  vip_until?: unknown;
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
    vipUntil: nonBlank(raw.vip_until),
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

export type StandingPatch = {
  guestClass?: ConsumerClass;
  plan?: ConsumerPlan;
  /** Present when the note is being set; null clears it. */
  guestClassNote?: string | null;
  /** Present when the partner is being set; null clears it. */
  vipPartnerId?: string | null;
  /** Present when the last day is being set (YYYY-MM-DD); null = no end date. */
  vipUntil?: string | null;
  /** Present when the cap is being set; null goes back to the plan's cap. */
  reservationCapOverride?: number | null;
};

/** A refusal with a stable code and a message that says the fix. */
export type StandingError = { code: string; error: string; status: number };

/** A real calendar day as YYYY-MM-DD, or null. */
function calendarDay(v: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v ? v : null;
}

/** The body of a set call, checked: at least one field. `today` is the UTC
 *  day a new last day may not fall before. */
export function readStandingBody(
  body: unknown,
  today: string = new Date().toISOString().slice(0, 10),
): { ok: true; consumerId: string; patch: StandingPatch } | ({ ok: false } & StandingError) {
  const b = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  // An Admin built before MESITA-2553 still sends `diamond`.
  if ("diamond" in b) {
    return {
      ok: false,
      status: 400,
      code: "stale_client",
      error: "Admin is out of date. Reload the page.",
    };
  }
  const consumerId = typeof b.consumerId === "string" ? b.consumerId.trim() : "";
  if (!/^[0-9a-f-]{36}$/i.test(consumerId)) {
    return { ok: false, status: 400, code: "invalid_consumer", error: "consumerId must be a guest's id" };
  }
  const patch: StandingPatch = {};
  if ("guestClass" in b) {
    if (b.guestClass !== "regular" && b.guestClass !== "vip") {
      return {
        ok: false,
        status: 400,
        code: "invalid_guest_class",
        error: `guestClass must be 'regular' or 'vip' (got '${String(b.guestClass)}')`,
      };
    }
    patch.guestClass = b.guestClass;
  }
  if ("plan" in b) {
    if (b.plan !== "free" && b.plan !== "premium") {
      return {
        ok: false,
        status: 400,
        code: "invalid_plan",
        error: `plan must be 'free' or 'pro' (got '${String(b.plan)}')`,
      };
    }
    patch.plan = b.plan;
  }
  if ("guestClassNote" in b) {
    const v = b.guestClassNote;
    if (v !== null && typeof v !== "string") {
      return { ok: false, status: 400, code: "invalid_note", error: "guestClassNote must be text or null" };
    }
    const note = typeof v === "string" ? v.trim() : "";
    if (note.length > GUEST_CLASS_NOTE_MAX) {
      return {
        ok: false,
        status: 400,
        code: "note_too_long",
        error: `guestClassNote is ${note.length} characters; the limit is ${GUEST_CLASS_NOTE_MAX}`,
      };
    }
    patch.guestClassNote = note === "" ? null : note;
  }
  if ("reservationCapOverride" in b) {
    const v = b.reservationCapOverride;
    if (v !== null && readCapOverride(v) === null) {
      return {
        ok: false,
        status: 400,
        code: "invalid_reservation_cap",
        error:
          `reservationCapOverride must be a whole number 0..${RESERVATION_CAP_OVERRIDE_MAX}, or null for the plan's cap (got '${String(v)}')`,
      };
    }
    patch.reservationCapOverride = v as number | null;
  }
  if ("vipPartnerId" in b) {
    const v = b.vipPartnerId;
    if (v !== null && (typeof v !== "string" || !isUuid(v.trim()))) {
      return {
        ok: false,
        status: 400,
        code: "invalid_partner",
        error: "vipPartnerId must be a partner's id or null",
      };
    }
    patch.vipPartnerId = v === null ? null : (v as string).trim().toLowerCase();
  }
  if ("vipUntil" in b) {
    const v = b.vipUntil;
    const day = typeof v === "string" ? calendarDay(v.trim()) : null;
    if (v !== null && !day) {
      return {
        ok: false,
        status: 400,
        code: "invalid_vip_until",
        error: `vipUntil must be a day as YYYY-MM-DD, or null for no end date (got '${String(v)}')`,
      };
    }
    if (day && day < today) {
      return {
        ok: false,
        status: 400,
        code: "vip_until_past",
        error: `vipUntil ${day} is in the past; pick today (${today}) or later`,
      };
    }
    patch.vipUntil = day;
  }
  // A guest made Regular in this call cannot get a partner or a last day in it.
  if (
    patch.guestClass === "regular" &&
    (patch.vipPartnerId != null || patch.vipUntil != null)
  ) {
    return {
      ok: false,
      status: 400,
      code: "not_vip",
      error: "Only a VIP has a partner or a last day. Set the class to VIP first.",
    };
  }
  if (Object.keys(patch).length === 0) {
    return {
      ok: false,
      status: 400,
      code: "nothing_to_set",
      error:
        "Send guestClass, plan, guestClassNote, vipPartnerId, vipUntil, reservationCapOverride, or several together",
    };
  }
  return { ok: true, consumerId, patch };
}
