"use client";

// Activity — the place's own numbers and receipts. Reads
// `business-web-get-performance` (membership-scoped). Report triage is
// Mesita's call, never the place's — a place that could dismiss guest
// reports about itself would neutralize the strike ladder (MESITA-1740).

import { useCallback, useEffect, useState, useTransition } from "react";
import { getPlaceActivity, type PlaceActivity } from "@/components/place-manage/actions";
import { EventSuperBoxes } from "@/components/place-manage/sections/EventSuperBoxes";
import { PerformanceHeadline } from "@/components/place-manage/sections/PerformanceHeadline";
import { ReputationStrip } from "@/components/place-manage/sections/ReputationStrip";
import { ReservationsList } from "@/components/place-manage/sections/ReservationsList";
import { usePlaceContext } from "@/components/place-manage/PlaceContext";
import { Spinner } from "@/components/admin-ui/manage";
import { ErrorNote } from "@/components/ErrorNote";

export function ActivityTab() {
  const { place } = usePlaceContext();
  const [activity, setActivity] = useState<PlaceActivity | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startRefresh] = useTransition();

  const load = useCallback(() => {
    startRefresh(() => {
      void getPlaceActivity(place.id, { limit: 50 }).then((r) => {
        if (!r.ok) {
          setError(r.error);
          return;
        }
        setError(null);
        setActivity(r.data);
      });
    });
  }, [place.id]);

  useEffect(() => {
    load();
  }, [load]);

  if (error && !activity) {
    return (
      <ErrorNote message="Couldn't load this place's numbers. Reload to try again." />
    );
  }
  if (!activity) return <Spinner label="Loading…" />;

  return (
    <div className="flex flex-col gap-4">
      <PerformanceHeadline stats={activity.stats} />
      <ReputationStrip place={place} stats={activity.stats} />
      <EventSuperBoxes
        place={place}
        stats={activity.stats}
        feed={activity.feed}
        generatedAt={activity.generatedAt}
        pending={pending}
        onRefresh={load}
      />
      <ReservationsList activity={activity} />
    </div>
  );
}
