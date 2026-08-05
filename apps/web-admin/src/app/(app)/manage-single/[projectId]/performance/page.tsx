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
import { PerformanceHeadline } from "../../sections/PerformanceHeadline";
import { ReputationStrip } from "../../sections/ReputationStrip";
import { SectionCard, Spinner } from "../../ui";
import { useUnitPlace } from "../../UnitPlaceContext";

// Per-place Performance — the retrospective record (MESITA-855 + MESITA-894):
//
//   1. Is Mesita working here? — money + Saved→Visited→Closed funnel.
//   2. Reputation             — Mesita / Google / IG / FB scores.
//   3. Activity               — consumer event feed (receipts).
//
// Mesita booking ops moved to the Reservations tab (MESITA-894). Channel
// routing stays on Settings. Layout: one max-w-4xl column.
export default function UnitPerformancePage() {
  const { place } = useUnitPlace();
  const [feed, setFeed] = useState<NotificationsPayload | null>(null);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [activity, setActivity] = useState<PlaceActivity | null>(null);
  const [activityError, setActivityError] = useState<string | null>(null);

  // No sync resets in the effect body (react-hooks/set-state-in-effect) —
  // state starts null and a place switch remounts the page via the shell.
  useEffect(() => {
    let alive = true;
    getPlaceActivity(place.id).then((r) => {
      if (!alive) return;
      if (!r.ok) {
        setActivityError(r.error);
        return;
      }
      setActivity(r.data);
    });
    listNotifications("all", {
      projectId: place.id,
      types: ACTIVITY_TYPE_ORDER,
    }).then((r) => {
      if (!alive) return;
      if (!r.ok) {
        setFeedError(r.error);
        return;
      }
      setFeed(r.data);
    });
    return () => {
      alive = false;
    };
  }, [place.id]);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 pb-10">
      {activityError ? (
        <ErrorNote title="Couldn't load this place's numbers." detail={activityError} />
      ) : activity ? (
        <>
          <PerformanceHeadline stats={activity.stats} />
          <ReputationStrip place={place} />
        </>
      ) : (
        <Spinner label="Loading…" />
      )}

      <SectionCard
        title="Activity"
        subtitle="Every consumer event on this place, newest first. Auto-refreshes while the tab is open."
      >
        {feedError ? (
          <div className="mt-4">
            <ErrorNote title="Couldn't load the activity feed." detail={feedError} />
          </div>
        ) : !feed ? (
          <Spinner label="Loading activity…" />
        ) : (
          <GlobalPerformanceClient
            initial={feed}
            projectId={place.id}
            types={ACTIVITY_TYPE_ORDER}
            bleed={false}
          />
        )}
      </SectionCard>
    </div>
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
