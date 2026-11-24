// VIP (Pato, 2026-11-23, MESITA-4766: "BRING BACK VIP CUSTOMERS ... In order
// to be VIP, is either invitation code or 5000 followers on instagram"; codes only since MESITA-4849). The
// server decides who is VIP (consumers.guest_class); the app only reads it,
// formats the 12-digit invitation code and says what a redeem answered.
// Plain module: no React, so tests read it without a renderer.

import type { ConsumerProfile } from "@/lib/api/profile";
import type { RedeemVipResult } from "@/lib/api/vip";

/** An invitation code is twelve digits; leading zeros count. */
export const VIP_CODE_LENGTH = 12;

/** VIP is the server's `guest_class`; a missing field (an older EF during
 *  the deploy window) reads as not VIP. */
export function isVip(profile: Pick<ConsumerProfile, "guest_class"> | null | undefined): boolean {
  return profile?.guest_class === "vip";
}

/** Me's VIP row title: how the guest got in. Never "Regular". */
export function vipTitle(reason: ConsumerProfile["vip_reason"]): string {
  if (reason === "code") return "VIP · Invited";
  if (reason === "instagram") return "VIP · Instagram";
  return "VIP";
}

/** What the guest typed or pasted, as the code's digits: spaces, dashes and
 *  anything else dropped, at most twelve. A string, so leading zeros stay. */
export function vipCodeDigits(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, VIP_CODE_LENGTH);
}

/** The digits shown 4-4-4 ("1234 5678 9012"). */
export function groupVipCode(digits: string): string {
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
}

/** What the page does with one redeem answer. `afterFailedTry`: the
 *  previous try never got an answer (network, 5xx), so an `already_vip`
 *  now means that try went through: it counts as joined. */
export type VipRedeemUi =
  | { kind: "joined"; text: string }
  | { kind: "already"; text: string }
  | { kind: "error"; text: string }
  | { kind: "sign_in"; text: string };

export const VIP_JOINED_TEXT = "You're VIP. You get each place's VIP rate, from your first bill there.";

export function vipRedeemUi(result: RedeemVipResult, afterFailedTry = false): VipRedeemUi {
  switch (result.kind) {
    case "joined":
      return { kind: "joined", text: VIP_JOINED_TEXT };
    case "already_vip":
      return afterFailedTry ? { kind: "joined", text: VIP_JOINED_TEXT } : { kind: "already", text: "You're already VIP" };
    case "code_invalid":
    case "invalid_code_format":
      return { kind: "error", text: "That code doesn't work" };
    case "too_many_tries":
      return { kind: "error", text: "Too many tries. Try again in an hour." };
    case "consumer_not_found":
      return { kind: "sign_in", text: "Sign in again" };
    default:
      return { kind: "error", text: "Couldn't check the code. Try again." };
  }
}

/** What the follower check said, with the guest's own count, for Me › Instagram
 *  and the locked VIP offer. Null before a check. */
export function instagramVipLine(
  p: Pick<ConsumerProfile, "instagram_vip_status" | "instagram_followers_count"> | null | undefined,
): string | null {
  const n = p?.instagram_followers_count;
  const count = typeof n === "number" ? `${n.toLocaleString("en-US")} followers. ` : "";
  switch (p?.instagram_vip_status) {
    case "eligible":
      return "Your Instagram made you VIP.";
    case "not_enough":
      return `${count}VIP needs more than 5,000.`;
    case "not_public":
      return `${count}Your account is private; VIP needs a public one.`;
    case "unconfirmed":
      return `${count}Instagram didn't confirm your account is public.`;
    default:
      return null;
  }
}
