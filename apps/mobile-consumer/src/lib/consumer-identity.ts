// TWO FACTS, AND THEY DO NOT TOUCH EACH OTHER (Pato, MESITA-2040), and the
// second one is a LIST (Pato, MESITA-2044):
//
//   "there are no classes, either you are diamond or you are not. its more
//    like a List. Diamond List. you are in the list or you don't, not in
//    between"
//
// HAND-MIRRORED TWIN of `apps/web-consumer/src/lib/consumer-identity.ts`, same
// convention as ef.ts and the route contract. Every
// string below renders to a guest on both platforms, so a change here is a
// change there, in the same PR — consumer IA cannot diverge.
//
// WHAT REPLACED WHAT. The four-rung ladder (Bronze → Silver → Gold → Diamond,
// stored as standard/influencer/premium/aura) was ONE axis with several doors.
// It is gone for guests and staff: a guest is ON the Diamond List or not, an
// invitation (a named grant, or a PIN) is the only way on, and Instagram is a
// separate fact that grants nothing toward the list.
//
// STORAGE DID NOT MOVE. `consumers.class_key` (bronze/diamond, legacy
// standard/aura) is still the column this reads, and the rewards engine still
// prices its `bronze` and `diamond` rows — which the rate surfaces now call
// "Base" and "Diamond List". `diamond` below is a READ of storage that exists.
// Only what a person reads changed.

/** The list's name, everywhere a guest reads it. Always both words. */
export const DIAMOND_LIST = 'Diamond List';
/** The Spanish gloss (the rate surfaces carry `nameEs`). */
export const DIAMOND_LIST_ES = 'Lista Diamante';

/** The rate surfaces' two identity rows (place detail, THE TICKET, Help). */
export const BASE_RATE_LABEL = 'Base';
export const BASE_RATE_HINT = 'Every guest, every visit';
export const DIAMOND_LIST_RATE_HINT = 'Invitation only';

/** The "how" line: how a guest gets on, under the status headline when they
 *  are not on it. */
export const DIAMOND_LIST_HOW =
  'The Diamond List is invitation-only. Ask Mesita to join, or enter a PIN if someone gave you one.';

/** The Instagram bar (Pato, MESITA-2040: "instagram is just 1000 followers").
 *
 *  MOBILE SAID 2,000 FOR WEEKS. `INFLUENCER_FOLLOWER_THRESHOLD` in
 *  consumer-classes.ts carried 2,000 while web's ladder carried 1,000, both
 *  claiming to mirror `classes.follower_threshold`, and nothing compared them
 *  — the drift guard was a comment on each side. There is one number now and
 *  it is pinned by a test on the web twin. */
export const INSTAGRAM_REACH_FOLLOWERS = 1_000;

/** What the app knows about a guest's two facts. `unknown` means the profile
 *  read FAILED — not "they have neither". Every surface that STATES a fact
 *  (rather than colouring with it) must branch on it. */
export type ConsumerFacts = {
  /** On the Diamond List. Invitation only — never by followers, never by paying. */
  diamond: boolean;
  /** A handle is on the account. Story Bonus rides THIS, not the bar. */
  igConnected: boolean;
  igHandle: string | null;
  igFollowers: number;
  /** Connected AND at or over the bar. */
  igReach: boolean;
  unknown: boolean;
};

/** The Instagram row / tile line. */
export function instagramSummary(f: ConsumerFacts): string {
  if (f.unknown) return 'Come back to try';
  if (!f.igConnected) return 'Connect it';
  return f.igHandle ? `@${f.igHandle}` : 'Connected';
}

/** The Diamond List TILE summary (Me grid). The fact is binary, so the line
 *  is binary — and a false one says what the guest can do about it, the same
 *  way Instagram's "Connect it" does. */
export function diamondSummary(f: ConsumerFacts): string {
  if (f.unknown) return 'Come back to try';
  return f.diamond ? "You're on it" : 'Ask to join';
}

/** The Diamond List CHIP on the Me header. Differs from the tile on purpose:
 *  the tile already has "Diamond List" as its title, the chip has only a gem,
 *  so the chip names the list when the guest is on it. */
export function diamondChipLabel(f: ConsumerFacts): string {
  if (f.unknown) return 'Come back to try';
  return f.diamond ? DIAMOND_LIST : 'Ask to join';
}

/** What a screen reader hears for the chip — always the list's name first. */
export function diamondChipA11y(f: ConsumerFacts): string {
  return `${DIAMOND_LIST}: ${diamondSummary(f)}`;
}

/** The whole identity header's accessibility label. */
export function identityHeaderA11y(f: ConsumerFacts): string {
  return f.diamond && !f.unknown
    ? 'Your Mesita identity, on the Diamond List'
    : 'Your Mesita identity';
}

/** The Diamond List page's status headline. */
export function diamondHeadline(f: ConsumerFacts): string {
  if (f.unknown) return "Couldn't read your invitation";
  return f.diamond ? "You're on the Diamond List" : "You're not on the list yet";
}

/** The sentence under the Instagram door — the bar while it is the next thing
 *  that happens, the count once it is cleared, never both and never a class. */
export function instagramNote(
  f: ConsumerFacts,
  followersLabel: string,
): string {
  if (f.unknown) return "We couldn't read your Instagram just now.";
  if (!f.igConnected) {
    return `${INSTAGRAM_REACH_FOLLOWERS.toLocaleString('en-US')}+ followers and you're verified. Connect to post Stories for extra Rewards.`;
  }
  if (!f.igReach) {
    return `${followersLabel} — ${INSTAGRAM_REACH_FOLLOWERS.toLocaleString('en-US')} verifies you. Stories already earn extra Rewards.`;
  }
  return `${followersLabel} — verified. Post a tagged Story on any visit for extra Rewards.`;
}

/** The sentence under the status headline. An invitation is the ONLY way
 *  on, so a guest who is not on the list is told how to ask. */
export function diamondNote(f: ConsumerFacts): string {
  if (f.unknown) return "We couldn't read your invitation just now.";
  return f.diamond
    ? 'Invited by Mesita. It never expires and nothing can take it.'
    : DIAMOND_LIST_HOW;
}

/** The request mail/DM body. */
export const DIAMOND_LIST_REQUEST_BODY =
  "Hi Mesita — I'd like to join the Diamond List.\n\nWho I am:\n";

export const DIAMOND_LIST_PIN_SUBTITLE =
  'Ten digits. It puts you on the Diamond List.';
export const DIAMOND_LIST_PIN_SUCCESS = "You're on the Diamond List.";
export const DIAMOND_LIST_MEMBER_NUMBER_LINE =
  'Give this number when you ask to join the Diamond List.';

/** Me › Help's one line about discounts. */
export const DIAMOND_LIST_HELP_LINE =
  'Every guest gets the base discount. Guests on the Diamond List get more — the list is invitation-only, and you can ask to join from Me.';
