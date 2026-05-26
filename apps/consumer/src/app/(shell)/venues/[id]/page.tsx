import Link from "next/link";
import { X } from "lucide-react";
import { VenueDetailBody } from "@/components/consumer/VenueDetailBody";
import { mockVenue } from "@/lib/mock/venue";

export const dynamic = "force-dynamic";

// Hard-nav landing for /venues/[id] (refresh, direct URL, new tab). When
// a user soft-navs from inside (shell) — e.g. tapping a card on
// /discover/catalog — they hit the intercepted variant at
// (shell)/@modal/(.)venues/[id]/page.tsx instead, which renders inside a
// modal on top of the underlying surface.
//
// Mocked: every id resolves to the same fixture in @/lib/mock/venue.

export default async function VenueDetailPage() {
  return (
    <div className="bg-background relative flex flex-1 flex-col overflow-y-auto">
      <Link
        href="/discover/swipe"
        className="absolute top-3 left-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-zinc-900 backdrop-blur transition hover:bg-white"
        aria-label="Close"
      >
        <X className="h-4 w-4" />
      </Link>
      <VenueDetailBody venue={mockVenue} />
    </div>
  );
}
