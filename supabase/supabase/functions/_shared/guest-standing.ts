// Manage › Guests (MESITA-2550): the pure half of admin-web-list-guests and
// admin-web-set-guest-standing. An operator finds a guest and grants or takes
// away Diamond and sets the plan (MESITA-2548's two facts). No consumer EF
// accepts either field.

import { toPlan, type ConsumerPlan } from "./place-activity.ts";

/** Columns both admin EFs read back. */
export const GUEST_ROW_SELECT =
  "id, code, full_name, first_name, last_name, instagram_handle, instagram_verified_at, diamond, plan, created_at";

export const GUEST_LIST_LIMIT = 50;

export type GuestRow = {
  id: string;
  name: string;
  code: string | null;
  /** The verified handle, without "@"; null when none is proved. */
  instagram: string | null;
  diamond: boolean;
  plan: ConsumerPlan;
  createdAt: string;
};

type RawGuest = {
  id?: unknown;
  code?: unknown;
  full_name?: unknown;
  first_name?: unknown;
  last_name?: unknown;
  instagram_handle?: unknown;
  instagram_verified_at?: unknown;
  diamond?: unknown;
  plan?: unknown;
  created_at?: unknown;
};

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

export function toGuestRow(raw: RawGuest): GuestRow {
  const name = str(raw.full_name) ??
    ([str(raw.first_name), str(raw.last_name)].filter(Boolean).join(" ") || "No name yet");
  return {
    id: String(raw.id ?? ""),
    name,
    code: str(raw.code),
    instagram: str(raw.instagram_verified_at) ? str(raw.instagram_handle) : null,
    diamond: raw.diamond === true,
    plan: toPlan(raw.plan),
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

export type StandingPatch = { diamond?: boolean; plan?: ConsumerPlan };

/** The body of a set call, checked: at least one of the two facts. */
export function readStandingBody(
  body: unknown,
): { ok: true; consumerId: string; patch: StandingPatch } | { ok: false; error: string } {
  const b = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  const consumerId = typeof b.consumerId === "string" ? b.consumerId.trim() : "";
  if (!/^[0-9a-f-]{36}$/i.test(consumerId)) return { ok: false, error: "consumerId is required" };
  const patch: StandingPatch = {};
  if ("diamond" in b) {
    if (typeof b.diamond !== "boolean") return { ok: false, error: "diamond must be true or false" };
    patch.diamond = b.diamond;
  }
  if ("plan" in b) {
    if (b.plan !== "free" && b.plan !== "premium") {
      return { ok: false, error: "plan must be 'free' or 'premium'" };
    }
    patch.plan = b.plan;
  }
  if (!("diamond" in patch) && !("plan" in patch)) {
    return { ok: false, error: "Send diamond, plan, or both" };
  }
  return { ok: true, consumerId, patch };
}
