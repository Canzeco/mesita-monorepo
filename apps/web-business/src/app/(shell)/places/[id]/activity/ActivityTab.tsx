"use client";

// Activity — admin's Activity feed, shipped LIVE here rather than parked.
// In the operator console this tab sits behind a Soon gate because the feed
// reads as empty scaffolding across 20k places; on a venue's own screen it
// is the tab they open most, so it ships with real numbers and an honest
// zero state.
//
// Report triage stays operator-only (allowTriage): a place that could
// dismiss guest reports about itself would neutralise the strike ladder.

import { useEffect, useState } from "react";
import { getPlaceActivity, type PlaceActivity } from "@/components/place-manage/actions";
import { EventSuperBoxes } from "@/components/place-manage/sections/EventSuperBoxes";
import { PerformanceHeadline } from "@/components/place-manage/sections/PerformanceHeadline";
import { ReputationStrip } from "@/components/place-manage/sections/ReputationStrip";
import { ReservationsList } from "@/components/place-manage/sections/ReservationsList";
import { usePlaceContext } from "@/components/place-manage/PlaceContext";
import { Spinner } from "@/components/admin-ui/manage";
import { ErrorNote } from "@/components/ErrorNote";

export function ActivityTab({ allowTriage }: { allowTriage: boolean }) {
  const { place } = usePlaceContext();
  const [activity, setActivity] = useState<PlaceActivity | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getPlaceActivity(place.id, { limit: 50 }).then((r) => {
      if (!alive) return;
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setActivity(r.data);
    });
    return () => {
      alive = false;
    };
  }, [place.id]);

  if (error) {
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
        allowTriage={allowTriage}
      />
      <ReservationsList activity={activity} />
    </div>
  );
}
