import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";

// THE YELLOW BADGE (Pato, 2026-11-23, MESITA-4714: "add like a tag if more
// than +1K, kinda like verified but yellow tag at the right of instagram,
// that tag means that you have more than +1000 followers and that your
// account is public"). A filled yellow seal with a dark check, right of the
// @handle wherever a guest's Instagram shows. The server decides it
// (instagram_badge / instagramBadge, supabase _shared/instagram-badge.ts);
// this only draws it.
export const FOLLOWERS_BADGE_LABEL = "More than 1,000 followers, public account";

export function FollowersBadge({ className }: { className?: string }) {
  return (
    <span role="img" aria-label={FOLLOWERS_BADGE_LABEL} title={FOLLOWERS_BADGE_LABEL} className={cn("inline-flex shrink-0", className)} data-followers-badge>
      <BadgeCheck className="h-4 w-4" fill="#FFC400" stroke="#1C1C1E" strokeWidth={2} aria-hidden />
    </span>
  );
}
