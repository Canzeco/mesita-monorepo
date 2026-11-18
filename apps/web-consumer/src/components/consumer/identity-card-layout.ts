// The identity card's geometry, once (MESITA-2701). IdentityCard draws it
// with the guest's photo and facts; IdentityCardSkeleton
// (app/(shell)/me/me-skeletons.tsx) draws the same shape empty while Me's
// profile read is out, and /me's loading.tsx draws that skeleton too (Pato,
// MESITA-2701: "the placeholders must be similar to the page you are
// loading, like the sizes"). The ring, the photo, the row and the two lines
// live here, so the two cannot drift a pixel apart.
//
// A PLAIN MODULE, NOT THE CARD'S: me-skeletons is imported by server
// loading.tsx files, and a value they import from a "use client" file
// arrives as a client reference, not the string.
//
// PHOTO AT THE LEFT, NAME OVER INSTAGRAM AT ITS RIGHT (Pato, MESITA-4308:
// "profile-photo, name / profile-photo, instagram"), plain text, no outlines,
// Instagram's own profile header (D1 of the design review). The name is the
// Me tiles' own text-sm bold, no new size (D2).
//
//   ┌ring 63px┐ 14px  Patricio Canseco                 text-xl bold, ink
//   │ photo   │
//   └─────────┘       ◎ @pato.canseco · ~320 followers  text-sm, muted ink

// THE NAME LEADS (MESITA-4313): 20px bold over the handle, beside a 60px
// photo; it was a 14px name beside a 64px photo, so the eye landed on the
// photo's grey silhouette.

/** The card: one row, the photo then the two lines, 14px between. */
export const IDENTITY_CARD_CLASS = "flex w-full min-w-0 items-center gap-3.5";

/** The photo's 1.5px ring: plain structure, never a colour that means
 *  something. */
export const IDENTITY_RING_CLASS = "bg-border shrink-0 rounded-full p-[1.5px]";

/** The 60px photo inside the ring. */
export const IDENTITY_PHOTO_CLASS =
  "relative block h-15 w-15 overflow-hidden rounded-full";

/** The two lines, left-aligned, filling the rest of the row: 28 + 4 + 20 =
 *  52px, centred against the 63px ring. */
export const IDENTITY_LINES_CLASS = "flex min-w-0 flex-1 flex-col gap-1";

/** Line one: the name, in the Me tiles' own style (text-sm bold). */
export const IDENTITY_NAME_CLASS =
  "text-foreground relative flex h-7 min-w-0 items-center text-xl font-bold tracking-tight";

/** Line two: Instagram, its 20px badge then the handle, in muted ink. */
export const IDENTITY_INSTAGRAM_CLASS =
  "text-muted-foreground relative flex h-5 min-w-0 items-center gap-1.5 text-sm";
