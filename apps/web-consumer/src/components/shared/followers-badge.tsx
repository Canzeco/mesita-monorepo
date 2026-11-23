import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

// THE YELLOW BADGE (Pato, 2026-11-23, MESITA-4714: "add like a tag if more
// than +1K, kinda like verified but yellow tag at the right of instagram,
// that tag means that you have more than +1000 followers and that your
// account is public"). Right of the @handle wherever a guest's Instagram
// shows. The server decides it (instagram_badge / instagramBadge, supabase
// _shared/instagram-badge.ts); this only draws it.
//
// THE INSTAGRAM CHIP'S TWIN (Pato, MESITA-4722: "verification must be same
// size as instagram, to keep symmetry, and make it yellow … blue not
// because it understand as instagram verification, not our own"): a round
// 20px yellow disc with a dark check, the same shape and size as the
// Instagram gradient chip on the handle's other side. Never blue
// (MESITA-4721's blue seal read as Instagram's own verification).
export const FOLLOWERS_BADGE_LABEL =
  "More than 1,000 followers, public account";

export function FollowersBadge({ className }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label={FOLLOWERS_BADGE_LABEL}
      title={FOLLOWERS_BADGE_LABEL}
      className={cn(
        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#FFC400]",
        className,
      )}
      data-followers-badge
    >
      <Check
        className="h-3 w-3 text-neutral-950"
        strokeWidth={3.5}
        aria-hidden
      />
    </span>
  );
}
