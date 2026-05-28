import Link from "next/link";
import { ClassChip } from "./ClassChip";

// Shared header used by every top-level surface that isn't /discover
// (Reservations, Coupons, Pay, Share, Profile). The right-side
// ClassChip mirrors the one on DiscoverHeader so the user's tier is
// glanceable everywhere — set `chip={false}` to opt out on surfaces
// where it would be redundant (e.g. /profile, where the same class
// info lives inline in the page body).
export function SimpleHeader({
  title,
  eyebrow,
  chip = true,
}: {
  title: string;
  eyebrow?: string;
  chip?: boolean;
}) {
  return (
    // Fixed h-16 (64px) so this header lines up pixel-for-pixel with
    // DiscoverHeader. Without it the two TopBar variants rendered at
    // different heights and the body band visibly shifted as the user
    // tabbed between /reservations and /discover.
    <header className="border-border flex h-16 shrink-0 items-center gap-3 border-b px-4">
      <Link
        href="/profile"
        className="bg-peacock shadow-glow flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-lg"
        aria-label="Profile"
      >
        🦚
      </Link>
      <div className="min-w-0 flex-1">
        <h1 className="font-display text-xl leading-tight font-semibold tracking-tight">
          {title}
        </h1>
        {eyebrow && (
          <p className="text-muted-foreground mt-0.5 text-[10px] font-medium tracking-[0.18em] uppercase">
            {eyebrow}
          </p>
        )}
      </div>
      {chip && <ClassChip />}
    </header>
  );
}
