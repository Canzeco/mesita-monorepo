"use client";

import { ScreenHeader } from "@/components/consumer/nav/Screen";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

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
      className="border-border hover:bg-muted/50 flex items-center gap-3 border-t px-3.5 py-3 transition first:border-t-0"
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
    <div className="bg-card relative flex flex-1 flex-col overflow-hidden">
      {/* The one page header (MESITA-4097): square Back, the title. */}
      {/* The place IS the header (MESITA-4183), the way Pay's header names
          it (MESITA-4122): one row instead of "Reserve a table" over the
          name; the step bar under it says what this screen does. */}
      <ScreenHeader title={place.name} onBack={onBack} />
      <div className="flex min-h-0 flex-1 flex-col px-5">

        <ReservationForm
          place={place}
          existing={mine[0] ?? null}
          checking={checking}
          onBooked={reread}
          onDone={onBack}
          intro={
            mine.length > 0 ? (
              <section className="mb-5">
                <h2 className="mb-2 font-sans text-base font-semibold tracking-normal">Your reservations here</h2>
                <div className="border-foreground/20 overflow-hidden rounded-xl border">
                  {mine.map((row) => (
                    <ReservationRow key={row.id} row={row} tz={place.timezone || null} />
                  ))}
                </div>
              </section>
            ) : null
          }
        />
      </div>
    </div>
  );
}
