// Source badges for the outside channels the place detail surface quotes:
// Google, Instagram, Facebook.
//
// Pure JSX — no React state, no hooks — so this module works inside both
// server and client components without needing a "use client" boundary.
// The reviews summary and the review cards share these so the Google SVG
// paths don't drift between surfaces.

import { Facebook, Instagram } from "./brand-icons";

// Red circle, the same outer size as the Instagram and Facebook marks.
// The header uses compact: the G is smaller than the white disc so every
// color, including the red segment, sits on white instead of blending
// into the tile. Review cards use the larger tile.
export function GoogleLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={
        "flex shrink-0 items-center justify-center rounded-full bg-[#EA4335] " +
        (compact ? "h-6 w-6" : "h-8 w-8")
      }
    >
      <div
        className={
          "flex items-center justify-center rounded-full bg-white " +
          (compact ? "h-[18px] w-[18px]" : "h-[22px] w-[22px]")
        }
      >
        <svg
          viewBox="0 0 48 48"
          className={compact ? "h-3 w-3" : "h-4 w-4"}
          aria-hidden
        >
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
    </div>
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
