"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { ReservationCard } from "@/components/consumer/ReservationCard";
import { LoadingFill } from "@/components/shared/Spinner";
import {
  apiListReservations,
  type ReservationScope,
} from "@/lib/api/reservations";
import type { ReservationItem } from "@/lib/mock/reservations-mock";
import { toReservationItem } from "@/lib/reservations-adapter";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { ERROR_BOX_CLASS } from "@/lib/ui-classes";
import { errMsg } from "@/lib/utils";

// Live reservations list for the Reservations tab (and the standalone
// /reservations deep link). Reads consumer-web-list-reservations for the
// given scope and renders the parked ReservationCard rows. Upcoming and
// History are distinct component instances, so switching tabs remounts this
// with a fresh fetch rather than reusing the sibling's rows.
export function ReservationsList({
  scope,
  empty,
}: {
  scope: ReservationScope;
  empty: ReactNode;
}) {
  const supabase = useBrowserSupabase();
  const [items, setItems] = useState<ReservationItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { reservations } = await apiListReservations(supabase, { scope });
        if (!cancelled) setItems(reservations.map(toReservationItem));
      } catch (e) {
        if (!cancelled) setError(errMsg(e, "Couldn't load your reservations."));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, scope]);

  if (error) {
    return (
      <div className="px-4 pt-4">
        <p className={ERROR_BOX_CLASS}>{error}</p>
      </div>
    );
  }
  if (items === null) return <LoadingFill label="Loading reservations" />;
  if (items.length === 0) return <>{empty}</>;

  return (
    <div className="scrollbar-hide h-full overflow-y-auto px-4 py-4">
      <div className="flex flex-col gap-3">
        {items.map((r) => (
          <ReservationCard key={r.id} r={r} />
        ))}
      </div>
    </div>
  );
}
