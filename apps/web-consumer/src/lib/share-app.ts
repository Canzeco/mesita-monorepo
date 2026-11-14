// SHARING THE APP — the bar's Share button (Pato, 2026-11-14, MESITA-3855:
// "SHARE IS JUST A QUICK BUTTON TO SHARE WITH FRIENDS. NOTHING ELSE. NO
// REWARD MECHANISMS. JUST THE WORD OF MOUTH"). A tap opens the phone's share
// sheet with the message and the link; with no sheet it copies them. It was
// that button once before (MESITA-2561: "just a button to share the app with
// friends. no credits. no nothing"), then a page of its own, /share
// (MESITA-2566 → MESITA-3855).
//
// THE LINK IS THE APP'S FRONT DOOR AND NOTHING ELSE: the production address,
// the sign-in page for a friend and Home for a member. No referral code, no
// guest id, no tracking param, no reward — the same rule as a place link
// (share-place.ts). It is the production address on every deployment, so a
// preview never hands a friend a preview URL.

export const APP_SHARE_URL = "https://mesita.ai/";

// ONE MESSAGE (Pato, MESITA-2622). The message travels, then the link; the
// link unfurls into the share card below in the friend's chat. No image is
// sent.

/** The one message the button sends. */
export const SHARE_MESSAGE = "Stop asking me where to eat. Use this. 🙄";

/** What a copy carries when there is no share sheet: the message, then the
 *  link. */
export const SHARE_BODY = `${SHARE_MESSAGE} ${APP_SHARE_URL}`;

/**
 * THE MESITA SHARE CARD (MESITA-2639): one image, the standard link-preview
 * size (1200×630, 1.91:1). The app's og:image and twitter:image: what a
 * friend's chat unfurls the shared link into. Since MESITA-3761 it is the sign-in cover as a 1200×630 JPEG.
 */
export const SHARE_CARD = {
  src: "/share/mesita-cover-og.jpg",
  width: 1200,
  height: 630,
  alt: "Mesita — Every table in Monterrey. Find a place, book a table, pay and earn credit back. mesita.ai",
} as const;
