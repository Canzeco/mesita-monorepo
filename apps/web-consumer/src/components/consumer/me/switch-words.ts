// The words of Me's two privacy switches, the same shape: Public profile
// (SocialNameRow, on Settings › Social only since MESITA-3072) and Use my
// Instagram photo (Me › Instagram's Photo group). Each paints its `on` line
// before its read lands, and the route fallbacks draw that first paint as
// itself so the line wraps where the row's does (Pato, MESITA-2701: "the
// placeholders must be similar to the page you are loading, like the
// sizes"). The words exist once, here.
//
// A PLAIN MODULE, NOT THE ROWS': /me/settings' fallback is a server
// component, and a value it imports from a "use client" file arrives as a
// client reference, not the words.

export const PUBLIC_PROFILE_SWITCH = {
  label: "Public profile",
  // Say where you show (Pato, MESITA-2697: "say that you are visible in
  // social feed basically").
  on: "You're visible in the Social feed",
  off: "Only your first name shows in the Social feed, and others' Instagram stays hidden",
} as const;

export const INSTAGRAM_PHOTO_SWITCH = {
  label: "Use my Instagram photo",
  // True before and after connecting (MESITA-3001).
  on: "Your Mesita picture comes from your Instagram",
  off: "We keep only your username and followers",
} as const;
