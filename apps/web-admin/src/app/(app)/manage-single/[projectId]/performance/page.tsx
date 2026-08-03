"use client";

import { useEffect, useState } from "react";
import { Activity, AlertTriangle } from "lucide-react";
import {
  listNotifications,
  type NotificationsPayload,
} from "../../../global-performance/actions";
import { getPlaceActivity, type PlaceActivity } from "../../actions";
import { GlobalPerformanceClient } from "../../../global-performance/GlobalPerformanceClient";
import { ACTIVITY_TYPE_ORDER } from "../../../global-performance/notification-config";
import { PerformanceSummary } from "../../sections/PerformanceSummary";
import { ReservationsPanel } from "../../sections/ReservationsPanel";
import { ReviewsSection } from "../../sections/ReviewsSection";
import { StoriesCommentsPanel } from "../../sections/StoriesCommentsPanel";
import { SectionCard, Spinner } from "../../ui";
import { useUnitPlace } from "../../UnitPlaceContext";

// Per-place Performance — how this place is DOING, narrowing as you scroll:
// headline numbers → reputation → bookings & guest content → the raw event
// feed. Summary and feed read the SAME payload, so the tiles can never
// disagree with the rows beneath them; the feed is the Global Monitor engine
// scoped to this place (Enricher noise stays on Global).
//
// LAYOUT CONTRACT — one column, one rhythm. The page owns a single
// `max-w-6xl` wrapper and every block sits inside it; each content group is a
// labelled band whose cards flow in the SAME lg:columns-2 masonry. Before
// this it was four separately-wrapped blocks with mismatched column counts,
// and the feed — built to bleed OUT of PageContainer's padding — rendered
// wider than its siblings, which is why it now gets `bleed={false}`.
export default function UnitPerformancePage() {
  const { place } = useUnitPlace();
  const [initial, setInitial] = useState<NotificationsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Reservations + stories/comments ride their own read-only EF. A failure
  // here must not take the rest of the page down, so it keeps its own state.
  const [activity, setActivity] = useState<PlaceActivity | null>(null);
  const [activityError, setActivityError] = useState<string | null>(null);

  // No sync resets in the effect body (react-hooks/set-state-in-effect) —
  // state starts null and a place switch remounts the page via the shell.
  useEffect(() => {
    let alive = true;
    listNotifications("all", {
      projectId: place.id,
      types: ACTIVITY_TYPE_ORDER,
    }).then((r) => {
      if (!alive) return;
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setInitial(r.data);
    });
    getPlaceActivity(place.id).then((r) => {
      if (!alive) return;
      if (!r.ok) {
        setActivityError(r.error);
        return;
      }
      setActivity(r.data);
    });
    return () => {
      alive = false;
    };
  }, [place.id]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-7 pb-10 lg:gap-9">
      {/* Headline numbers — the tiles ARE the cards here, so no wrapping
          card (a card full of bordered boxes just reads as clutter). */}
      {initial ? <PerformanceSummary place={place} data={initial} /> : null}

      <Band title="Reputation">
        <ReviewsSection place={place} />
      </Band>

      <Band title="Bookings & guest content">
        {activityError ? (
          <ErrorNote
            title="Couldn't load reservations or guest content."
            detail={activityError}
          />
        ) : activity ? (
          <>
            <ReservationsPanel activity={activity} />
            <StoriesCommentsPanel activity={activity} />
          </>
        ) : (
          <Spinner label="Loading reservations…" />
        )}
      </Band>

      {/* The raw feed, carded like everything else instead of floating under
          a bare label. */}
      <SectionCard
        icon={<Activity className="h-4 w-4" />}
        tint="indigo"
        title="Activity feed"
        subtitle="Every consumer event on this place, newest first. Auto-refreshes while the tab is open."
      >
        {error ? (
          <div className="mt-4">
            <ErrorNote title="Couldn't load this place's activity." detail={error} />
          </div>
        ) : !initial ? (
          <Spinner label="Loading activity…" />
        ) : (
          <GlobalPerformanceClient
            initial={initial}
            projectId={place.id}
            types={ACTIVITY_TYPE_ORDER}
            bleed={false}
          />
        )}
      </SectionCard>
    </div>
  );
}

/** A labelled group whose cards flow in the page's one masonry. */
function Band({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-muted-foreground mb-3 text-[11px] font-semibold tracking-[0.12em] uppercase">
        {title}
      </h2>
      <div className="columns-1 gap-4 [&>section]:mb-4 [&>section]:break-inside-avoid lg:columns-2 lg:gap-5 lg:[&>section]:mb-5">
        {children}
      </div>
    </section>
  );
}

function ErrorNote({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="border-destructive/40 bg-destructive/5 text-destructive flex items-start gap-3 rounded-2xl border p-4 text-sm">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p className="font-medium">{title}</p>
        <p className="mt-1 opacity-90">{detail}</p>
      </div>
    </div>
  );
}
