"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { goBack } from "@/lib/navigate";

// The Offers page's own placeholder (MESITA-4379), block for block where
// OffersPageBody draws today (Pato, 2026-11-21, MESITA-4631: "update the
// loading placeholders of this page"): the one-line header (photo and name in
// bones), the dark Loyalty Card band, then the two offer boxes, Special
// Offers (one row) and Classic Offers (two rows), on the grey page. A box is
// its title over a hairline, then rows of a 56px thumbnail, two lines and the
// bonus badge, hairlines between. Until MESITA-4631 it drew a balance line,
// two buttons and two tall empty boxes.

const BONE = "bg-muted rounded-full";

function OfferRowBone() {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <div className="bg-muted h-14 w-14 shrink-0 rounded-2xl" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className={`${BONE} h-4 w-20`} />
        <div className={`${BONE} h-4 w-40`} />
      </div>
      <div className="bg-muted h-12 w-[4.25rem] shrink-0 rounded-xl" />
    </div>
  );
}

function OfferBoxBone({ rows }: { rows: number }) {
  return (
    <div className="border-border bg-card divide-border shrink-0 divide-y overflow-hidden rounded-2xl border">
      <div className="px-4 py-3.5">
        <div className={`${BONE} h-4 w-32`} />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <OfferRowBone key={i} />
      ))}
    </div>
  );
}

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
        <div className={`${BONE} ml-1.5 h-4 w-40`} />
      </header>
      <div className="bg-background flex flex-1 flex-col gap-3 px-4 pt-4">
        {/* The Loyalty Card band: ink, its words in paper-tinted bones. */}
        <div className="bg-foreground flex shrink-0 flex-col gap-2.5 rounded-2xl p-4">
          <div className="bg-paper/20 h-3.5 w-40 rounded-full" />
          <div className="bg-paper/20 h-6 w-36 rounded-full" />
        </div>
        <OfferBoxBone rows={1} />
        <OfferBoxBone rows={2} />
      </div>
      <p role="status" className="sr-only">
        Loading offers
      </p>
    </div>
  );
}
