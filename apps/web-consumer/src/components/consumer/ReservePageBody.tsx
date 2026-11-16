"use client";

import { HEADER_BUTTON_CLASS } from "@/components/consumer/nav/Screen";
import { Panel } from "@/components/shared/Panel";
import { PlacePhotoMark } from "@/components/consumer/wallet/PlaceCredit";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { useRouter } from "next/navigation";
import {
  ReservationForm,
  type ReservationFormPlace,
} from "@/components/consumer/place-detail/ReservationForm";
import {
  apiListReservations,
  type EFReservationRow,
} from "@/lib/api/reservations";
import { reservationPath } from "@/lib/consumer-route-contract";
import { goBack } from "@/lib/navigate";
import { toReservationItem } from "@/lib/reservations-adapter";
import { statusLabel, whenLine } from "@/lib/reservation-when";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { isAwaitingPlace, usePollWhile } from "@/lib/use-poll-while";
import { cn, guestNoun } from "@/lib/utils";

/** Confirmed wears the green; Booking… and Created grey; the rest plain. */
function StatusPill({ row }: { row: EFReservationRow }) {
  const phase = toReservationItem(row).state;
  const label = statusLabel(row);
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

function ReservationRow({ row, tz }: { row: EFReservationRow; tz: string | null }) {
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
      className="border-border hover:bg-muted/50 flex items-center gap-3 border-t px-4 py-3 transition"
    >
      <div className="min-w-0 flex-1">
        <p className="type-body font-semibold">
          {whenLine(row.reserved_at, tz)} · {row.party_size}{" "}
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
export function ReservePageBody({ place }: { place: ReservationFormPlace }) {
  const supabase = useBrowserSupabase();
  const [mine, setMine] = useState<EFReservationRow[]>([]);
  const [checking, setChecking] = useState(true);
  const [reads, setReads] = useState(0);

  // Back and Done slide the page away to the place under it (the screen
  // slide, MESITA-3644; it slid in over a blank card before).
  const router = useRouter();
  const onBack = () => goBack(router);

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
      {/* The one page header (MESITA-4097): square Back, the title. */}
      {/* THE HEADER (MESITA-4183, Pato: "the name of the place on top,
          Reserve at …, with logo. Enhance that"): Back, the place's round
          photo, "Reserve at" over the whole name, left-aligned like the
          place screen's own header so a long name is never cut. */}
      <header className="border-border bg-card sticky top-0 z-20 flex shrink-0 items-center gap-3 border-b px-3 py-2.5">
        <button type="button" onClick={onBack} aria-label="Back" className={HEADER_BUTTON_CLASS}>
          <ChevronLeft className="h-5 w-5" strokeWidth={2.25} aria-hidden />
        </button>
        <span className="[&>span]:h-11 [&>span]:w-11 [&>span]:text-base">
          <PlacePhotoMark photo={place.photo ?? null} name={place.name} />
        </span>
        <h1 className="min-w-0 flex-1">
          <span className="text-muted-foreground type-body block font-medium">Reserve at</span>
          <span className="font-display line-clamp-2 block text-lg leading-tight font-semibold tracking-tight">
            {place.name}
          </span>
        </h1>
      </header>
      <div className="flex min-h-0 flex-1 flex-col">

        <ReservationForm
          place={place}
          existing={mine[0] ?? null}
          checking={checking}
          onBooked={reread}
          onDone={onBack}
          intro={
            mine.length > 0 ? (
              <Panel title="Your reservations here">
                <div className="mt-3">
                  {mine.map((row) => (
                    <ReservationRow key={row.id} row={row} tz={place.timezone || null} />
                  ))}
                </div>
              </Panel>
            ) : null
          }
        />
      </div>
    </div>
  );
}
