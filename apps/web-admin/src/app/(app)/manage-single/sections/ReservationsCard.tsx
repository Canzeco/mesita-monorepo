"use client";

import { useCallback, useMemo, useState } from "react";
import { type AdminPlace } from "../actions";
import { useSectionSaver } from "../useSectionDirty";
import { usePlaceContext } from "../PlaceContext";
import {
  ChannelPicker,
  readChannel,
  targetForChannel,
  type ChannelKey,
} from "./ChannelPicker";

// Reservations — how a guest books, or that they do not.
// Five picks, same control as Orders (Pato 2026-08-25). The Reservationist
// still only DIALS phone. WhatsApp / Instagram / Web Link are the place's
// own door. Not means Mesita does not book this place.

export function ReservationsCard({
  place,
}: {
  place: AdminPlace;
}) {
  const saved = useMemo(
    () => readChannel(place.reservation_channel),
    [place.reservation_channel],
  );

  const [channel, setChannel] = useState<ChannelKey | "">(saved);
  const { savePending } = usePlaceContext();

  const dirty = channel !== saved;

  const resetDraft = useCallback(() => {
    setChannel(saved);
  }, [saved]);

  useSectionSaver(
    "reservations",
    dirty,
    () => {
      if (!dirty) return { kind: "clean" };
      if (!channel) {
        return { kind: "invalid", error: "Pick a reservation channel, or Not." };
      }
      if (channel !== "none" && !targetForChannel(place, channel)) {
        return {
          kind: "invalid",
          error: `Add a ${channel} contact under Place → Channels first.`,
        };
      }
      return {
        kind: "patch",
        patch: {
          reservation_channel: channel,
          reservation_target: targetForChannel(place, channel),
        },
      };
    },
    () => {},
    resetDraft,
  );

  return (
    <div>
        <ChannelPicker
          place={place}
          selected={channel}
          onSelect={setChannel}
          disabled={savePending}
          ariaLabel="Reservation channel"
          noneHint="This place does not take reservations."
        />
    </div>
  );
}
