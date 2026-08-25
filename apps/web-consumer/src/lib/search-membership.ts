// Consumer Search name-bar: membership is the colored point only.
// Red = Mesita partner (plan), gray = on Mesita not partner, yellow = Google only.
// Hexes match map pins in lib/map-defaults.ts.

import {
  MAP_GOOGLE_PIN_COLOR,
  MAP_LISTED_PIN_COLOR,
  MAP_PARTNER_PIN_COLOR,
} from "@/lib/map-defaults";

export type MembershipTone = "partner" | "listed" | "google";

export const MEMBERSHIP_COLORS: Record<MembershipTone, string> = {
  partner: MAP_PARTNER_PIN_COLOR,
  listed: MAP_LISTED_PIN_COLOR,
  google: MAP_GOOGLE_PIN_COLOR,
};

export function membershipTone(item: {
  status?: string | null;
  partner?: boolean | null;
}): MembershipTone {
  if (item.status === "not_in_mesita") return "google";
  if (item.partner) return "partner";
  return "listed";
}

export function membershipColor(tone: MembershipTone): string {
  return MEMBERSHIP_COLORS[tone];
}

export function placeMembershipTone(place: {
  partner?: boolean | null;
  plan?: string | null;
}): MembershipTone {
  if (place.partner === true) return "partner";
  if (place.partner === false) return "listed";
  if (place.plan && place.plan.toLowerCase() !== "free") return "partner";
  return "listed";
}
