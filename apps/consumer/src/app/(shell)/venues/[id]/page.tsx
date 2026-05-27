import Link from "next/link";
import { ArrowLeft, Share2 } from "lucide-react";
import {
  VenueDetailActionBar,
  VenueDetailBody,
} from "@/components/consumer/VenueDetailBody";
import { mockVenue } from "@/lib/mock/venue";

export const dynamic = "force-dynamic";

// Hard-nav landing for /venues/[id] (refresh, direct URL, new tab). When
// a user soft-navs from inside (shell) — e.g. tapping a card on
// /discover/catalog — they hit the intercepted variant at
// (shell)/@modal/(.)venues/[id]/page.tsx instead, which renders inside a
// modal on top of the underlying surface.
//
// Layout mirrors the modal shell — header, scroll area, action bar in
// three rigid flex-col rows — so the opaque CTA buttons never occlude the
// scrolled-past body content. Mocked: every id resolves to the same
// fixture in @/lib/mock/venue.

export default async function VenueDetailPage() {
  return (
    <div className="bg-background relative flex flex-1 flex-col overflow-hidden">
      <header className="bg-background/85 z-20 flex shrink-0 items-center gap-3 px-3 py-3 backdrop-blur">
        <Link
          href="/discover/swipe"
          aria-label="Back"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/95 text-zinc-900 transition hover:bg-white"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <p className="font-display flex-1 truncate text-center text-sm font-semibold">
          {mockVenue.name}
        </p>
        <button
          type="button"
          aria-label="Share"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/95 text-zinc-900 transition hover:bg-white"
        >
          <Share2 className="h-4 w-4" />
        </button>
      </header>
      <div className="flex-1 overflow-y-auto">
        <VenueDetailBody venue={mockVenue} />
      </div>
      <VenueDetailActionBar />
    </div>
  );
}
