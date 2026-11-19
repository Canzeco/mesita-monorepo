"use client";

import { ChevronLeft } from "lucide-react";
import { Panel } from "@/components/shared/Panel";

// The Reserve page's own placeholder, so the place screen's skeleton
// (place/[id]/loading.tsx) never stands in for it. It draws the page's frame
// in grey (MESITA-4443, Pato: "NAVIGATE IMMEDIATELY … THEN WITH THE LOADING
// GRAY PLACEHOLDERS WAIT"): the one top box (Back, round photo, name, the
// step label over three segments, MESITA-4259), the Date and Time panels,
// and the pinned button. The place screen prefetches this frame, so a
// Reserve tap paints it at once. Back works while it waits.
const BONE = "bg-muted rounded";

export default function PlaceReserveLoading() {
  return (
    <div className="bg-background relative flex flex-1 flex-col overflow-hidden" aria-busy>
      <div className="flex min-h-0 flex-1 flex-col px-4">
        <Panel className="mt-3">
          <div className="px-3 pt-3 pb-3.5">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => window.history.back()}
                className="hover:bg-muted flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition"
                aria-label="Back"
              >
                <ChevronLeft className="h-6 w-6" aria-hidden />
              </button>
              <span className="bg-muted h-9 w-9 shrink-0 rounded-full" />
              <span className={`${BONE} h-5 w-40`} />
            </div>
            <span className={`${BONE} mt-3 ml-1 block h-4 w-24`} />
            <div className="mt-2 grid grid-cols-3 gap-1.5 px-1">
              <span className="bg-muted h-1 rounded-full" />
              <span className="bg-muted h-1 rounded-full" />
              <span className="bg-muted h-1 rounded-full" />
            </div>
          </div>
        </Panel>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden py-4">
          <Panel>
            <div className="p-4">
              <span className={`${BONE} block h-5 w-16`} />
              <div className="mt-4 grid grid-cols-7 gap-2">
                {Array.from({ length: 7 }, (_, i) => (
                  <span key={i} className="bg-muted h-14 rounded-xl" />
                ))}
              </div>
            </div>
          </Panel>
          <Panel>
            <div className="p-4">
              <span className={`${BONE} block h-5 w-16`} />
              <div className="mt-4 grid grid-cols-5 gap-2">
                {Array.from({ length: 15 }, (_, i) => (
                  <span key={i} className="bg-muted h-11 rounded-full" />
                ))}
              </div>
            </div>
          </Panel>
        </div>
        <div className="border-border -mx-4 shrink-0 border-t px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <span className="bg-muted block h-14 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
