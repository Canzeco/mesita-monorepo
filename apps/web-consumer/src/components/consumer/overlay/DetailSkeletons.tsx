"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { goBack } from "@/lib/navigate";
import {
  PlaceDetailBodySkeleton,
  PlaceProfileSkeleton,
  PlaceTopBarSkeleton,
} from "@mesita/place-profile";
import { Skeleton } from "@/components/shared";
import { ReservationDetailModalShell } from "@/components/consumer/ReservationDetailModalShell";
import { ReservationPageFrame } from "@/components/consumer/ReservationPageFrame";
import { useSlideOverClose } from "@/components/consumer/overlay/SlideOverShell";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { RESERVATION_FLOW } from "@/lib/reservation-state";
import { cn } from "@/lib/utils";

// The loading states of the detail screens, for their loading.tsx files.
// EACH ONE IS ITS LOADED SCREEN'S FRAME (Pato, MESITA-2701: "the placeholders
// must be similar to the page you are loading, like the sizes"): the same
// bands, cards and rows at the same sizes and in the same order, so content
// lands without a jump. The slide-over ones render INSIDE the SlideOverShell
// that the segment's layout.tsx mounts, so the panel slides in once and the
// silhouette resolves to content in place. The reservation ones stand in
// the loaded screen's own frames (ReservationDetailModalShell,
// ReservationPageFrame) and draw one metadata row per label the body lists,
// so neither header nor card is a copy.
// Client only for the live Backs (useSlideOverClose, the router); nothing
// here holds state.

// ── Place ────────────────────────────────────────────────────────────────

/** The direct link (/place/[id], PlaceDetailPageBody): the grey ground, the
 *  shell's bar hidden as the page hides it, the package's PlaceProfile
 *  silhouette.
 *  THE CHEVRON IS LIVE: this page hides the bottom bar, so an inert Back
 *  would leave a slow load with no way out. It does what the loaded page's
 *  does (PlaceDetailPageBody): back, or Home when this
 *  tab has no history. */
export function PlacePageSkeleton() {
  const router = useRouter();
  // Back where you came from, or Home on a cold open (lib/navigate.ts).
  const onBack = useCallback(() => goBack(router, CONSUMER_ROUTES.home), [router]);
  return (
    <div className="bg-background relative flex flex-1 flex-col overflow-hidden">
      <PlaceProfileSkeleton onBack={onBack} />
    </div>
  );
}

/** The in-app slide-over (PlaceDetailModalShell): PlaceTopBar's silhouette
 *  with its chevron live (a slow load can be dismissed), then the grey
 *  scroller with the body silhouette. */
export function PlaceSlideOverSkeleton() {
  const close = useSlideOverClose();
  return (
    <>
      <PlaceTopBarSkeleton onBack={close} />
      <div className="bg-background min-h-0 flex-1 overflow-y-auto">
        <PlaceDetailBodySkeleton />
      </div>
    </>
  );
}

// ── Reservation ──────────────────────────────────────────────────────────

/** ReservationDetailBody (MESITA-3649): the hero card (a 5:2 photo, the
 *  name and its pill, the time large and "Table for N"), the reference
 *  line, the four-step stepper, then View place, Reschedule and Cancel. The
 *  route's loading.tsx draws it, and so does reservation-detail-fetch while
 *  the row is fetched, so the two placeholders are one. */
export function ReservationBodySkeleton() {
  return (
    <div className="flex flex-col gap-4 px-4 pt-4 pb-8">
      <span className="sr-only">Loading reservation</span>
      <section
        aria-hidden
        className="border-border bg-card overflow-hidden rounded-2xl border"
      >
        <Skeleton className="aspect-[5/2] w-full rounded-none" />
        <div className="px-4 pt-3 pb-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex h-6 items-center">
              <Skeleton className="h-4 w-40 max-w-full" />
            </div>
            <Skeleton className="type-label h-[calc(1lh_+_6px)] w-20 shrink-0 rounded-full" />
          </div>
          <div className="font-display mt-3 flex h-[1lh] items-center text-2xl leading-tight">
            <Skeleton className="h-6 w-52 max-w-full" />
          </div>
          <div className="mt-1 flex h-6 items-center">
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
      </section>

      {/* The reference line. */}
      <div aria-hidden className="-mt-1 flex h-5 items-center px-1">
        <Skeleton className="h-3.5 w-36" />
      </div>

      <div aria-hidden className="flex items-center gap-1.5">
        {RESERVATION_FLOW.map((step) => (
          <div key={step} className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className="h-1 rounded-full" />
            <div className="type-label flex h-[1lh] items-center">
              <Skeleton className="h-2.5 w-3/4" />
            </div>
          </div>
        ))}
      </div>

      <div aria-hidden className="flex flex-col gap-2">
        {["w-20", "w-24"].map((w) => (
          <div
            key={w}
            className="border-border bg-card flex items-center justify-between gap-3 rounded-2xl border px-4 py-3"
          >
            <span className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-full" />
              <Skeleton className={cn("h-3.5", w)} />
            </span>
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
        <div className="border-border bg-card flex items-center justify-center rounded-2xl border px-4 py-3">
          <div className="flex h-5 items-center">
            <Skeleton className="h-3.5 w-36" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** The intercepted reservation: the real ReservationDetailModalShell (live
 *  Back, "Reservation", the share square waiting for the name) around the
 *  body silhouette, the same frame the fetch draws while it waits. */
export function ReservationSlideOverSkeleton() {
  return (
    <ReservationDetailModalShell placeName={null}>
      <ReservationBodySkeleton />
    </ReservationDetailModalShell>
  );
}

/** The hard-nav reservation (/reservation/[id]): the page's own frame
 *  (ReservationPageFrame: its header, the back circle a live link to Me,
 *  and its scroller), then the body silhouette. */
export function ReservationPageSkeleton() {
  return (
    <ReservationPageFrame>
      <ReservationBodySkeleton />
    </ReservationPageFrame>
  );
}
