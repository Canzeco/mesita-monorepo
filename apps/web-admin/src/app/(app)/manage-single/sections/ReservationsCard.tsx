"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { CalendarCheck } from "lucide-react";
import { updatePlace, type AdminPlace } from "../actions";
import { useSectionDirty } from "../useSectionDirty";
import { SaveBar, SectionCard } from "../ui";
import {
  ChannelPicker,
  channelOptions,
  readChannel,
  type ChannelKey,
} from "./ChannelPicker";

// Reservations — which Place → Channels contact the Reservationist uses.
// Moved onto Settings (MESITA-837). Voice-only today (MESITA-842): phone is
// the only selectable serving channel; WhatsApp + Instagram are parked with
// Soon until a Messages path ships (MESITA-839). The picker itself is shared
// with Orders (MESITA-1155) — both rails ask the same question.
//
// The rail this feeds: a guest books, a reservation_ticket opens at `pending`,
// and the a1–a4 agent graphs call THIS number until the ticket lands —
// confirmed · declined · unreachable · no_show · cancelled · unresolved.
// Retries, callbacks and negotiation rounds are Mesita-wide (Configurations →
// Reservations); the number is the only per-place decision, which is why it is
// the only control in this box. The place answers a phone and nothing else:
// no login, no dashboard, no app.
export function ReservationsCard({
  place,
  onSaved,
}: {
  place: AdminPlace;
  onSaved: (v: AdminPlace) => void;
}) {
  const options = useMemo(() => channelOptions(place), [place]);
  const hasPhone = options[0].contact !== "";
  const saved = useMemo(
    () => readChannel(place.reservation_channel),
    [place.reservation_channel],
  );

  const [channel, setChannel] = useState<ChannelKey | "">(
    saved || (hasPhone ? "phone" : ""),
  );
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const dirty = channel !== saved;

  const resetDraft = useCallback(() => {
    setChannel(saved || (hasPhone ? "phone" : ""));
    setError(null);
    setOk(false);
  }, [saved, hasPhone]);
  useSectionDirty("reservations", dirty, resetDraft);

  const save = () => {
    if (!channel || !hasPhone) {
      setError("Set a phone under Place → Channels — the agent books by voice only.");
      setOk(false);
      return;
    }
    setError(null);
    setOk(false);
    start(async () => {
      const r = await updatePlace({
        id: place.id,
        // Legacy pair stays cleared until the CONTRACT issue drops the columns.
        reservation_endpoint: null,
        reservation_contacts: [],
        reservation_channel: "phone",
        reservation_target: options[0].contact || null,
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
    >
      <div className="mt-3.5">
        <ChannelPicker
          options={options}
          selected={channel}
          onSelect={setChannel}
          disabled={pending}
          ariaLabel="Reservation channel"
          soonVerb="booking"
        />
      </div>
      <SaveBar
        pending={pending}
        dirtyLabel="Reservations · unsaved"
        dirty={dirty}
        ok={ok}
        error={error}
        onSave={save}
        onCancel={resetDraft}
      />
    </SectionCard>
  );
}
