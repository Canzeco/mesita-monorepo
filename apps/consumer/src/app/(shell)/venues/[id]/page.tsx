import Link from "next/link";
import { ArrowLeft, Share2 } from "lucide-react";
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
      <header className="bg-background/85 sticky top-0 z-20 flex items-center justify-between gap-3 px-3 py-3 backdrop-blur">
        <Link
          href="/discover/swipe"
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-zinc-900 transition hover:bg-white"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <button
          type="button"
          aria-label="Share"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-zinc-900 transition hover:bg-white"
        >
          <Share2 className="h-4 w-4" />
        </button>
      </header>
      <VenueDetailBody venue={mockVenue} />
    </div>
  );
}
