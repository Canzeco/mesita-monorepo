// Shared brand marks used by the venue detail surface.
//
// Pure JSX — no React state, no hooks — so this module works inside both
// server and client components without needing a "use client" boundary.
// Previously each consumer of these glyphs (VenueDetailBody, ReviewCard)
// inlined them; consolidating here keeps the Google SVG paths and the
// Mesita gradient mark in one spot.

import { Facebook, Instagram } from "lucide-react";

// Multi-color Google "G" inside a white circle. h-8 w-8 to align with the
// other source badges (Instagram / Facebook / Mesita) on the reviews
// summary and individual review cards.
export function GoogleLogo() {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white">
      <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
        <path
          fill="#FFC107"
          d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
        />
        <path
          fill="#FF3D00"
          d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
        />
        <path
          fill="#4CAF50"
          d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
        />
        <path
          fill="#1976D2"
          d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
        />
      </svg>
    </div>
  );
}

// Instagram brand-gradient tile used as a source badge.
export function InstagramLogo() {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400">
      <Instagram className="h-4 w-4 text-white" strokeWidth={2} />
    </div>
  );
}

// Facebook brand-blue tile used as a source badge.
export function FacebookLogo() {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1877F2]">
      <Facebook className="h-4 w-4 fill-white text-white" strokeWidth={0} />
    </div>
  );
}

// Mesita flame mark — the official brand glyph (pink flame from the
// `/public/brand` lockup) sitting inside a pink-gradient badge so it
// reads as part of the Google/Instagram/Facebook attribution row.
//
// Two variants:
//   - "sm": h-5 w-5 rounded-md — the inline brand spot in the reviews
//     summary box.
//   - "md": h-8 w-8 rounded-full — the source badge on individual
//     review cards so it matches the Google/Instagram/Facebook circles.
// Static class strings (instead of template-literal concatenation) so
// Tailwind's class scanner can see every variant. The flame itself is
// rendered in white on the gradient so a single SVG path covers both
// variants — the wrapper's size class drives the final glyph size.
export function MesitaMark({ variant = "md" }: { variant?: "sm" | "md" }) {
  const flame = (
    <svg
      viewBox="0 0 100 100"
      className="h-[60%] w-[60%]"
      fill="currentColor"
      aria-hidden
    >
      <path d="M81.3,28.5c-4.9,0-8.4,5.1-8.4,14.9c0,4.1-2.1,7.3-5.5,7.3c-4.1,0-5.6-2.9-5.6-6.2c0-6,5.7-6.7,5.7-16.2c0-6.9-8.8-12.2-8.8-12.2c2.8,9.9-2.3,15.1-7.5,15.1c-3,0-7.2-2.1-7.2-9.9c0-10.5,8-16.5,8-16.5C32.4,5,28.8,24.2,32.7,33.6c2.5,5.8,3.1,13.3-2.9,13.3c-7.1,0-3.4-13.2-3.4-13.2c-3.1,1.5-12.1,8.4-13,22.4c-0.1,0.7-0.1,1.4-0.1,2.2c0,0.7,0,1.4,0.1,2.1c0,0,0,0.1,0,0.1C14.5,79.8,30.5,95,50,95c20.3,0,36.7-16.4,36.7-36.7C86.7,40.2,75.6,37.4,81.3,28.5z M50,90.2c0,0-16.1-3.4-16.1-18.6c0-13.4,10-22.7,18.7-22.7c0,0-7.3,4.4-7.3,15c0,7.1,3.8,9,6.5,9c4.8,0,9.4-4.8,6.8-13.8c0,0,7.4,5.2,7.4,13.5C66.1,86.1,50,90.2,50,90.2z" />
    </svg>
  );
  if (variant === "sm") {
    return (
      <span className="bg-pink-gradient flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-white">
        {flame}
      </span>
    );
  }
  return (
    <span className="bg-pink-gradient flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white">
      {flame}
    </span>
  );
}
