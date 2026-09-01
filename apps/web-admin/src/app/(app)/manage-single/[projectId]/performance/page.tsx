"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ChartLine } from "lucide-react";
import { getPlaceActivity, type PlaceActivity } from "../../actions";
import { isSectionSoon } from "../../nav";
import { EventSuperBoxes } from "../../sections/EventSuperBoxes";
import { PerformanceHeadline } from "../../sections/PerformanceHeadline";
import { ReputationStrip } from "../../sections/ReputationStrip";
import { ReservationsList } from "../../sections/ReservationsList";
import { Spinner } from "@/components/admin-ui/manage";
import { usePlaceContext } from "../../PlaceContext";

// Per-place Activity — renamed from Performance (Pato live 2026-09-01); the
// route stays /performance, because a rename never reaches the URL
// (MESITA-900 — Reservations back inside this tab):
//
//   1. Is Mesita working here? — money + Saved→Visited→Closed funnel.
//   2. Reputation             — Mesita / Google / IG / FB / reservations boxes (Stories rail).
//   3. Event receipts         — typed Super Boxes (analytics lead + horizontal events).
//   4. Reservations           — Mesita bookings list + AI dial lines.
//
// Channel routing stays on Controls. Layout: one max-w-4xl column.
//
// PARKED (Pato live 2026-08-09): the whole tab is behind the Soon gate in
// `nav.ts`. The chrome renders it disabled and this route serves the
// placeholder below — the feed underneath is untouched, so flipping
// `soon: false` in nav.ts brings it all back.
export default function PlaceActivityPage() {
  if (isSectionSoon("performance")) return <ActivitySoon />;
  return <ActivityFeed />;
}

function ActivitySoon() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 pb-10">
      <div className="border-border bg-card flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-16 text-center">
        <span className="bg-muted/60 text-muted-foreground flex h-11 w-11 items-center justify-center rounded-full">
          <ChartLine className="h-5 w-5" />
        </span>
        <p className="font-display text-foreground text-lg font-semibold tracking-tight">
          Activity is coming soon
        </p>
        <p className="text-muted-foreground max-w-md text-sm leading-relaxed">
          Per-place numbers — influenced spend, the Saved → Visited → Closed
          funnel, reputation and reservations — are parked while the feed is
          rebuilt. Nothing here is lost; the tab comes back with real numbers.
        </p>
        <span className="bg-muted text-muted-foreground mt-1 rounded-full px-2 py-0.5 type-meta font-bold tracking-wider uppercase">
          Soon
        </span>
      </div>
    </div>
  );
}

/** The live feed — parked behind the Soon gate above, not deleted. */
function ActivityFeed() {
  const { place } = usePlaceContext();
  const [activity, setActivity] = useState<PlaceActivity | null>(null);
  const [activityError, setActivityError] = useState<string | null>(null);

  // No sync resets in the effect body (react-hooks/set-state-in-effect) —
  // state starts null and a place switch remounts the page via the shell.
  useEffect(() => {
    let alive = true;
    getPlaceActivity(place.id, { limit: 50 }).then((r) => {
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
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 pb-10">
      {activityError ? (
        <ErrorNote title="Couldn't load this place's numbers." detail={activityError} />
      ) : activity ? (
        <>
          <PerformanceHeadline stats={activity.stats} />
          <ReputationStrip place={place} stats={activity.stats} />
          <EventSuperBoxes place={place} stats={activity.stats} />
          <ReservationsList activity={activity} />
        </>
      ) : (
        <Spinner label="Loading…" />
      )}
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
