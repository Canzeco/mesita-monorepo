"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  listNotifications,
  type NotificationsPayload,
} from "../../../global-performance/actions";
import { GlobalPerformanceClient } from "../../../global-performance/GlobalPerformanceClient";
import { ACTIVITY_TYPE_ORDER } from "../../../global-performance/notification-config";
import { Spinner } from "../../ui";
import { useUnitPlace } from "../../UnitPlaceContext";

// Per-place Performance — what the APP did with this place (MESITA-834):
// consumer saves, ticket creates / visits / payments, reviews, reservation
// requests. Same feed engine as the Global Monitor, scoped to this place and
// narrowed to the consumer-activity types (Enricher noise stays on Global).
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

  if (error) {
    return (
      <div className="border-destructive/40 bg-destructive/5 text-destructive mx-auto mt-6 flex max-w-6xl items-start gap-3 rounded-2xl border p-4 text-sm">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-medium">Couldn&apos;t load this place&apos;s activity.</p>
          <p className="mt-1 opacity-90">{error}</p>
        </div>
      </div>
    );
  }

  if (!initial) return <Spinner label="Loading activity…" />;

  return (
    <GlobalPerformanceClient
      initial={initial}
      projectId={place.id}
      types={ACTIVITY_TYPE_ORDER}
    />
  );
}
