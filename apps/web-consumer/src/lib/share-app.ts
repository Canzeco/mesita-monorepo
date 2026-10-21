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

export const APP_SHARE_TEXT =
  "Find great places to eat and book a table with Mesita.";

/** The message every channel carries: the line, then the link. */
const MESSAGE = `${APP_SHARE_TEXT} ${APP_SHARE_URL}`;

/** One address per channel, each prefilled with the message. */
export const APP_SHARE_LINKS = {
  whatsapp: `https://wa.me/?text=${encodeURIComponent(MESSAGE)}`,
  sms: `sms:?&body=${encodeURIComponent(MESSAGE)}`,
  email: `mailto:?subject=${encodeURIComponent("Mesita")}&body=${encodeURIComponent(MESSAGE)}`,
} as const;
