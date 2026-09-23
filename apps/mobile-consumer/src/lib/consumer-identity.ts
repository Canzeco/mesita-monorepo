// TWO FACTS, AND THEY DO NOT TOUCH EACH OTHER (Pato, MESITA-2040).
//
//   "separate instagram and diamond. Now its two different things. there are
//    no classes anymore. either you are diamond or you are not. so add
//    instagram and then diamond. those are independent. diamond are manually
//    invited, but you can request invitation. instagram is just 1000
//    followers."
//
// HAND-MIRRORED TWIN of `apps/web-consumer/src/lib/consumer-identity.ts`, same
// convention as ef.ts and the route contract. Every
// string below renders to a guest on both platforms, so a change here is a
// change there, in the same PR — consumer IA cannot diverge.
//
// WHAT REPLACED WHAT. The four-rung ladder (Bronze → Silver → Gold → Diamond,
// stored as standard/influencer/premium/aura) was ONE axis with several doors:
// follower reach lifted you, a subscription lifted you, an invitation named a
// rung by hand. Every sentence on Me had to answer "which rung, and which door
// got you there". There is no ladder to be on, no rung to name, and the doors
// lead to two different, independent facts.
//
// THE LADDER IS NOT DELETED FROM THE PRODUCT, ONLY FROM THE IDENTITY SURFACE.
// `classes` still prices Rewards, `consumers.class_key` is still the column
// this reads, and place detail's reward matrix still shows the rate rows the
// engine really applies. `diamond` below is a READ of storage that exists.

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

/** The Instagram row / tile line. */
export function instagramSummary(f: ConsumerFacts): string {
  if (f.unknown) return 'Come back to try';
  if (!f.igConnected) return 'Connect it';
  return f.igHandle ? `@${f.igHandle}` : 'Connected';
}

/** The Diamond row / tile line. "Ask for it" rather than "Not yet": both
 *  facts are DOORS, so a false one says what the guest can do about it. */
export function diamondSummary(f: ConsumerFacts): string {
  if (f.unknown) return 'Come back to try';
  return f.diamond ? 'Diamond' : 'Ask for it';
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

/** The sentence under the Diamond door. An invitation is the ONLY door, so a
 *  guest without one is told how to ask rather than how to climb. */
export function diamondNote(f: ConsumerFacts): string {
  if (f.unknown) return "We couldn't read your invitation just now.";
  return f.diamond
    ? 'Invited by Mesita. It never expires and nothing can take it.'
    : 'By invitation only. Ask for one, or redeem a PIN you were given.';
}
