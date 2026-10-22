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

// ONE PLAIN CARD, ONE MESSAGE (Pato, MESITA-2622: "just one card. keep it
// clearer."). It replaced ten joke cards in a swipe row (MESITA-2573), which
// replaced the gift card's photos, styles and message chips (MESITA-2568/
// 2570). The message travels, then the link. No image is sent.

/** The one message the card shows and every button sends. */
export const SHARE_MESSAGE = "Stop asking me where to eat. Use this. 🙄";

/** What every channel carries: the message, then the link. */
export const SHARE_BODY = `${SHARE_MESSAGE} ${APP_SHARE_URL}`;

/** One address per channel that can be prefilled with the message and link. */
export const SHARE_LINKS = (() => {
  const body = encodeURIComponent(SHARE_BODY);
  return {
    sms: `sms:?&body=${body}`,
    whatsapp: `https://wa.me/?text=${body}`,
  } as const;
})();

// INSTAGRAM HAS NO WEB LINK THAT PREFILLS A MESSAGE. The honest version: the
// tap copies the message and link, says so, and opens Instagram's inbox (the
// app, where it is installed) for the guest to paste into a chat.
export const INSTAGRAM_DM_URL = "https://www.instagram.com/direct/inbox/";
