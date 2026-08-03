"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  listNotifications,
  type NotificationsPayload,
} from "../../../global-performance/actions";
import { GlobalPerformanceClient } from "../../../global-performance/GlobalPerformanceClient";
import { ACTIVITY_TYPE_ORDER } from "../../../global-performance/notification-config";
import { ReviewsSection } from "../../sections/ReviewsSection";
import { Spinner } from "../../ui";
import { useUnitPlace } from "../../UnitPlaceContext";

// Per-place Performance — how this place is DOING (MESITA-834 + Pato's
// 2026-08-03 fold): reputation first (the Reviews cards — Mesita aggregates,
// Google, Instagram/Facebook signals), then what the app did with the place
// (saves, ticket creates / visits / payments, reviews, reservation requests).
// The feed is the Global Monitor engine scoped to this place and narrowed to
// the consumer-activity types — Enricher noise stays on Global.
export default function UnitPerformancePage() {
  const { place } = useUnitPlace();
  const [initial, setInitial] = useState<NotificationsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    return () => {
      alive = false;
    };
  }, [place.id]);

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      {/* Reputation — same masonry language as the other tabs. */}
      <div className="mx-auto w-full max-w-6xl">
        <div className="columns-1 gap-4 [&>section]:mb-4 [&>section]:break-inside-avoid lg:columns-2 lg:gap-5 lg:[&>section]:mb-5">
          <ReviewsSection place={place} />
        </div>
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
