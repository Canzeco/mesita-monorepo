import Link from "next/link";
import { Share2 } from "lucide-react";
import { ClassChip } from "./ClassChip";
import { MesitaMark } from "./MesitaMark";

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
export function SimpleHeader({
  title,
  rightAction = "class",
}: {
  title: string;
  rightAction?: "class" | "invite" | "invite-and-class";
}) {
  const doubleRight = rightAction === "invite-and-class";
  return (
    <header className="border-border flex h-16 shrink-0 items-center gap-3 border-b px-4">
      <div className="flex items-center gap-2">
        <Link
          href="/profile"
          className="border-border bg-card shadow-glow text-secondary flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border p-2"
          aria-label="Mesita — profile"
        >
          <MesitaMark className="h-full w-full" />
        </Link>
        {doubleRight && (
          <span aria-hidden className="h-10 w-10 shrink-0 opacity-0" />
        )}
      </div>
      <div className="flex min-w-0 flex-1 items-center justify-center">
        <h1 className="font-display truncate text-xl leading-tight font-semibold tracking-tight">
          {title}
        </h1>
      </div>
      {rightAction === "invite-and-class" ? (
        <div className="flex items-center gap-2">
          <Link
            href="/invite"
            aria-label="Invite friends"
            className="bg-pink-gradient shadow-glow flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-white transition hover:opacity-95 active:scale-[0.98]"
          >
            <Share2 className="h-5 w-5" />
          </Link>
          <ClassChip />
        </div>
      ) : rightAction === "invite" ? (
        <Link
          href="/invite"
          aria-label="Invite friends"
          className="bg-pink-gradient shadow-glow flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-white transition hover:opacity-95 active:scale-[0.98]"
        >
          <Share2 className="h-5 w-5" />
        </Link>
      ) : (
        <ClassChip />
      )}
    </header>
  );
}
