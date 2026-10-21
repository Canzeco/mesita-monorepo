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

/** The page's one line under the card. Never sent on its own. */
export const APP_SHARE_TEXT =
  "Find great places to eat and book a table with Mesita.";

// THE INVITE CARD (Pato, MESITA-2568: "make a more beautiful card, like it
// must look like a gift card but without credit … its just a message you
// sent … multiple styles … keep it simple, meme style").
//
// THREE PARAMS (Pato, MESITA-2570: "use meme images. use 5 … cats or dogs …
// include certain backgrounds of cities, for example San Francisco, New York,
// Miami … imagine you have 10 images … maybe just three params"): an IMAGE, a
// MESSAGE and a STYLE. The image fills the card's top; the style's `tint`
// ("r g b") fades it into solid colour under the words. Only the MESSAGE
// travels (plus the link); the image and the style dress this page, and no
// image is sent. A photo that fails to load leaves the plain style behind.

/** Meme-style lines the guest picks from. The first is the default. */
export const SHARE_MESSAGES = [
  "Stop asking me where to eat. Use this. 🙄",
  "POV: you finally have dinner plans 🍽️",
  "I found where we're eating. You're welcome.",
  "Table for two? 👀",
  "Mesita calls the restaurant so you don't have to 📞",
  "Main character energy, but make it brunch ✨",
] as const;

const unsplash = (id: string, size: string) =>
  `https://images.unsplash.com/photo-${id}?${size}&fit=crop&fm=jpg&q=70`;

/** One Unsplash photo by id: `src` for the card (2x a phone's width), `thumb`
 *  for the picker. Every id was checked to resolve; no people up close. */
function photo(id: string) {
  return { src: unsplash(id, "w=800"), thumb: unsplash(id, "w=160&h=160") };
}

/** The card's images: five meme animals, five cities. The first is the default. */
export const SHARE_CARD_IMAGES = [
  {
    id: "shades-cat",
    label: "Cat in sunglasses",
    ...photo("1533738363-b7f9aef128ce"),
  },
  { id: "pug", label: "Pug", ...photo("1517849845537-4d257902454a") },
  { id: "corgi", label: "Corgi", ...photo("1537151625747-768eb6cf92b2") },
  {
    id: "frenchie",
    label: "French bulldog",
    ...photo("1583511655857-d19b40a7a54e"),
  },
  {
    id: "wide-eyed-cat",
    label: "Wide-eyed cat",
    ...photo("1574158622682-e40e69881006"),
  },
  {
    id: "san-francisco",
    label: "San Francisco",
    ...photo("1501594907352-04cda38ebc29"),
  },
  { id: "new-york", label: "New York", ...photo("1485871981521-5b1fd3805eee") },
  { id: "miami", label: "Miami", ...photo("1533106497176-45ae19e68ba2") },
  {
    id: "mexico-city",
    label: "Mexico City",
    ...photo("1585464231875-d9ef1f5ad396"),
  },
  { id: "paris", label: "Paris", ...photo("1502602898657-3e91760cbb34") },
] as const;

export type ShareCardImage = (typeof SHARE_CARD_IMAGES)[number];

/** The card's looks. `background` is CSS (the swatch, and the card under a
 *  photo that failed); `ink` is the text colour class; `tint` is "r g b". */
export const SHARE_CARD_STYLES = [
  {
    id: "pink",
    label: "Pink",
    background: "var(--gradient-pink)",
    ink: "text-white",
    tint: "23 23 23",
  },
  {
    id: "ink",
    label: "Ink",
    background: "linear-gradient(135deg, #2a2a2a, #0a0a0a)",
    ink: "text-white",
    tint: "10 10 10",
  },
  {
    id: "sunset",
    label: "Sunset",
    background: "linear-gradient(135deg, #ffb347, #ff5e7e)",
    ink: "text-white",
    tint: "255 94 126",
  },
  {
    id: "lime",
    label: "Lime",
    background: "linear-gradient(135deg, #e6fca5, #8ce99a)",
    ink: "text-neutral-900",
    tint: "140 233 154",
  },
  {
    id: "paper",
    label: "Paper",
    background: "linear-gradient(135deg, #fffdf7, #f4efe4)",
    ink: "text-neutral-900",
    tint: "244 239 228",
  },
] as const;

export type ShareCardStyle = (typeof SHARE_CARD_STYLES)[number];

/** Any index of `length` but `current`: Shuffle never lands where it was. */
export function otherIndex(
  current: number,
  length: number,
  random: () => number = Math.random,
): number {
  const step = 1 + Math.floor(random() * (length - 1));
  return (current + step) % length;
}

/** What every channel carries: the chosen message, then the link. */
export function shareBody(message: string): string {
  return `${message} ${APP_SHARE_URL}`;
}

/** One address per channel that can be prefilled with the message and link. */
export function shareLinks(message: string) {
  const body = encodeURIComponent(shareBody(message));
  return {
    sms: `sms:?&body=${body}`,
    whatsapp: `https://wa.me/?text=${body}`,
  } as const;
}

// INSTAGRAM HAS NO WEB LINK THAT PREFILLS A MESSAGE. The honest version: the
// tap copies the message and link, says so, and opens Instagram's inbox (the
// app, where it is installed) for the guest to paste into a chat.
export const INSTAGRAM_DM_URL = "https://www.instagram.com/direct/inbox/";
