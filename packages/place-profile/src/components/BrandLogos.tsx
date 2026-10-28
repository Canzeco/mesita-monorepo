// Source badges for the outside channels the place detail surface quotes:
// Google, Instagram, Facebook.
//
// Pure JSX — no React state, no hooks — so this module works inside both
// server and client components without needing a "use client" boundary.
// The header's channel row and the review cards share these so the Google
// mark never drifts between surfaces.

import { Facebook, Instagram } from "./brand-icons";

// GOOGLE'S OWN FOUR-COLOUR G (Pato, MESITA-2960: "USE THE ACTUAL
// GOOGLE LOGO THE G WITH THE COLORS"). It reverses
// MESITA-2618's solid red tile with a white G.
function GoogleG({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path
        fill="#FBBC05"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#EA4335"
        d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#34A853"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#4285F4"
        d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}

// The G on a black tile, the size and corner of the Instagram and Facebook
// tiles beside it, so the channel row reads as three tiles (MESITA-2963).
// Black, the Mesita Reserve fill, since gray read as disabled and azure as a
// second Facebook (MESITA-2985). Review cards use the larger tile; the header
// row uses compact.
export function GoogleLogo({
  compact = false,
  tiny = false,
}: {
  compact?: boolean;
  /** 16px, for a text line (the Reviews list's privacy line, MESITA-2927). */
  tiny?: boolean;
}) {
  return (
    <div
      className={
        "flex shrink-0 items-center justify-center bg-foreground " +
        (tiny
          ? "h-4 w-4 rounded"
          : compact
            ? "h-6 w-6 rounded-lg"
            : "h-8 w-8 rounded-lg")
      }
    >
      <GoogleG
        className={tiny ? "h-3 w-3" : compact ? "h-[18px] w-[18px]" : "h-5 w-5"}
      />
    </div>
  );
}

// The same G at button-glyph size, for Location's Google Maps button
// (MESITA-2688). 16px tall, the height of the Uber badge beside it.
export function GoogleMapsMark() {
  return (
    <span
      aria-hidden
      className="flex h-4 w-4 shrink-0 items-center justify-center"
    >
      <GoogleG className="h-4 w-4" />
    </span>
  );
}

// Instagram brand-gradient tile used as a source badge.
export function InstagramLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={
        "flex shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 " +
        (compact ? "h-6 w-6" : "h-8 w-8")
      }
    >
      <Instagram
        className={compact ? "h-3.5 w-3.5 text-white" : "h-4 w-4 text-white"}
        strokeWidth={2}
      />
    </div>
  );
}

// Facebook brand-blue tile used as a source badge.
export function FacebookLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={
        "flex shrink-0 items-center justify-center rounded-lg bg-[#1877F2] " +
        (compact ? "h-6 w-6" : "h-8 w-8")
      }
    >
      <Facebook
        className={
          compact
            ? "h-3.5 w-3.5 fill-white text-white"
            : "h-4 w-4 fill-white text-white"
        }
        strokeWidth={0}
      />
    </div>
  );
}
