"use client";

import { useMemo, useState, useTransition } from "react";
import { CalendarCheck, Phone } from "lucide-react";
import {
  updatePlace,
  type AdminPlace,
  type ReservationChannel,
  type ReservationTarget,
} from "../actions";
import { SaveBar, SectionCard } from "../ui";

// Reservations — the single contact channel the Reservationist uses to reach
// the place. Moved out of the Place tab onto Settings (MESITA-837): it is an
// operator routing decision, not profile content.
//
// Voice-only (MESITA-842): phone is the sole serving channel. WhatsApp /
// Instagram are not bookable — the fleet has no Messages.json path (MESITA-839).
// The contact itself still lives on Place → Channels; here we confirm the
// agent dials that saved phone.

const str = (v: unknown) => (typeof v === "string" ? v : "");

const isReservationChannel = (c: unknown): c is ReservationChannel => c === "phone";

/** The place's saved phone contact. */
function profilePhone(place: AdminPlace): string {
  return str(place.phone);
}

/**
 * Read the reservation channel. Only phone is a serving path — legacy
 * whatsapp/instagram picks return "" so the operator sees they need to set phone.
 */
function readReservationChannel(v: AdminPlace): ReservationChannel | "" {
  const raw = v.products?.reservations as unknown;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    if (isReservationChannel(obj.channel)) return obj.channel;
  }
  return "";
}

export function ReservationsCard({
  place,
  onSaved,
}: {
  place: AdminPlace;
  onSaved: (v: AdminPlace) => void;
}) {
  const saved = useMemo(() => readReservationChannel(place), [place]);
  const phoneValue = profilePhone(place);
  const hasPhone = phoneValue.trim() !== "";
  // Default the picker to phone when the place has a line and nothing serving
  // is stored yet (or a legacy non-phone pick was ignored).
  const [channel, setChannel] = useState<ReservationChannel | "">(
    saved || (hasPhone ? "phone" : ""),
  );
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const dirty = channel !== saved;
  const active = channel === "phone";

  const save = () => {
    if (!channel) {
      setError("Set a phone under Place → Channels — the agent books by voice only.");
      setOk(false);
      return;
    }
    setError(null);
    setOk(false);
    start(async () => {
      const target: ReservationTarget = {
        channel: "phone",
        value: phoneValue.trim() || null,
      };
      const r = await updatePlace({
        id: place.id,
        reservation_endpoint: null,
        reservation_contacts: [],
        products: { ...(place.products ?? {}), reservations: target },
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      onSaved(r.data);
      setOk(true);
      window.setTimeout(() => setOk(false), 2500);
    });
  };

  return (
    <SectionCard
      icon={<CalendarCheck className="h-4 w-4" />}
      tint="teal"
      title="Reservations"
      subtitle="Mesita's AI agent books by phone — the Reservationist is voice-only."
    >
      <p className="text-muted-foreground mt-5 text-xs">
        The agent dials the place&apos;s phone. WhatsApp and Instagram are not
        booking channels. Add or edit the number under Place → Channels.
      </p>
      <div className="mt-3.5 grid gap-3.5">
        <div className="flex flex-col gap-1.5">
          <span className="text-foreground/90 flex min-h-4 items-center text-[13px] font-medium">
            Channel
          </span>
          <div role="group" aria-label="Reservation channel" className="grid grid-cols-1 gap-2">
            <button
              type="button"
              onClick={() => hasPhone && setChannel("phone")}
              disabled={pending || !hasPhone}
              aria-pressed={active}
              title={
                !hasPhone
                  ? "Add a Phone contact under Place → Channels to use it"
                  : undefined
              }
              className={
                "flex h-[4.5rem] flex-col items-center justify-center gap-1 rounded-xl border text-[12px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 " +
                (active
                  ? "border-primary/50 bg-primary/8 text-primary ring-primary/15 ring-2"
                  : "border-border/60 bg-muted/40 text-foreground/70 hover:border-foreground/25 hover:bg-muted/70")
              }
            >
              <Phone
                className={
                  "h-6 w-6 shrink-0 " + (active ? "text-primary" : "text-muted-foreground")
                }
              />
              Phone
              {!hasPhone ? (
                <span className="text-muted-foreground/70 text-[9px] font-medium">
                  not set
                </span>
              ) : null}
            </button>
          </div>
          {channel === "phone" ? (
            hasPhone ? (
              <span className="text-muted-foreground text-xs">
                Uses the profile&apos;s Phone:{" "}
                <span className="text-foreground/90 font-medium break-all">
                  {phoneValue}
                </span>
              </span>
            ) : (
              <span className="text-xs font-medium text-amber-700">
                No phone on the profile yet — add it in Place → Channels first.
              </span>
            )
          ) : null}
        </div>
      </div>
      <SaveBar
        pending={pending}
        dirtyLabel="Reservations · unsaved"
        dirty={dirty}
        ok={ok}
        error={error}
        onSave={save}
        onCancel={() => setChannel(saved || (hasPhone ? "phone" : ""))}
      />
    </SectionCard>
  );
}
