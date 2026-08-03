"use client";

import { useMemo, useState, useTransition } from "react";
import { CalendarCheck, Phone, type LucideIcon } from "lucide-react";
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
// The contacts themselves still live on Place → Channels. Here we only pick
// WHICH of them the agent dials, and we read the values off the SAVED place
// (not an in-flight Channels form — different tab now), so a channel only
// becomes selectable once its contact is actually persisted.

const str = (v: unknown) => (typeof v === "string" ? v : "");

const RESERVATION_CHANNELS: {
  key: ReservationChannel;
  label: string;
  /** Primary-channel profile field the reservationist contacts. */
  profileKey: keyof AdminPlace;
  /** Graphical mark for the segmented picker: brand SVG or a lucide icon. */
  logo?: string;
  Icon?: LucideIcon;
  /** Held for a later launch — shown in the picker but never selectable. Today
   *  only phone is a real reservation channel; WhatsApp + Instagram read "Soon". */
  comingSoon?: boolean;
  // Default priority order — phone > whatsapp > instagram (MESITA-596). The
  // Enricher fills the channel following the same order; admin can override.
}[] = [
  { key: "phone", label: "Phone", profileKey: "phone", Icon: Phone },
  {
    key: "whatsapp",
    label: "WhatsApp",
    profileKey: "whatsapp_url",
    logo: "/channels/whatsapp.svg",
    comingSoon: true,
  },
  {
    key: "instagram",
    label: "Instagram",
    profileKey: "instagram_url",
    logo: "/channels/instagram.svg",
    comingSoon: true,
  },
];

const isReservationChannel = (c: unknown): c is ReservationChannel =>
  c === "instagram" || c === "whatsapp" || c === "phone";

/** The place's saved contact for one channel. */
function profileValueFor(place: AdminPlace, channel: ReservationChannel | ""): string {
  const meta = RESERVATION_CHANNELS.find((c) => c.key === channel);
  return meta ? str(place[meta.profileKey]) : "";
}

/** Read the reservation channel — collapses any stored fallbacks to the single
 *  primary (reservations are single-choice now). Tolerates the older
 *  single-channel and per-channel-routes shapes. Only CHANNELS matter — the
 *  stored values are snapshots resolved at save time, never hand-entered. */
function readReservationChannel(v: AdminPlace): ReservationChannel | "" {
  const raw = v.products?.reservations as unknown;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    if (isReservationChannel(obj.channel)) return obj.channel;
    if (Array.isArray(obj.fallbacks)) {
      for (const f of obj.fallbacks) {
        if (f && typeof f === "object") {
          const c = (f as Record<string, unknown>).channel;
          if (isReservationChannel(c)) return c;
        }
      }
    }
    // Legacy MESITA-378 routes: first channel that had a route or a profile value.
    for (const key of ["phone", "whatsapp", "instagram"] as const) {
      const c = obj[key];
      const route = c && typeof c === "object" ? (c as Record<string, unknown>) : null;
      if (route && (route.mode === "different" || profileValueFor(v, key))) return key;
    }
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
  const [channel, setChannel] = useState<ReservationChannel | "">(saved);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const dirty = channel !== saved;
  const resolved = profileValueFor(place, channel);
  const meta = RESERVATION_CHANNELS.find((c) => c.key === channel);

  const save = () => {
    // Never clear the target on save: the Reservationist reads this shape and
    // a null lands the place channel-less (MESITA-441).
    if (!channel) {
      setError("Pick Instagram, WhatsApp, or phone — Select… isn’t a contact channel.");
      setOk(false);
      return;
    }
    setError(null);
    setOk(false);
    start(async () => {
      // Same convention as the Enricher's Selected Reservation Endpoint: the
      // value is a snapshot of the profile contact at save time. The flat
      // { channel, value } shape is what the Enricher's override check reads.
      const target: ReservationTarget = {
        channel,
        value: resolved.trim() || null,
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
      subtitle="Mesita's AI agent makes the reservation by contacting the place — via phone, WhatsApp, or Instagram."
    >
      <p className="text-muted-foreground mt-5 text-xs">
        Pick the channel the agent uses to reach the place — only channels with
        a saved contact are selectable. Add the contact under Place → Channels
        first. Default priority: phone, then WhatsApp, then Instagram.
      </p>
      <div className="mt-3.5 grid gap-3.5">
        <div className="flex flex-col gap-1.5">
          <span className="text-foreground/90 flex min-h-4 items-center text-[13px] font-medium">
            Channel
          </span>
          {/* Segmented icon picker — single-choice; a channel IS the value
              (no free-text). The agent always contacts the PROFILE value for
              the channel; the contact itself lives in Channels. */}
          <div
            role="group"
            aria-label="Reservation channel"
            className="grid grid-cols-3 gap-2"
          >
            {RESERVATION_CHANNELS.map((c) => {
              // Only phone is a real reservation channel today. WhatsApp +
              // Instagram are shown but held for a later launch — always
              // blocked, labelled "Soon", never active.
              const comingSoon = c.comingSoon === true;
              const active = !comingSoon && channel === c.key;
              // A channel is only selectable once the place actually has that
              // contact saved (MESITA-596) — you can't point the agent at a
              // WhatsApp that doesn't exist. The stored channel stays
              // interactive so a legacy empty one can be switched away from.
              const hasValue = profileValueFor(place, c.key).trim() !== "";
              const unavailable = !active && !hasValue;
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => !comingSoon && setChannel(c.key)}
                  disabled={pending || comingSoon || unavailable}
                  aria-pressed={active}
                  title={
                    comingSoon
                      ? `${c.label} reservations are coming soon`
                      : unavailable
                        ? `Add a ${c.label} contact under Place → Channels to use it`
                        : undefined
                  }
                  className={
                    "flex h-[4.5rem] flex-col items-center justify-center gap-1 rounded-xl border text-[12px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 " +
                    (active
                      ? "border-primary/50 bg-primary/8 text-primary ring-primary/15 ring-2"
                      : "border-border/60 bg-muted/40 text-foreground/70 hover:border-foreground/25 hover:bg-muted/70")
                  }
                >
                  <ReservationChannelIcon
                    logo={c.logo}
                    Icon={c.Icon}
                    active={active}
                  />
                  {c.label}
                  {comingSoon ? (
                    <span className="text-muted-foreground/70 text-[9px] font-medium">
                      Soon
                    </span>
                  ) : unavailable ? (
                    <span className="text-muted-foreground/70 text-[9px] font-medium">
                      not set
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
          {channel ? (
            resolved.trim() ? (
              <span className="text-muted-foreground text-xs">
                Uses the profile&apos;s {meta?.label ?? channel}:{" "}
                <span className="text-foreground/90 font-medium break-all">
                  {resolved}
                </span>
              </span>
            ) : (
              <span className="text-xs font-medium text-amber-700">
                No {meta?.label ?? channel} on the profile yet — add it in Place →
                Channels first.
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
        onCancel={() => setChannel(saved)}
      />
    </SectionCard>
  );
}

// Larger channel mark for the reservation segmented picker. Brand SVGs keep
// their own colour; a lucide fallback (Phone) takes the active/idle tint.
function ReservationChannelIcon({
  logo,
  Icon,
  active,
}: {
  logo?: string;
  Icon?: LucideIcon;
  active: boolean;
}) {
  if (logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logo} alt="" aria-hidden className="h-6 w-6 shrink-0" />;
  }
  if (Icon) {
    return (
      <Icon
        className={
          "h-6 w-6 shrink-0 " + (active ? "text-primary" : "text-muted-foreground")
        }
      />
    );
  }
  return null;
}
