import type { Perk } from "@/components/consumer/me/perk-list";
import type { GuestClass } from "@/lib/guest-standing";
import { INSTAGRAM_REACH_FOLLOWERS } from "@/lib/consumer-identity";

// The Class card's words, row by row. ClassList draws them (the sheet and
// /me/class), and so does /me/class' loading.tsx, which draws them as
// themselves so its lines wrap where the page's do (Pato, MESITA-2701: "the
// placeholders must be similar to the page you are loading, like the
// sizes"). The words exist once, here.
//
// A PLAIN MODULE, NOT ClassSheet's: the fallback is a server component, and
// a value it imports from a "use client" file arrives as a client reference,
// not the words.
//
// CLASS IS NOT PLAN (see ClassSheet): nothing here names a plan, a price or
// a buy; the one VIP perk is tagged Soon. Joining is "Join", never
// "Upgrade" (MESITA-3054): VIP is never sold.

export type ClassRowWords = {
  title: string;
  /** The row's fixed line; the guest's own row adds a Current pill. */
  subtitle: string;
  /** A class nobody can be in yet: a Soon tag beside the title. */
  soon?: boolean;
  perks?: { label: string; items: Perk[] };
};

export const CLASS_ROWS: Record<GuestClass, ClassRowWords> = {
  regular: {
    title: "Regular",
    subtitle: "Every member.",
  },
  vip: {
    title: "VIP",
    subtitle:
      "Through Mesita's partners, like agencies and creator partnerships. Never bought.",
    perks: {
      label: "Comes with VIP",
      items: [{ text: "Special rates at partner venues", soon: true }],
    },
  },
};

// ── Becoming VIP (MESITA-3054): two ways, both a tap by the guest ─────────

const fmt = (n: number) => n.toLocaleString("en-US");

export const JOIN_WORDS = {
  group: "Become VIP",
  // One card of rows (MESITA-3073): each row titled by its way in, and both
  // buttons say Join. The Instagram one is read aloud as instagramButton.
  instagramTitle: "Instagram",
  instagramButton: "Join with Instagram",
  codeTitle: "Invitation code",
  codeField: "12-digit invitation code",
  codeButton: "Join",
  joined: "You're VIP.",
  connect: "Connect Instagram first.",
  unknownCount: "We couldn't read your follower count.",
  needs: (followers: number, needed = INSTAGRAM_REACH_FOLLOWERS) =>
    `Needs ${fmt(needed)} followers. You have ${fmt(followers)}.`,
  // The row's line over its bar (MESITA-3069, MESITA-3073).
  progressLabel: "Instagram followers toward VIP",
  progress: (have: string, needed: string) => `${have} of ${needed} followers`,
  toJoinFull: `${fmt(INSTAGRAM_REACH_FOLLOWERS)} followers to join`,
  qualify: (have: string) => `${have} followers · you qualify`,
  countUnavailable: "Count unavailable",
  connectButton: "Connect",
  shortCode: "Enter the 12-digit code.",
} as const;

/** Leaving VIP, in the rare case a guest wants to (MESITA-3054). */
export const LEAVE_WORDS = {
  button: "Leave VIP",
  title: "Leave VIP?",
  body: "You go back to Regular. To be VIP again you need an invitation code or your Instagram.",
  cancel: "Cancel",
  confirm: "Leave VIP",
} as const;

/** An inline line for each refusal the join EF names (consumer-web-join-class
 *  codes); anything else is a 5xx or the network, which the toast reports. */
export function joinErrorWords(
  code: string | null,
  body: Record<string, unknown> | null,
): string | null {
  switch (code) {
    case "bad_code":
      return "Enter the 12-digit code.";
    case "invalid_code":
      return "That code isn't valid.";
    case "instagram_not_connected":
      return JOIN_WORDS.connect;
    case "followers_unknown":
      return JOIN_WORDS.unknownCount;
    case "not_enough_followers":
      return typeof body?.followers === "number"
        ? JOIN_WORDS.needs(
            body.followers,
            typeof body.needed === "number" ? body.needed : undefined,
          )
        : JOIN_WORDS.needs(0);
    case "consumer_not_found":
      return "Your account isn't active. Sign in again.";
    case "bad_request":
      return "Something went wrong. Try again.";
    default:
      return null;
  }
}
