"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PushLink } from "@/components/consumer/nav/PushLink";
import { Screen } from "@/components/consumer/nav/Screen";
import { PANEL_CLASS } from "@/components/shared/Panel";
import { CalendarClock, Loader2, MapPin, XCircle } from "lucide-react";

import { LocalDialog } from "@/components/consumer/overlay/LocalOverlay";
import {
  buildDateOptions,
  firstOpenDate,
  ReservationDatePicker,
  ReservationPartyPicker,
  ReservationTimePicker,
} from "@/components/consumer/reservation-pickers";
import {
  apiCancelReservation,
  apiListReservations,
  apiUpdateReservation,
} from "@/lib/api/reservations";
import { toReservationItem } from "@/lib/reservations-adapter";
import type { ReservationItem } from "@/lib/reservation-types";
import { placeHref } from "@/lib/place-route";
import { resolveSlot, weeklyHoursFrom } from "@/lib/reservation-slots";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { toast } from "@/lib/toast";
import {
  ERROR_BOX_CLASS,
  SHEET_TITLE_CLASS,
} from "@/lib/ui-classes";
import { cn, errMsg, guestNoun } from "@/lib/utils";
import {
  placeDateTime,
  placeInstantIso,
} from "@mesita/place-profile/lib/place-time";

// Action cluster for reservation detail. The two that MOVE the reservation —
// reschedule and cancel — are live: each hits its consumer-web-* EF, and a
// reschedule sends it back to `booking` because Mesita has to ask the
// place again. `onChanged` lets the detail view refetch so the phase, banner
// and available actions update in place.

const DEFAULT_TIME = "20:00";

// The place's wall clock in its own zone (MESITA-3626) — the pickers speak
// local date + HH:mm, and @mesita/place-profile/lib/place-time owns the
// offsets for the whole app.
function localDate(iso: string | undefined, tz: string | null): string {
  return (iso ? placeDateTime(iso, tz)?.date : "") ?? "";
}

function localTime(iso: string | undefined, tz: string | null): string {
  return (iso ? placeDateTime(iso, tz)?.time : DEFAULT_TIME) ?? DEFAULT_TIME;
}

