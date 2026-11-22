"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { goBack } from "@/lib/navigate";

// The Offers page's own placeholder (MESITA-4379): its one-line header (photo
// and name in bones), the balance line and the two buttons, then the two
// offer boxes, on the grey page — block for block where OffersPageBody draws.
export default function PlaceOffersLoading() {
  const router = useRouter();
  return (
    <div className="bg-card flex h-full min-h-0 flex-1 flex-col overflow-hidden" aria-busy>
      <header className="bg-card border-border flex h-14 shrink-0 items-center gap-1 border-b px-1.5">
        <button
          type="button"
          aria-label="Back"
          onClick={() => goBack(router)}
          className="text-foreground flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
        >
          <ChevronLeft className="h-6 w-6" strokeWidth={2.25} />
        </button>
        <div className="bg-muted h-8 w-8 shrink-0 rounded-full" />
        <div className="bg-muted ml-1.5 h-4 w-40 rounded-full" />
      </header>
      <div className="bg-background flex flex-1 flex-col gap-3 px-4 pt-4">
        <div className="flex items-center justify-between px-1">
          <div className="bg-muted h-4 w-20 rounded-full" />
          <div className="bg-muted h-6 w-36 rounded-full" />
        </div>
        <div className="flex gap-3">
          <div className="bg-muted h-12 flex-1 rounded-xl" />
          <div className="bg-muted h-12 flex-1 rounded-xl" />
        </div>
        <div className="bg-card border-border h-56 w-full rounded-2xl border" />
        <div className="bg-card border-border h-80 w-full rounded-2xl border" />
      </div>
    </div>
  );
}
