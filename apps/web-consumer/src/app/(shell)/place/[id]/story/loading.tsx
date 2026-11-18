"use client";

import { ScreenHeader } from "@/components/consumer/nav/Screen";

// The Story page's own placeholder (MESITA-4303): its header, then the boxes
// in bones on the grey page, the pinned bar under them.
export default function PlaceStoryLoading() {
  return (
    <div className="bg-background flex flex-1 flex-col overflow-hidden" aria-busy>
      <ScreenHeader title="Story" onBack={() => window.history.back()} />
      <div className="flex flex-1 flex-col gap-3 px-4 pt-4">
        <div className="bg-card border-border h-20 w-full rounded-2xl border" />
        <div className="bg-card border-border h-32 w-full rounded-2xl border" />
        <div className="bg-card border-border h-48 w-full rounded-2xl border" />
      </div>
      <div className="bg-card border-border h-20 shrink-0 border-t" />
    </div>
  );
}
