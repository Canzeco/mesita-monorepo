// SHARING THE APP — the /share page (Pato, MESITA-2566: "create a dedicate
// page for share"; it was a tap on the bar that fired the share sheet,
// MESITA-2561: "just a button to share the app with friends. no credits. no
// nothing").
//
// THE LINK IS THE APP'S FRONT DOOR AND NOTHING ELSE: the production address,
// the sign-in page for a friend and Home for a member. No referral code, no
// guest id, no tracking param — the same rule as a place link
// (share-place.ts). It is the production address on every deployment, so a
// preview never hands a friend a preview URL.

export const APP_SHARE_URL = "https://consumer.mesita.ai/";

/** The page's one line under the title. Never sent on its own. */
export const APP_SHARE_TEXT =
  "Find great places to eat and book a table with Mesita.";

// TEN PLAIN CARDS, ONE JOKE EACH (Pato, MESITA-2573: "just a stupid card of
// mesita with nothing else. keep it simple … 10 different cards/jokes just
// to share mesita"). It replaced the gift card's photos, styles and message
// chips (MESITA-2568/2570). The guest swipes to a card; its joke travels,
// then the link. No image is sent.

/** One joke per card, in swipe order. The first is the default. */
export const SHARE_JOKES = [
  "Stop asking me where to eat. Use this. 🙄",
  "POV: you finally have dinner plans 🍽️",
  "I found where we're eating. You're welcome.",
  "Table for two? 👀",
  "My love language is booking the table.",
  "Group chat: “where should we eat?” Me: 👇",
  "Main character energy, but make it brunch ✨",
  "Friends don't let friends eat at sad restaurants.",
  "Your “idk, you pick” era ends today.",
  "Hungry? Indecisive? Same. That's why I have Mesita.",
] as const;

/** What every channel carries: the joke, then the link. */
export function shareBody(joke: string): string {
  return `${joke} ${APP_SHARE_URL}`;
}

/** One address per channel that can be prefilled with the joke and link. */
export function shareLinks(joke: string) {
  const body = encodeURIComponent(shareBody(joke));
  return {
    sms: `sms:?&body=${body}`,
    whatsapp: `https://wa.me/?text=${body}`,
  } as const;
}

// INSTAGRAM HAS NO WEB LINK THAT PREFILLS A MESSAGE. The honest version: the
// tap copies the joke and link, says so, and opens Instagram's inbox (the
// app, where it is installed) for the guest to paste into a chat.
export const INSTAGRAM_DM_URL = "https://www.instagram.com/direct/inbox/";

/** The card whose centre sits nearest the row's centre — the one in view. */
export function nearestCard(center: number, cardCenters: number[]): number {
  let best = 0;
  for (let i = 1; i < cardCenters.length; i++) {
    if (
      Math.abs(cardCenters[i] - center) < Math.abs(cardCenters[best] - center)
    )
      best = i;
  }
  return best;
}
