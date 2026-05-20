import { redirect } from "next/navigation";
import type { VenueStatus } from "@/lib/api/venues";

// Statuses that mean "venue exists but the owner hasn't proved they
// operate it yet". Pages under /unit/<id>/ should bounce the manager
// to /unit/<id>/verify until one of these clears.
const PENDING_STATUSES: VenueStatus[] = [
  "pending_verification",
  "pending_review",
];

// Throws via Next.js redirect() when the venue is in an unverified
// state. Call this from each /unit/<id>/* page before rendering, and
// the manager lands on /verify until they prove ownership.
//
// /verify itself doesn't call this (it's the destination); all other
// venue surfaces do.
export function redirectIfUnverified(
  venueId: string,
  status: VenueStatus,
): void {
  if (PENDING_STATUSES.includes(status)) {
    redirect(`/unit/${venueId}/verify`);
  }
}
