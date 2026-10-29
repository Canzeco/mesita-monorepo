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

/** A follower count marked as approximate (Pato, MESITA-3046: "use number
 *  of followers exact but use an approximation sign"; it floored, 298 read
 *  "200+"; MESITA-3052 swapped "≈" for "~", Pato: "i don't like that approx
 *  sign"): 298 → "~298", 4,820 → "~4.8K", 12,400 → "~12.4K",
 *  1,250,000 → "~1.3M". Under 1,000 exact; above, rounded to one decimal so
 *  the chip stays one line. Zero or less → null. */
export function approxFollowers(n: number): string | null {
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n < 1000) return `~${Math.round(n)}`;
  const [div, unit] = n < 999_950 ? [1000, "K"] : [1_000_000, "M"];
  const shown = Math.round((n / div) * 10) / 10;
  return `~${String(shown).replace(/\.0$/, "")}${unit}`;
}

/** A follower count as words (MESITA-3060): "~298 followers", and
 *  "0 followers" where `approxFollowers` has nothing to say. */
export function followersLabel(n: number | null | undefined): string {
  return `${approxFollowers(n ?? 0) ?? "0"} followers`;
}

/** "just now" / "3 min ago" / "2 h ago" / "Oct 27" (MESITA-3060, the
 *  Instagram card's "Updated …"). */
export function updatedAgo(iso: string, now: number): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const min = Math.floor((now - t) / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  if (min < 24 * 60) return `${Math.floor(min / 60)} h ago`;
  return new Date(t).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
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
