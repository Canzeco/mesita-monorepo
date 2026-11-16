"use client";

import { ScreenHeader } from "@/components/consumer/nav/Screen";

// The Reserve page's own placeholder, so the place screen's skeleton
// (place/[id]/loading.tsx) never stands in for it. Its header is the page's
// own (ScreenHeader, MESITA-4119), the body in bones under it.
export default function PlaceReserveLoading() {
  return (
    <div className="bg-background flex flex-1 flex-col overflow-hidden" aria-busy>
      <ScreenHeader title="Reserve a table" onBack={() => window.history.back()} />
      <div className="flex flex-1 flex-col px-5 pt-5">
        <div className="bg-muted h-6 w-48 rounded" />
        <div className="bg-muted mt-6 h-16 w-full rounded-2xl" />
        <div className="bg-muted mt-4 h-10 w-full rounded-full" />
        <div className="bg-muted mt-4 h-14 w-full rounded-2xl" />
      </div>
    </div>
  );
}