export function ReservationActions({
  r,
  onChanged,
}: {
  r: ReservationItem;
  onChanged?: () => void;
}) {
  const supabase = useBrowserSupabase();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canReschedule = r.canReschedule ?? false;
  const canCancel = r.canCancel ?? false;

  async function submitCancel() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await apiCancelReservation(supabase, { reservationId: r.id });
      setConfirmOpen(false);
      toast.success("Reservation cancelled.");
      onChanged?.();
    } catch (e) {
      setError(errMsg(e, "Couldn't cancel the reservation."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className={cn(PANEL_CLASS, "divide-border flex flex-col divide-y")}
      data-reservation-actions
    >
      <PushLink
        href={placeHref(r.projectId)}
        className="hover:bg-muted flex items-center justify-between gap-3 px-4 py-3 transition"
      >
        <span className="flex items-center gap-3">
          <span className="bg-muted text-foreground flex h-9 w-9 items-center justify-center rounded-full">
            <MapPin className="h-4 w-4" />
          </span>
          <span className="text-sm font-semibold">View place</span>
        </span>
        <span className="text-muted-foreground text-xs">
          Details, map, menu
        </span>
      </PushLink>

      {canReschedule && (
        <PushLink
          href={`/reservation/${r.id}/reschedule`}
          className="hover:bg-muted flex items-center justify-between gap-3 px-4 py-3 text-left transition"
        >
          <span className="flex items-center gap-3">
            <span className="bg-muted text-foreground flex h-9 w-9 items-center justify-center rounded-full">
              <CalendarClock className="h-4 w-4" />
            </span>
            <span className="text-sm font-semibold">Reschedule</span>
          </span>
          <span className="text-muted-foreground text-xs">
            We call the place again
          </span>
        </PushLink>
      )}

      {canCancel && (
        <button
          type="button"
          onClick={() => {
            setError(null);
            setConfirmOpen(true);
          }}
          className="hover:bg-muted flex items-center justify-between gap-3 px-4 py-3 text-left transition"
        >
          {/* The same row as View place and Reschedule (MESITA-4115, Pato:
              "cancel reservation and reschedule must have same format"). */}
          <span className="flex items-center gap-3">
            <span className="bg-muted text-foreground flex h-9 w-9 items-center justify-center rounded-full">
              <XCircle className="h-4 w-4" />
            </span>
            <span className="text-sm font-semibold">Cancel reservation</span>
          </span>
          <span className="text-muted-foreground text-xs">
            We tell the place
          </span>
        </button>
      )}

      {/* ── Cancel ─────────────────────────────────────────────────────── */}
      <LocalDialog
        open={confirmOpen}
        onClose={() => (busy ? undefined : setConfirmOpen(false))}
        ariaLabel="Cancel this reservation"
      >
        <div className="flex flex-col gap-3 p-5 text-center">
          <span className="bg-muted text-foreground mx-auto flex h-12 w-12 items-center justify-center rounded-full">
            <XCircle className="h-5 w-5" />
          </span>
          <h2 className={SHEET_TITLE_CLASS}>Cancel this reservation?</h2>
          <p className="text-muted-foreground type-body leading-relaxed">
            {r.placeName} · {r.when}. We&apos;ll stop calling and let the place
            know. You can always book again.
          </p>

          {error && <p className={ERROR_BOX_CLASS}>{error}</p>}

          <div className="mt-1 flex flex-col gap-2">
            <button
              type="button"
              onClick={submitCancel}
              disabled={busy}
              className="bg-foreground inline-flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold text-white transition active:scale-[0.99] disabled:opacity-60"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {busy ? "Cancelling…" : "Yes, cancel it"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              disabled={busy}
              className="border-border bg-card hover:bg-muted inline-flex h-11 w-full items-center justify-center rounded-full border text-sm font-semibold transition disabled:opacity-60"
            >
              Keep it
            </button>
          </div>
        </div>
      </LocalDialog>
    </section>
  );
}

// Move your table, on its own page (MESITA-4113). Same EF as the old sheet.
export function RescheduleForm({ r }: { r: ReservationItem }) {
  const supabase = useBrowserSupabase();
  const router = useRouter();
  const tz = r.placeTimezone || null;
  const hours = useMemo(() => weeklyHoursFrom(r.placeHours), [r.placeHours]);
  const dateOptions = buildDateOptions(hours, tz);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateChoice, setDateChoice] = useState(() =>
    localDate(r.reservedAt, tz),
  );
  const [timeChoice, setTimeChoice] = useState(() =>
    localTime(r.reservedAt, tz),
  );
  const [party, setParty] = useState(r.partySize);
  const date =
    dateOptions.find((d) => d.iso === dateChoice && !d.disabled)?.iso ??
    firstOpenDate(dateOptions);
  const time = resolveSlot(
    date,
    timeChoice,
    hours,
    tz,
    r.reservedAt ? placeDateTime(r.reservedAt, tz) : null,
  );

  async function submitReschedule() {
    if (busy || !date || !time) return;
    setBusy(true);
    setError(null);
    try {
      await apiUpdateReservation(supabase, {
        reservationId: r.id,
        reservedAt: placeInstantIso(date, time, tz),
        partySize: party,
      });
      toast.success("New time sent. Mesita calls the place as soon as it is open.");
      router.replace(`/reservation/${r.id}`);
    } catch (e) {
      setError(errMsg(e, "Couldn't update the reservation."));
      setBusy(false);
    }
  }

  return (
    <Screen title="Reschedule" scrolls>
      <div className="flex flex-col px-4 py-5">
        <div className="flex items-center gap-3">
          <span className="bg-primary/10 text-primary flex h-12 w-12 shrink-0 items-center justify-center rounded-full">
            <CalendarClock className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className={SHEET_TITLE_CLASS}>Move your table</h2>
            <p className="text-muted-foreground truncate text-xs">
              {r.placeName} · now {r.when}
            </p>
          </div>
        </div>
        <p className="text-muted-foreground type-body mt-3 leading-snug">
          Pick a new slot and Mesita calls {r.placeName} again to confirm it.
          Your table isn&apos;t moved until they say yes.
        </p>
        <div className="mt-4 flex flex-col gap-4">
          <ReservationDatePicker
            options={dateOptions}
            value={date}
            onChange={setDateChoice}
          />
          <ReservationTimePicker
            value={time}
            onChange={setTimeChoice}
            date={date}
            hours={hours}
            tz={tz}
          />
          <ReservationPartyPicker value={party} onChange={setParty} />
        </div>
        {error && <p className={cn(ERROR_BOX_CLASS, "mt-4")}>{error}</p>}
        <button
          type="button"
          onClick={submitReschedule}
          disabled={busy || !date || !time}
          className="bg-primary text-primary-foreground mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold transition active:scale-[0.99] disabled:opacity-60"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {busy
            ? "Updating…"
            : !time
              ? "No times left"
              : `Ask for ${party} ${guestNoun(party)} at ${time}`}
        </button>
      </div>
    </Screen>
  );
}

type Loaded =
  | { state: "loading" }
  | { state: "failed" }
  | { state: "missing" }
  | { state: "found"; r: ReservationItem };

export function RescheduleRoute({ id }: { id: string }) {
  const supabase = useBrowserSupabase();
  const [loaded, setLoaded] = useState<Loaded>({ state: "loading" });

  useEffect(() => {
    let cancelled = false;
    apiListReservations(supabase, { scope: "all", limit: 200 })
      .then(({ reservations }) => {
        if (cancelled) return;
        const match = reservations.find((row) => row.id === id);
        setLoaded(
          match
            ? { state: "found", r: toReservationItem(match) }
            : { state: "missing" },
        );
      })
      .catch(() => {
        if (!cancelled) setLoaded({ state: "failed" });
      });
    return () => {
      cancelled = true;
    };
  }, [id, supabase]);

  if (loaded.state === "loading") {
    return (
      <Screen title="Reschedule" scrolls>
        <p className="text-muted-foreground px-4 py-6 text-sm">Loading…</p>
      </Screen>
    );
  }
  if (loaded.state === "failed") {
    return (
      <Screen title="Reschedule" scrolls>
        <p className="text-muted-foreground px-4 py-6 text-sm">
          Couldn&apos;t load this reservation. Go back and try again.
        </p>
      </Screen>
    );
  }
  if (loaded.state === "missing" || !loaded.r.canReschedule) {
    return (
      <Screen title="Reschedule" scrolls>
        <p className="text-muted-foreground px-4 py-6 text-sm">
          This table can&apos;t be moved.
        </p>
      </Screen>
    );
  }
  return <RescheduleForm r={loaded.r} />;
}
