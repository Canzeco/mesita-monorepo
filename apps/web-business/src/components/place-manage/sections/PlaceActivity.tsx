"use client";

// One place's numbers and receipts. Reads `business-web-get-performance`
// (membership-scoped). Report triage is Mesita's call, never the place's — a
// place that could dismiss guest reports about itself would neutralize the
// strike ladder (MESITA-1740).
//
// IT TAKES ITS PLACE AS A PROP, and that is the whole change of MESITA-1841.
// It was `ActivityTab` under `places/[id]/activity`, reading `usePlaceContext`
// — which only exists inside the place layout. Activity is the ORGANIZATION's
// page now (Pato's drawing of 2026-09-14 puts it flush-left with Payments and
// Credits), and that page renders it for whichever of the organization's
// places is selected, outside any PlaceContext. The read was always by id; the
// context was only ever supplying the id and the record.

import { useCallback, useEffect, useState, useTransition } from "react";
import { getPlaceActivity, type PlaceActivity as PlaceActivityData } from "@/components/place-manage/actions";
import { EventSuperBoxes } from "./EventSuperBoxes";
import { PerformanceHeadline } from "./PerformanceHeadline";
import { ReputationStrip } from "./ReputationStrip";
import { ReservationsList } from "./ReservationsList";
import type { AdminPlace } from "@/components/place-manage/actions";
import { Spinner } from "@/components/admin-ui/manage";
import { ErrorNote } from "@/components/ErrorNote";

export function PlaceActivity({ place }: { place: AdminPlace }) {
  const [activity, setActivity] = useState<PlaceActivityData | null>(null);
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
