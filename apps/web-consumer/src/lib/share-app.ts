// SHARING THE APP — the /share page, a bar tab (Pato, 2026-11-14,
// MESITA-3867: "i actually want a share page … just a button to share in
// different channels … not really a weird card not something fancy"). One
// card of rows: WhatsApp, Instagram, Messages, Copy link, More. Still "JUST
// THE WORD OF MOUTH" (MESITA-3855): no reward, no counter. Share was a bar
// button with no page for a day (MESITA-3855), and on a computer that only
// copied; before that a page with a share card (MESITA-2566 → MESITA-3855).
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

/** What a channel row sends: the message, then the link. Copy link and
 *  More's no-sheet fallback copy APP_SHARE_URL alone, so "Link copied" is
 *  true. */
export const SHARE_BODY = `${SHARE_MESSAGE} ${APP_SHARE_URL}`;

/** The page's one line under its title. Never sent. */
export const APP_SHARE_TEXT = "Send Mesita to a friend.";

/** The channels that can be prefilled from the web with the message and
 *  link. */
export const SHARE_LINKS = (() => {
  const body = encodeURIComponent(SHARE_BODY);
  return {
    sms: `sms:?&body=${body}`,
    whatsapp: `https://wa.me/?text=${body}`,
  } as const;
})();

// INSTAGRAM HAS NO WEB LINK THAT PREFILLS A MESSAGE. The row copies the
// message and link, then the browser opens Instagram's inbox (the app, where
// it is installed) for the guest to paste into a chat.
export const INSTAGRAM_DM_URL = "https://www.instagram.com/direct/inbox/";

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
