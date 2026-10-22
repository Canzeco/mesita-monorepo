"use client";

import { useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Share2 } from "lucide-react";
import {
  PlaceDetailBodySkeleton,
  PlaceProfileSkeleton,
  PlaceTopBarSkeleton,
} from "@mesita/place-profile";
import { Skeleton } from "@/components/shared";
import {
  SlideOverHeader,
  useSlideOverClose,
} from "@/components/consumer/overlay/SlideOverShell";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { RESERVATION_FLOW } from "@/lib/reservation-state";
import { cn } from "@/lib/utils";

// The loading states of the detail screens, for their loading.tsx files.
// EACH ONE IS ITS LOADED SCREEN'S FRAME (Pato, MESITA-2701: "the placeholders
// must be similar to the page you are loading, like the sizes"): the same
// bands, cards and rows at the same sizes and in the same order, so content
// lands without a jump. The slide-over ones render INSIDE the SlideOverShell
// that the segment's layout.tsx mounts, so the panel slides in once and the
// silhouette resolves to content in place.
// Client only for the live Backs (useSlideOverClose, the router); nothing
// here holds state.

// ── Place ────────────────────────────────────────────────────────────────

/** The direct link (/place/[id], PlaceDetailPageBody): the grey ground, the
 *  shell's bar hidden as the page hides it, the package's PlaceProfile
 *  silhouette. `creating` is the opening screen of a Google-only place
 *  (OpeningGooglePlace), whose Overview is the "No overview yet" screen.
 *  THE CHEVRON IS LIVE: this page hides the bottom bar, so an inert Back
 *  would leave a slow load with no way out. It does what the loaded page's
 *  does (PlaceDetailPageBody, OpeningGooglePlace): back, or Home when this
 *  tab has no history. */
export function PlacePageSkeleton({ creating = false }: { creating?: boolean }) {
  const router = useRouter();
  const onBack = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.replace(CONSUMER_ROUTES.home);
  }, [router]);
  return (
    <div className="bg-background relative flex flex-1 flex-col overflow-hidden">
      <style>{`nav[data-shell-nav]{display:none}`}</style>
      <PlaceProfileSkeleton onBack={onBack} creating={creating} />
    </div>
  );
}

/** The in-app slide-over (PlaceDetailModalShell): PlaceTopBar's silhouette
 *  with its chevron live (a slow load can be dismissed), then the grey
 *  scroller with the body silhouette. */
export function PlaceSlideOverSkeleton({
  creating = false,
}: {
  creating?: boolean;
}) {
  const close = useSlideOverClose();
  return (
    <>
      <PlaceTopBarSkeleton onBack={close} />
      <div className="bg-background min-h-0 flex-1 overflow-y-auto">
        <PlaceDetailBodySkeleton creating={creating} />
      </div>
    </>
  );
}

// ── Reservation ──────────────────────────────────────────────────────────

/** ReservationDetailBody: the photo card (16:9 photo, the name and its
 *  state pill), the four-step stepper, the banner, the When · Party · State
 *  card of 44px rows, then View place, Reschedule and Cancel. The route's
 *  loading.tsx draws it, and so does reservation-detail-fetch while the
 *  row is fetched, so the two placeholders are one. */
export function ReservationBodySkeleton() {
  return (
    <div className="flex flex-col gap-4 px-4 pt-4 pb-8">
      <span className="sr-only">Loading reservation</span>
      <section
        aria-hidden
        className="border-border bg-card overflow-hidden rounded-2xl border"
      >
        <Skeleton className="aspect-[16/9] w-full rounded-none" />
        <div className="flex items-start justify-between gap-2 px-4 py-3">
          <div className="font-display flex h-[1lh] min-w-0 items-center text-xl leading-tight">
            <Skeleton className="h-5 w-40 max-w-full" />
          </div>
          {/* The state pill: one 11px line, py-0.5 and its 1px border
              (21.4px), as wide as a "Confirmed" pill. */}
          <Skeleton className="type-label h-[calc(1lh_+_6px)] w-20 shrink-0 rounded-md" />
        </div>
      </section>

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

      {/* The banner: two 13px lines in its py-2.5 box. */}
      <Skeleton className="h-14 w-full rounded-2xl" />

      <section
        aria-hidden
        className="border-border bg-card divide-border/70 divide-y overflow-hidden rounded-2xl border"
      >
        {["w-28", "w-16", "w-20"].map((w) => (
          <div key={w} className="flex items-center gap-3 px-4 py-3">
            <Skeleton className="h-4 w-4 rounded" />
            <div className="flex-1">
              <Skeleton className="h-3 w-14" />
            </div>
            <div className="flex h-5 items-center">
              <Skeleton className={cn("h-3.5", w)} />
            </div>
          </div>
        ))}
      </section>

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

/** The intercepted reservation (ReservationDetailModalShell): its header as
 *  drawn there (live Back, "Reservation", the share square, inert here),
 *  then the body silhouette. */
export function ReservationSlideOverSkeleton() {
  return (
    <>
      <SlideOverHeader
        title="Reservation"
        actions={
          <span
            aria-hidden
            className="border-border bg-card text-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border"
          >
            <Share2 className="h-4 w-4" />
          </span>
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <ReservationBodySkeleton />
      </div>
    </>
  );
}

/** The hard-nav reservation (/reservation/[id]): the page's own header,
 *  its back circle the same live link to Me the page draws, then the body
 *  silhouette. */
export function ReservationPageSkeleton() {
  return (
    <div className="relative flex h-full flex-col">
      <header className="bg-background/85 z-20 flex shrink-0 items-center gap-2 px-3 py-3 backdrop-blur">
        <Link
          href={CONSUMER_ROUTES.me}
          aria-label="Back to reservations"
          className="border-border bg-card text-foreground hover:bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition"
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={2.25} />
        </Link>
        <p className="font-display flex-1 truncate text-center text-sm font-semibold">
          Reservation
        </p>
        <span className="h-9 w-9 shrink-0" aria-hidden />
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <ReservationBodySkeleton />
      </div>
    </div>
  );
}
