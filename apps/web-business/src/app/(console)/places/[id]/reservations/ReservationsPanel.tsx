"use client";

// The Reservations switch (MESITA-2786/2787; its own page since MESITA-3600).
// It saves the moment it flips, as the operator's answer, so a later Enrich
// cannot reopen or close bookings (reservationsPatch). No "Mesita" prefix
// (MESITA-3588: the booking is between the guest and the place). Same row
// anatomy as Payments: mark · title and line · On/Off · switch. Under it the
// Reservations phone (MESITA-3601, Pato: "You can add another phone number for
// Reservations, not necessarily the one in Google"): the number the
// Reservationist dials, reservation_target, else Google's phone; Use Google's
// number clears it. The server stores it as E.164 and repeats the rule.

import { useState } from "react";
import { CalendarCheckIcon, PhoneIcon } from "@phosphor-icons/react/dist/ssr";
import { usePlaceContext } from "@/components/place-manage/PlaceContext";
import { updatePlace } from "@/components/place-manage/actions";
import { reservationsPatch } from "@/components/place-manage/sections/action-patches";
import { Card } from "@/components/shell/Page";
import { Switch } from "@/components/ui/config";
import { INPUT_BASE } from "@/components/ui/manage";
import { ERROR_BOX_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

const QUIET =
  "border-border hover:bg-muted h-9 shrink-0 rounded-full border px-4 text-sm font-semibold transition-colors disabled:opacity-40";

const MARK_ROW = "grid min-h-16 grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-4 px-5 py-3 text-sm sm:px-6";

export function ReservationsPanel() {
  const { place, setPlace } = usePlaceContext();
  const [pending, setPending] = useState<"switch" | "phone" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const on = place.reservations_enabled === true;
  const own = (place.reservation_target ?? "").trim();
  const google = (place.phone ?? "").trim();
  const number = own || google;

  async function save(which: "switch" | "phone", patch: Parameters<typeof updatePlace>[0]) {
    setPending(which);
    setError(null);
    const r = await updatePlace(patch);
    setPending(null);
    if (!r.ok) return setError(r.error);
    setPlace(r.data.place);
    if (which === "phone") setDraft("");
  }

  return (
    <>
      <Card className="flex flex-col p-0 sm:p-0">
        <ul className="divide-border divide-y">
          <li className={MARK_ROW} data-place-state="reservations">
            <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", on ? "bg-orange-100 text-orange-700" : "bg-muted text-muted-foreground")}>
              <CalendarCheckIcon size={22} weight={on ? "fill" : "regular"} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="font-medium">Reservations</p>
              <p className="text-muted-foreground">Guests ask for a table on Mesita; Mesita calls your phone to book it.</p>
            </div>
            <p className={cn("font-semibold whitespace-nowrap", !on && "text-muted-foreground")}>{on ? "On" : "Off"}</p>
            <Switch on={on} pending={pending !== null} onClick={() => void save("switch", reservationsPatch(place))} label={`Reservations: ${on ? "on" : "off"}`} />
          </li>
          <li className="flex min-h-16 flex-wrap items-center gap-4 px-5 py-3 text-sm sm:px-6" data-place-state="reservation_target">
            <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", number ? "bg-orange-100 text-orange-700" : "bg-muted text-muted-foreground")}>
              <PhoneIcon size={22} weight={number ? "fill" : "regular"} aria-hidden />
            </span>
            {/* The minimum is what lets the box wrap under the text on a phone. */}
            <div className="min-w-48 flex-1">
              <p className="font-medium">Reservations phone</p>
              <p className="text-muted-foreground">
                The number Mesita calls to book. {own ? "Your own number." : google ? "Google's number." : "Google lists no number: add one."}
              </p>
            </div>
            <p className={cn("font-semibold whitespace-nowrap tabular-nums", !number && "text-muted-foreground")}>{number || "None"}</p>
            <div className="flex shrink-0 flex-wrap items-center gap-3">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && draft.trim() && pending === null) void save("phone", { id: place.id, reservation_target: draft });
                }}
                inputMode="tel"
                autoComplete="off"
                placeholder="+52 81 8378 2164"
                aria-label="Reservations phone"
                className={cn(INPUT_BASE, "h-10 w-44 px-3 tabular-nums")}
              />
              <button type="button" className={QUIET} disabled={!draft.trim() || pending !== null} onClick={() => void save("phone", { id: place.id, reservation_target: draft })}>
                {pending === "phone" ? "Saving…" : "Save"}
              </button>
              {own ? (
                <button type="button" className={QUIET} disabled={pending !== null} onClick={() => void save("phone", { id: place.id, reservation_target: null })}>
                  Use Google&apos;s number
                </button>
              ) : null}
            </div>
          </li>
        </ul>
      </Card>
      {error ? <p className={ERROR_BOX_CLASS}>{error}</p> : null}
    </>
  );
}
