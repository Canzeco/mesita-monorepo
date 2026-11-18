"use client";

// A confirmed reservation's "Add to your calendar" (MESITA-4355, Pato on
// the subscribe-link Calendar page: "is this the optimal UX/UI to connect
// reservations to calendar???"). One tap adds this one table, no setup:
// Google and Outlook open their own prefilled new-event page in a new tab;
// Apple takes an .ics event. The phone's own calendar comes first.
// Me › Integrations › Calendar stays the automatic, every-table option.

import { useSyncExternalStore } from "react";
import { CalendarMark } from "@/components/shared/calendar-marks";
import { PANEL_CLASS, PanelHeading } from "@/components/shared/Panel";
import {
  calendarOrder,
  googleEventUrl,
  icsDataUrl,
  outlookEventUrl,
  type CalendarTable,
} from "@/lib/add-to-calendar";
import type { CalendarKind } from "@/lib/api/calendar";
import { cn } from "@/lib/utils";

const LABEL: Record<CalendarKind, string> = {
  google: "Google",
  apple: "Apple",
  outlook: "Outlook",
};

const noSubscribe = () => () => {};
const userAgent = () => navigator.userAgent;
const serverAgent = () => "";

const BUTTON_CLASS =
  "border-foreground/20 hover:bg-muted flex flex-col items-center gap-2 rounded-xl border px-2 py-3 text-sm font-semibold transition active:scale-[0.98]";

export function AddToCalendar({ table }: { table: CalendarTable }) {
  const ua = useSyncExternalStore(noSubscribe, userAgent, serverAgent);
  // iPhone and iPad open a data: .ics straight into Calendar's add sheet;
  // a desktop browser refuses to navigate to data:, so it downloads it.
  const iosSheet = /iPhone|iPad|iPod/.test(ua);

  return (
    <section className={cn(PANEL_CLASS, "p-4")}>
      <PanelHeading>Add to your calendar</PanelHeading>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {calendarOrder(ua).map((kind) =>
          kind === "apple" ? (
            <a
              key={kind}
              href={icsDataUrl(table)}
              download={iosSheet ? undefined : "mesita-table.ics"}
              data-add-to-calendar={kind}
              className={BUTTON_CLASS}
            >
              <CalendarMark kind={kind} size={32} />
              {LABEL[kind]}
            </a>
          ) : (
            <a
              key={kind}
              href={kind === "google" ? googleEventUrl(table) : outlookEventUrl(table)}
              target="_blank"
              rel="noreferrer"
              data-add-to-calendar={kind}
              className={BUTTON_CLASS}
            >
              <CalendarMark kind={kind} size={32} />
              {LABEL[kind]}
            </a>
          ),
        )}
      </div>
    </section>
  );
}
