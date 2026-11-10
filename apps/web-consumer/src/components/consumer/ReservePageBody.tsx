"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronRight } from "lucide-react";

import { HideShellNav } from "@/components/consumer/HideShellNav";
import {
  ReservationForm,
  type ReservationFormPlace,
} from "@/components/consumer/place-detail/ReservationForm";
import {
  apiListReservations,
  type EFReservationRow,
} from "@/lib/api/reservations";
import { reservationPath } from "@/lib/consumer-route-contract";
import { toReservationItem } from "@/lib/reservations-adapter";
import { stateMeta } from "@/lib/reservation-state";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { isAwaitingPlace, usePollWhile } from "@/lib/use-poll-while";
import { SHEET_TITLE_CLASS } from "@/lib/ui-classes";
import { cn, guestNoun } from "@/lib/utils";
import { placeDateTime } from "@mesita/place-profile/lib/place-time";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "Fri 13 Nov · 21:00", on the place's clock. */
function whenLine(iso: string): string {
  const t = placeDateTime(iso);
  if (!t) return "";
  const [y, m, d] = t.date.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d));
  return `${WEEKDAYS[day.getUTCDay()]} ${d} ${MONTHS[m - 1]} · ${t.time}`;
}

/** Confirmed wears the green; Booking… and Created grey; the rest plain. */
function StatusPill({ row }: { row: EFReservationRow }) {
  const phase = toReservationItem(row).state;
  const label = phase === "booking" ? "Booking…" : stateMeta(phase).label;
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap",
        phase === "confirmed"
          ? "bg-green-400 text-neutral-950"
          : phase === "booking" || phase === "created"
            ? "bg-muted text-muted-foreground"
            : "border-border text-foreground border",
      )}
    >
      {label}
    </span>
  );
}

function ReservationRow({ row }: { row: EFReservationRow }) {
  const name = [row.guest_first_name, row.guest_last_name]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join(" ");
  const notes = row.notes?.trim();
  const detail = [
    name,
    row.reference_code ? `Ref ${row.reference_code}` : "",
    notes ? `"${notes}"` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <Link
      href={reservationPath(row.id)}
      className="border-border hover:bg-muted/50 flex items-center gap-3 border-t px-3.5 py-3 transition first:border-t-0"
    >
      <div className="min-w-0 flex-1">
        <p className="type-body font-semibold">
          {whenLine(row.reserved_at)} · {row.party_size}{" "}
          {guestNoun(row.party_size)}
        </p>
        {detail && (
          <p className="text-muted-foreground type-body truncate">{detail}</p>
        )}
      </div>
      <StatusPill row={row} />
      <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
    </Link>
  );
}

/**
 * THE RESERVE PAGE (MESITA-3609): back + place name, "Reserve a table", the
 * guest's upcoming tables at this place (only when there are any), then the
 * form the Reserve sheet used to hold.
 */
export function ReservePageBody({
  place,
  fallbackHref,
}: {
  place: ReservationFormPlace;
  fallbackHref: string;
}) {
  const router = useRouter();
  const supabase = useBrowserSupabase();
  const [mine, setMine] = useState<EFReservationRow[]>([]);
  const [checking, setChecking] = useState(true);
  const [reads, setReads] = useState(0);

  const onBack = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.replace(fallbackHref);
  }, [fallbackHref, router]);

  // The guest's live tables HERE. `upcoming` is exactly "active" server-side:
  // consumer-web-list-reservations filters to state pending|confirmed AND
  // reserved_at >= now - 4h. Re-read after every booking (`reads`).
  useEffect(() => {
    let cancelled = false;
    apiListReservations(supabase, { scope: "upcoming", limit: 100 })
      // place.id is place_profiles.id == places.id, the id the list EF
      // stitches onto each row via attachPlaces.
      .then(({ reservations }) =>
        reservations.filter((r) => r.place?.id === place.id),
      )
      // Fail OPEN: a flaky list read must not block someone from booking.
      .catch(() => [] as EFReservationRow[])
      .then((rows) => {
        if (cancelled) return;
        setMine(rows);
        setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [place.id, reads, supabase]);

  // While any table here is still Booking, read again every 10 s; stop once
  // none is (MESITA-3619).
  const reread = useCallback(() => setReads((n) => n + 1), []);
  usePollWhile(
    mine.some((r) => isAwaitingPlace(toReservationItem(r).state)),
    reread,
  );

  return (
    <div className="bg-background relative flex flex-1 flex-col overflow-hidden">
      <HideShellNav />
      <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto px-5 pt-4 pb-10">
        <div className="mb-4 flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="bg-muted text-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={2.25} />
          </button>
          <p className="truncate text-base font-semibold">{place.name}</p>
        </div>
        <h1 className={cn(SHEET_TITLE_CLASS, "text-2xl")}>Reserve a table</h1>

        {mine.length > 0 && (
          <>
            <p className="text-muted-foreground type-label mt-5 mb-2 font-medium tracking-[0.14em] uppercase">
              Your reservations here
            </p>
            <div className="border-border overflow-hidden rounded-2xl border">
              {mine.map((row) => (
                <ReservationRow key={row.id} row={row} />
              ))}
            </div>
          </>
        )}

        <ReservationForm
          place={place}
          existing={mine[0] ?? null}
          checking={checking}
          onBooked={reread}
          onDone={onBack}
        />
      </div>
    </div>
  );
}
