import { cn } from "@/lib/utils";

// THE YELLOW BADGE (Pato, 2026-11-23, MESITA-4714: "add like a tag if more
// than +1K, kinda like verified but yellow tag at the right of instagram,
// that tag means that you have more than +1000 followers and that your
// account is public"). Right of the
// @handle wherever a guest's Instagram shows. The server decides it
// (instagram_badge / instagramBadge, supabase _shared/instagram-badge.ts);
// this only draws it.
//
// BLUE, LIKE INSTAGRAM'S (Pato, 2026-11-23, MESITA-4721: "that verification
// badge looks like shit. it must be blue"): a solid blue scalloped seal
// with a white check and no dark outline, replacing the yellow one.
export const FOLLOWERS_BADGE_LABEL =
  "More than 1,000 followers, public account";

export function FollowersBadge({ className }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label={FOLLOWERS_BADGE_LABEL}
      title={FOLLOWERS_BADGE_LABEL}
      className={cn("inline-flex shrink-0", className)}
      data-followers-badge
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
        <path
          d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"
          fill="#0095F6"
          stroke="#0095F6"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
        <path
          d="m8.5 12 2.5 2.5 4.5-5"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth={2.25}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
