import Link from "next/link";
import { ClassChip } from "./ClassChip";

// Shared header for every top-level surface that isn't /discover
// (Reservations, Coupons, Pay, Share, Profile).
//
// Strict 3-column structure that matches DiscoverHeader pixel-for-pixel:
//
//   [Peacock logo · 40px]   [Centered title]   [Class chip · 40px]
//
// The middle column is `flex-1` and centers its content via flex
// alignment. Any future surface that wants a richer center (icon row,
// pill bar, etc.) drops in here without breaking the column model.
// `h-16` (64px) is shared with DiscoverHeader so the body band gets a
// consistent reservation across every route.
export function SimpleHeader({ title }: { title: string }) {
  return (
    <header className="border-border flex h-16 shrink-0 items-center gap-3 border-b px-4">
      <Link
        href="/profile"
        className="bg-peacock shadow-glow flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-lg"
        aria-label="Profile"
      >
        🦚
      </Link>
      <div className="flex min-w-0 flex-1 items-center justify-center">
        <h1 className="font-display truncate text-xl leading-tight font-semibold tracking-tight">
          {title}
        </h1>
      </div>
      <ClassChip />
    </header>
  );
}
