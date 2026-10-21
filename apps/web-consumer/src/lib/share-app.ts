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
// sent … multiple styles … keep it simple, meme style"). The guest picks a
// message and a style; only the MESSAGE travels (plus the link). The style is
// decoration on this page — no image is sent.
//
// EACH STYLE WEARS A MEME PHOTO (Pato, MESITA-2570: "use meme images. use 5.
// meme images or cats or dogs or whatever … its just for the image"): five
// Unsplash animals, one per swatch, no people. `tint` is the style's colour
// as "r g b"; the card fades the photo into it so the headline sits on solid
// colour. A photo that fails to load leaves the plain style behind.

/** Meme-style lines the guest picks from. The first is the default. */
export const SHARE_MESSAGES = [
  "Stop asking me where to eat. Use this. 🙄",
  "POV: you finally have dinner plans 🍽️",
  "I found where we're eating. You're welcome.",
  "Table for two? 👀",
  "Mesita calls the restaurant so you don't have to 📞",
  "Main character energy, but make it brunch ✨",
] as const;

/** One Unsplash photo by id, sized for the card (2x a phone's width). */
function unsplash(id: string): string {
  return `https://images.unsplash.com/photo-${id}?w=800&fit=crop&fm=jpg&q=70`;
}

/** The card's looks. `background` is CSS; `ink` is the text colour class. */
export const SHARE_CARD_STYLES = [
  {
    id: "pink",
    label: "Pink",
    background: "var(--gradient-pink)",
    ink: "text-white",
    tint: "23 23 23",
    photo: unsplash("1533738363-b7f9aef128ce"),
  },
  {
    id: "ink",
    label: "Ink",
    background: "linear-gradient(135deg, #2a2a2a, #0a0a0a)",
    ink: "text-white",
    tint: "10 10 10",
    photo: unsplash("1517849845537-4d257902454a"),
  },
  {
    id: "sunset",
    label: "Sunset",
    background: "linear-gradient(135deg, #ffb347, #ff5e7e)",
    ink: "text-white",
    tint: "255 94 126",
    photo: unsplash("1537151625747-768eb6cf92b2"),
  },
  {
    id: "lime",
    label: "Lime",
    background: "linear-gradient(135deg, #e6fca5, #8ce99a)",
    ink: "text-neutral-900",
    tint: "140 233 154",
    photo: unsplash("1583511655857-d19b40a7a54e"),
  },
  {
    id: "paper",
    label: "Paper",
    background: "linear-gradient(135deg, #fffdf7, #f4efe4)",
    ink: "text-neutral-900",
    tint: "244 239 228",
    photo: unsplash("1574158622682-e40e69881006"),
  },
] as const;

export type ShareCardStyle = (typeof SHARE_CARD_STYLES)[number];

/** What every channel carries: the chosen message, then the link. */
export function shareBody(message: string): string {
  return `${message} ${APP_SHARE_URL}`;
}

/** One address per channel, each prefilled with the message and the link. */
export function shareLinks(message: string) {
  const body = encodeURIComponent(shareBody(message));
  return {
    whatsapp: `https://wa.me/?text=${body}`,
    sms: `sms:?&body=${body}`,
    email: `mailto:?subject=${encodeURIComponent("Mesita")}&body=${body}`,
  } as const;
}
