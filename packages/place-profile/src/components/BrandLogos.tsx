// Source badges for the outside channels the place detail surface quotes:
// Google, Instagram, Facebook.
//
// Pure JSX — no React state, no hooks — so this module works inside both
// server and client components without needing a "use client" boundary.
// The header's channel row and the review cards share these so the Google
// mark never drifts between surfaces.

import { Facebook, Instagram } from "./brand-icons";

// ONE SOLID RED TILE, THE G IN WHITE (Pato, MESITA-2618: "i don't like that
// google icon at all. search an icon that its all red or something"). The
// same rounded tile as the Instagram and Facebook marks beside it, so the
// channel row reads as three of one shape. It replaced a red ring around a
// white disc holding the four-colour G, which read as a target.
// Review cards use the larger tile; the header row uses compact.
export function GoogleLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={
        "flex shrink-0 items-center justify-center rounded-lg bg-[#EA4335] " +
        (compact ? "h-6 w-6" : "h-8 w-8")
      }
    >
      <svg
        viewBox="0 0 48 48"
        className={compact ? "h-3.5 w-3.5 fill-white" : "h-4 w-4 fill-white"}
        aria-hidden
      >
        <path d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
      </svg>
    </div>
  );
}

// The same red G tile at button-glyph size, for Location's Google Maps button
// (Pato, MESITA-2688: a better icon than the red pin). 16px tall, the height
// of the Uber badge beside it.
export function GoogleMapsMark() {
  return (
    <span
      aria-hidden
      className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] bg-[#EA4335]"
    >
      <svg viewBox="0 0 48 48" className="h-2.5 w-2.5 fill-white" aria-hidden>
        <path d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
      </svg>
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
