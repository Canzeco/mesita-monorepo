// THE ONE GUEST-FACING FACT: INSTAGRAM (Pato, MESITA-2040: "instagram is
// just 1000 followers").
//
// This module is the whole guest-facing identity model. It is PURE — no
// React, no Supabase, no Tailwind — so every surface that says something
// about a guest's Instagram says the same thing.
//
// The consumer app is Catalog · Discovery · Reservations (MESITA-2087), and
// Instagram is identity, not a price: a handle on the account and a follower
// bar that makes the account verified.

/** The Instagram bar, and the only number in this file. */
export const INSTAGRAM_REACH_FOLLOWERS = 1_000;

/** What the app knows about a guest's Instagram. `unknown` means the profile
 *  read FAILED — not "they have none". Every surface that STATES the fact
 *  (rather than colouring with it) must branch on it, which is the lesson
 *  MESITA design review 2026-08-22 paid for. */
export type ConsumerFacts = {
  /** A handle is on the account. */
  igConnected: boolean;
  igHandle: string | null;
  igFollowers: number;
  /** Connected AND at or over the bar. */
  igReach: boolean;
  unknown: boolean;
};

/** The Instagram chip / tile line. Connected guests get their handle, because
 *  it is the one Instagram fact they can check at a glance. */
export function instagramSummary(f: ConsumerFacts): string {
  if (f.unknown) return "Come back to try";
  if (!f.igConnected) return "Connect it";
  return f.igHandle ? `@${f.igHandle}` : "Connected";
}
