// Manage › Guests (MESITA-2550, MESITA-2553): the pure half of
// admin-web-list-guests and admin-web-set-guest-standing. An operator finds a
// guest and sets their Class (regular or VIP, through a partner) and their Plan
// (free or pro). The two are independent. The admin_set_guest_standing RPC is
// the only writer; no consumer EF accepts either field.

import {
  toClass,
  toPlan,
  type ConsumerClass,
  type ConsumerPlan,
} from "./place-activity.ts";

/** Columns both admin EFs read back. */
export const GUEST_ROW_SELECT =
  "id, code, full_name, first_name, last_name, instagram_handle, instagram_verified_at, guest_class, plan, guest_class_set_at, guest_class_set_by, guest_class_note, created_at";

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
  created_at?: unknown;
};

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

/** `setByEmail` maps a `guest_class_set_by` user id to the operator's email. */
export function toGuestRow(
  raw: RawGuest,
  setByEmail: (userId: string) => string | null = () => null,
): GuestRow {
  const name = str(raw.full_name) ??
    ([str(raw.first_name), str(raw.last_name)].filter(Boolean).join(" ") || "No name yet");
  const setBy = str(raw.guest_class_set_by);
  return {
    id: String(raw.id ?? ""),
    name,
    code: str(raw.code),
    instagram: str(raw.instagram_verified_at) ? str(raw.instagram_handle) : null,
    guestClass: toClass(raw.guest_class),
    plan: toPlan(raw.plan),
    guestClassSetAt: str(raw.guest_class_set_at),
    guestClassSetByEmail: setBy ? setByEmail(setBy) : null,
    guestClassNote: str(raw.guest_class_note),
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
};

/** A refusal with a stable code and a message that says the fix. */
export type StandingError = { code: string; error: string; status: number };

/** The body of a set call, checked: at least one of the three fields. */
export function readStandingBody(
  body: unknown,
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
    if (b.plan !== "free" && b.plan !== "pro") {
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
  if (!("guestClass" in patch) && !("plan" in patch) && !("guestClassNote" in patch)) {
    return {
      ok: false,
      status: 400,
      code: "nothing_to_set",
      error: "Send guestClass, plan, guestClassNote, or any of them together",
    };
  }
  return { ok: true, consumerId, patch };
}
