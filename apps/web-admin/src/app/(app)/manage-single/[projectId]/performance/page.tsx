"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
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
import { Spinner } from "../../ui";
import { useUnitPlace } from "../../UnitPlaceContext";

// Per-place Performance — how this place is DOING. Three layers, widest to
// narrowest (Pato 2026-08-03: "include summary … and then the actual
// notifications"):
//   1. Summary     — the headline numbers (KPI tiles): Mesita + Google stars,
//                    IG/FB reach, and activity/money derived from the feed.
//   2. Reviews     — the review cards themselves.
//   3. App activity— the raw per-place event feed.
// Summary and feed read the SAME payload, so the tiles can never disagree
// with the rows beneath them. The feed is the Global Monitor engine scoped to
// this place and narrowed to consumer-activity types — Enricher noise stays
// on Global.
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
    <div className="flex flex-col gap-6 lg:gap-8">
      {/* Headline numbers. Rendered only with the payload — the tiles are
          derived from it, so there is nothing honest to show before it lands. */}
      {initial ? (
        <div className="mx-auto w-full max-w-6xl">
          <PerformanceSummary place={place} data={initial} />
        </div>
      ) : null}

      {/* Reputation — same masonry language as the other tabs. */}
      <div className="mx-auto w-full max-w-6xl">
        <div className="columns-1 gap-4 [&>section]:mb-4 [&>section]:break-inside-avoid lg:columns-2 lg:gap-5 lg:[&>section]:mb-5">
          <ReviewsSection place={place} />
        </div>
      </div>

      {/* Reservations + guest content — read-only, own EF, own error state. */}
      <div className="mx-auto w-full max-w-6xl">
        {activityError ? (
          <div className="border-destructive/40 bg-destructive/5 text-destructive flex items-start gap-3 rounded-2xl border p-4 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">
                Couldn&apos;t load reservations or guest content.
              </p>
              <p className="mt-1 opacity-90">{activityError}</p>
            </div>
          </div>
        ) : activity ? (
          <div className="columns-1 gap-4 [&>section]:mb-4 [&>section]:break-inside-avoid lg:gap-5 lg:[&>section]:mb-5">
            <ReservationsPanel activity={activity} />
            <StoriesCommentsPanel activity={activity} />
          </div>
        ) : (
          <Spinner label="Loading reservations…" />
        )}
      </div>

      {/* App activity — the notification feed, scoped to this place. */}
      <div>
        <p className="text-muted-foreground mx-auto mb-3 w-full max-w-6xl text-[11px] font-semibold tracking-[0.12em] uppercase">
          App activity
        </p>
        {error ? (
          <div className="border-destructive/40 bg-destructive/5 text-destructive mx-auto flex max-w-6xl items-start gap-3 rounded-2xl border p-4 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">
                Couldn&apos;t load this place&apos;s activity.
              </p>
              <p className="mt-1 opacity-90">{error}</p>
            </div>
          </div>
        ) : !initial ? (
          <Spinner label="Loading activity…" />
        ) : (
          <GlobalPerformanceClient
            initial={initial}
            projectId={place.id}
            types={ACTIVITY_TYPE_ORDER}
          />
        )}
      </div>
    </div>
  );
}
