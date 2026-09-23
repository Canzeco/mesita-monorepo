// TWO FACTS, AND THEY DO NOT TOUCH EACH OTHER (Pato, MESITA-2040).
//
//   "separate instagram and diamond. Now its two different things. there are
//    no classes anymore. either you are diamond or you are not. so add
//    instagram and then diamond. those are independent. diamond are manually
//    invited, but you can request invitation. instagram is just 1000
//    followers."
//
// This module is the whole guest-facing identity model now. It is PURE — no
// React, no Supabase, no Tailwind — so web and the mobile port
// (`apps/mobile-consumer/src/lib/consumer-identity.ts`, a hand-mirrored twin)
// cannot tell a guest two different stories about the same account.
//
// WHAT REPLACED WHAT. The four-rung ladder (Bronze → Silver → Gold → Diamond)
// was ONE axis with TWO doors: follower reach lifted you automatically, an
// invitation named a rung by hand. Every copy decision on Me had to answer
// "which rung, and which door got you there" — which is how Diamond ended up
// reading "Highest discount · Instagram or an invite" (MESITA-1819), and how
// the Instagram sheet ended up quoting one rung's bar next to another rung's
// name (MESITA-1141). Neither is expressible here: there is no ladder to be
// on, no rung to name, and the two doors lead to two different, independent
// facts.
//
// DIAMOND (Pato, MESITA-2044): "there are no classes, either you are diamond
// or you are not". MESITA-2044 called it the Diamond List; an hour later Pato
// cut the noun (MESITA-2046: "Don't call diamond list, just diamond").
//
// So the one invitation-only fact has a NAME now, and the name is one word:
// you are Diamond or you are not. MESITA-2040 left the rate surfaces on the old ladder pending a rates
// decision; MESITA-2044 is that decision, and it moves no number: every guest
// gets the Base, a Diamond guest gets the Diamond adder on top (the
// engine's `bronze` and `diamond` rows). `consumers.class_key` is still the
// column this reads and `diamond` below is still a READ of that storage — only
// what a person reads changed.
//
// EVERY STRING BELOW IS MIRRORED CHARACTER FOR CHARACTER in
// `apps/mobile-consumer/src/lib/consumer-identity.ts`. Change one, change both.

/** The Instagram bar, and the only number in this file (Pato, MESITA-2040:
 *  "instagram is just 1000 followers").
 *
 *  It used to be `REACH_ENTRY_CLASS.followerThreshold` — derived by SHAPE from
 *  the ladder, so that copy quoting a bar always quoted the rung that bar
 *  granted. With no rung to grant, the derivation has nothing left to protect
 *  and the bar is simply the bar. Mobile's own copy said 2,000 for weeks
 *  (`INFLUENCER_FOLLOWER_THRESHOLD`); both platforms land here. */
export const INSTAGRAM_REACH_FOLLOWERS = 1_000;

/** What the app knows about a guest's two facts. `unknown` means the profile
 *  read FAILED — not "they have neither". Every surface that STATES a fact
 *  (rather than colouring with it) must branch on it, which is the lesson
 *  MESITA design review 2026-08-22 paid for on the class ladder. */
export type ConsumerFacts = {
  /** Granted by invitation, by hand. Never by followers, never by paying. */
  diamond: boolean;
  /** A handle is on the account. Story Bonus rides THIS, not the bar. */
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

/** The one name, everywhere a guest or a member of staff reads it. One word
 *  (MESITA-2046) — never "Diamond List", never "Diamond class" or a rung. */
export const DIAMOND = "Diamond";
export const DIAMOND_ES = "Diamante";

/** The rate surfaces' two identity rows (place detail, THE TICKET, Help). */
export const BASE_RATE_LABEL = "Base";
export const BASE_RATE_HINT = "Every guest, every visit";
export const DIAMOND_RATE_HINT = "Invitation only";

/** The "how" line: the only door on, said once. */
export const DIAMOND_HOW =
  "Diamond is invitation-only. Ask Mesita to join, or enter a PIN if someone gave you one.";

/** The body of the request mail / DM. */
export const DIAMOND_REQUEST_BODY =
  "Hi Mesita — I'd like to join Diamond.\n\nWho I am:\n";

export const DIAMOND_PIN_SUBTITLE =
  "Ten digits. It makes you Diamond.";
export const DIAMOND_PIN_SUCCESS = "You're Diamond.";
export const DIAMOND_MEMBER_NUMBER_LINE =
  "Give this number when you ask to join Diamond.";

/** Me › Help's one line about discounts. */
export const DIAMOND_HELP_LINE =
  "Every guest gets the base discount. Diamond guests get more — Diamond is invitation-only, and you can ask to join from Me.";

/** The Me grid tile's summary line. NEVER a rung name and never a percentage:
 *  the fact is binary, so the line is binary.
 *
 *  "Ask to join" rather than "Not yet", and that is the whole parallel with
 *  Instagram's "Connect it": both are DOORS, so when the fact is false each
 *  one says what the guest can do about it. The tile's TITLE already says
 *  "Diamond", so the summary answers "am I in". */
export function diamondSummary(f: ConsumerFacts): string {
  if (f.unknown) return "Come back to try";
  return f.diamond ? "You're in" : "Ask to join";
}

/** The header chip's visible label. The chip has no title beside it, so the
 *  on-state names Diamond itself; the off-state is the same door as the
 *  tile. Its accessible name is `Diamond: <diamondSummary>`. */
export function diamondChipLabel(f: ConsumerFacts): string {
  if (f.unknown) return "Come back to try";
  return f.diamond ? DIAMOND : "Ask to join";
}

/** The Diamond page's status headline. */
export function diamondHeadline(f: ConsumerFacts): string {
  return f.diamond ? "You're Diamond" : "You're not Diamond yet";
}

/** The sentence under the Instagram door. It states the bar when the bar is
 *  the next thing that happens, and the count once it is cleared — never both,
 *  and never a class (MESITA-1819's no-middle-dot rule survives the model it
 *  was written for). */
export function instagramNote(
  f: ConsumerFacts,
  followersLabel: string,
): string {
  if (f.unknown) return "We couldn't read your Instagram just now.";
  if (!f.igConnected) {
    return `${INSTAGRAM_REACH_FOLLOWERS.toLocaleString("en-US")}+ followers and you're verified. Connect to post Stories for extra Rewards.`;
  }
  if (!f.igReach) {
    return `${followersLabel} — ${INSTAGRAM_REACH_FOLLOWERS.toLocaleString("en-US")} verifies you. Stories already earn extra Rewards.`;
  }
  return `${followersLabel} — verified. Post a tagged Story on any visit for extra Rewards.`;
}

/** The sentence under the status headline. An invitation is the ONLY door,
 *  so a guest who is not Diamond is told how to get in — once, in the
 *  "how" line — rather than how to climb. */
export function diamondNote(f: ConsumerFacts): string {
  if (f.unknown) return "We couldn't read your invitation just now.";
  return f.diamond
    ? "Invited by Mesita. It never expires and nothing can take it."
    : DIAMOND_HOW;
}
