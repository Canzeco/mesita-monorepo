"use client";

// Reserve › Party: "Add to your calendar" (MESITA-4315, Pato: "if calendar
// not connected, maybe somewhere add Google Calendar or Outlook or Apple
// CALENDAR QUICK CONNECT BUTTON"). Shown only while none of the three
// calendars has ever read its feed link; each button opens that calendar's
// own subscribe page, the same door as Me › Integrations › Calendar. Loading
// or an error hides it: it never stands between the guest and Reserve.

import { useEffect, useState } from "react";
import { CalendarMark } from "@/components/shared/calendar-marks";
import { ReservationSection } from "@/components/consumer/reservation-pickers";
import {
  anyCalendarConnected,
  apiGetCalendarFeeds,
  CALENDAR_FEEDS_KEY,
  type CalendarFeeds,
  type CalendarKind,
  subscribeUrl,
} from "@/lib/api/calendar";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { useCachedQuery } from "@/lib/use-cached-query";

const CALENDARS: Array<{ kind: CalendarKind; label: string; app: string }> = [
  { kind: "google", label: "Google", app: "Google Calendar" },
  { kind: "apple", label: "Apple", app: "Apple Calendar" },
  { kind: "outlook", label: "Outlook", app: "Outlook" },
];

export function CalendarQuickConnect() {
  const getSupabase = useLazyBrowserSupabase();
  const feeds = useCachedQuery<CalendarFeeds>(
    CALENDAR_FEEDS_KEY,
    () => apiGetCalendarFeeds(getSupabase()),
    {
      ttl: 60_000,
    },
  );
  const [added, setAdded] = useState<CalendarKind | null>(null);
  const { reload } = feeds;

  // Back from the calendar's tab: ask again, so the box leaves once a
  // calendar has read its link.
  useEffect(() => {
    const again = () => {
      if (document.visibilityState === "visible") reload();
    };
    document.addEventListener("visibilitychange", again);
    window.addEventListener("focus", again);
    return () => {
      document.removeEventListener("visibilitychange", again);
      window.removeEventListener("focus", again);
    };
  }, [reload]);

  const data = feeds.data;
  if (!data || anyCalendarConnected(data)) return null;
  const app = CALENDARS.find((c) => c.kind === added)?.app;

  return (
    <ReservationSection title="Add to your calendar">
      <p className="text-muted-foreground type-body -mt-1 mb-3 leading-snug">
        {app
          ? `Finish in ${app}. Your tables show up there once it's connected.`
          : "Your tables show up in it, and update when they change."}
      </p>
      <div className="grid grid-cols-3 gap-2">
        {CALENDARS.map(({ kind, label }) => (
          <a
            key={kind}
            href={subscribeUrl(kind, data[kind].url)}
            target="_blank"
            rel="noreferrer"
            onClick={() => setAdded(kind)}
            data-calendar-quick-connect={kind}
            className="border-foreground/20 hover:bg-muted flex flex-col items-center gap-2 rounded-xl border px-2 py-3 text-sm font-semibold transition active:scale-[0.98]"
          >
            <CalendarMark kind={kind} size={32} />
            {label}
          </a>
        ))}
      </div>
    </ReservationSection>
  );
}
