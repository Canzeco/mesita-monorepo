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

/** The Instagram chip line. Connected: "Insta: @handle" (Pato, MESITA-2606:
 *  "say insta: is easy"), because the handle is the one Instagram fact a
 *  guest can check at a glance. Not connected: "Connect Instagram", what the
 *  box does on Me (Pato, MESITA-2696: "i dont like the insta: not
 *  connected"). */
export const INSTAGRAM_CONNECT_LABEL = "Connect Instagram";

export function instagramSummary(f: ConsumerFacts): string {
  if (f.unknown) return "Insta: couldn't load";
  if (!f.igConnected) return INSTAGRAM_CONNECT_LABEL;
  return f.igHandle ? `Insta: @${f.igHandle}` : "Insta: connected";
}

/** An approximate follower count: 47 → "40+", 760 → "700+", 4,820 → "4.8K",
 *  12,400 → "12K", 1,250,000 → "1.2M". Zero or less → null. */
export function approxFollowers(n: number): string | null {
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n < 10) return String(Math.trunc(n));
  if (n < 100) return `${Math.floor(n / 10) * 10}+`;
  if (n < 1000) return `${Math.floor(n / 100) * 100}+`;
  const [div, unit] = n < 1_000_000 ? [1000, "K"] : [1_000_000, "M"];
  const v = n / div;
  const shown = v < 10 ? Math.floor(v * 10) / 10 : Math.floor(v);
  return `${String(shown).replace(/\.0$/, "")}${unit}`;
}

/** Me's Instagram chip and tile: the summary, plus the rounded follower count
 *  once a handle is connected ("Insta: @pato · 1.2K followers"), the same rounding Social
 *  shows (MESITA-2574: "Instagram Instagram Followers"). */
export function instagramWithFollowers(
  summary: string,
  followers: number | null | undefined,
  connected: boolean,
): string {
  const n = connected ? approxFollowers(followers ?? 0) : null;
  return n ? `${summary} · ${n} followers` : summary;
}
