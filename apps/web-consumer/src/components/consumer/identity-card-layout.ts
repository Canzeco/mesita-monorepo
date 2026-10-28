// The identity card's boxes, once (MESITA-2701). IdentityCard draws them
// with the guest's photo and facts; IdentityCardSkeleton
// (app/(shell)/me/me-skeletons.tsx) draws the same boxes empty while Me's
// profile read is out, and /me's loading.tsx draws that skeleton too (Pato,
// MESITA-2701: "the placeholders must be similar to the page you are
// loading, like the sizes"). The ring, the photo, the grid, the box and the
// row order live here, so the two cannot drift a pixel apart.
//
// A PLAIN MODULE, NOT THE CARD'S: me-skeletons is imported by server
// loading.tsx files, and a value they import from a "use client" file
// arrives as a client reference, not the string.

/** The card: the photo centred over the boxes, 8px between. */
export const IDENTITY_CARD_CLASS =
  "flex w-full flex-col items-center gap-2 text-center";

/** The photo's 1.5px ring: plain structure, never a colour that means
 *  something. */
export const IDENTITY_RING_CLASS = "bg-border shrink-0 rounded-full p-[1.5px]";

/** The 64px photo inside the ring. */
export const IDENTITY_PHOTO_CLASS =
  "relative block h-16 w-16 overflow-hidden rounded-full";

/** The boxes' grid: one column, two from 360px, where a half box is wide
 *  enough for "Pro Plan" (MESITA-2614). */
export const IDENTITY_GRID_CLASS =
  "grid w-full min-w-0 grid-cols-1 gap-2 min-[360px]:grid-cols-2";

/** One box of the card (MESITA-2596, MESITA-2599): 36px tall, 14px text, the
 *  full width of its grid cell. */
export const IDENTITY_CHIP_CLASS =
  "border-border text-foreground relative flex h-9 w-full min-w-0 items-center justify-center gap-2 rounded-full border px-4 text-sm font-semibold";

/** The boxes in reading order (Pato, MESITA-2621: "put profile pic, name,
 *  class plan, instagram"): name, Class · Plan as a pair, Instagram. */
export const IDENTITY_BOXES = ["name", "class", "plan", "instagram"] as const;
export type IdentityBox = (typeof IDENTITY_BOXES)[number];

/** Name and Instagram take the whole row; Class and Plan share one
 *  (MESITA-2614). */
export const IDENTITY_BOX_SPAN: Record<IdentityBox, string> = {
  name: "col-span-full",
  class: "",
  plan: "",
  instagram: "col-span-full",
};
